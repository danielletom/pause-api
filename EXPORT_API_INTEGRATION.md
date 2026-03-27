# Export API Integration Guide

## Quick Start

The Export API endpoints are ready to use. Here's how to integrate them into the iOS app.

## Step 1: Database Migration

Run Drizzle migrations to add the new `reportShares` table:

```bash
npm run db:migrate
# or
drizzle-kit push
```

This creates the `report_shares` table with proper indexes and constraints.

## Step 2: API Integration in iOS App

### Generate a Doctor Report

```swift
// Swift example
let days = 30
let sections = ["symptoms", "sleep", "meds", "mood", "triggers"]

let url = URL(string: "https://api.pause.health/api/export/doctor-report?days=\(days)&sections=\(sections.joined(separator: ","))")!

var request = URLRequest(url: url)
request.addValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

URLSession.shared.dataTask(with: request) { data, response, error in
    if let data = data {
        let report = try? JSONDecoder().decode(DoctorReport.self, from: data)
        // Render report in UI
    }
}.resume()
```

### Export as CSV

```swift
let url = URL(string: "https://api.pause.health/api/export/csv?days=30")!

var request = URLRequest(url: url)
request.addValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

URLSession.shared.downloadTask(with: request) { tempURL, response, error in
    if let tempURL = tempURL {
        // Save to Documents or share with Mail/Files app
        try? FileManager.default.moveItem(at: tempURL, to: destinationURL)
    }
}.resume()
```

### Share Report with Doctor

```swift
// Step 1: Generate report
let reportResponse = // ... fetch doctor-report endpoint

// Step 2: Create share link
let shareRequest = ShareReportRequest(
    reportData: reportResponse.report,
    recipientEmail: "doctor@example.com",
    recipientName: "Dr. Smith",
    expiresInDays: 14
)

let encoder = JSONEncoder()
let shareBody = try encoder.encode(shareRequest)

var request = URLRequest(url: URL(string: "https://api.pause.health/api/export/share")!)
request.httpMethod = "POST"
request.httpBody = shareBody
request.addValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
request.addValue("application/json", forHTTPHeaderField: "Content-Type")

URLSession.shared.dataTask(with: request) { data, response, error in
    if let data = data {
        let shareResponse = try? JSONDecoder().decode(ShareResponse.self, from: data)
        // Show shareResponse.shareUrl to user (can be deep link or web URL)
        // Allow copying to clipboard or sharing via Messages
    }
}.resume()
```

## Step 3: Type Definitions for iOS App

Add these Swift types to your networking layer:

```swift
// DoctorReport.swift
struct DoctorReport: Codable {
    struct Report: Codable {
        let generatedAt: String
        let dateRange: DateRange
        let patient: Patient
        let summary: Summary
        let sections: Sections
        let appointmentQuestions: [String]
    }

    struct DateRange: Codable {
        let start: String
        let end: String
        let days: Int
    }

    struct Patient: Codable {
        let name: String?
        let age: Int?
        let stage: String?
    }

    struct Summary: Codable {
        let totalCheckIns: Int
        let avgReadiness: Int?
        let topSymptoms: [Symptom]
        let overallTrend: String // "improving" | "stable" | "worsening"
    }

    struct Symptom: Codable {
        let name: String
        let avgSeverity: Double
        let frequency: Int
        let trend: String
    }

    struct Sections: Codable {
        let symptoms: SymptomSection?
        let sleep: SleepSection?
        let medications: MedicationSection?
        let mood: MoodSection?
        let correlations: [Correlation]?
    }

    struct SymptomSection: Codable {
        let data: [Symptom]
        let notes: String
    }

    struct SleepSection: Codable {
        let avgHours: Double
        let avgQuality: String?
        let nightsLogged: Int
        let logsWithData: Int
    }

    struct MedicationSection: Codable {
        let data: [Medication]
        let totalActive: Int
    }

    struct Medication: Codable {
        let name: String
        let dose: String?
        let frequency: String?
        let adherenceRate: Int
        let daysLogged: Int
        let daysTaken: Int
    }

    struct MoodSection: Codable {
        let avgMood: Double
        let avgEnergy: Double
        let moodTrend: String
        let energyTrend: String
    }

    struct Correlation: Codable {
        let factor: String
        let symptom: String
        let direction: String
        let effectSizePct: Double
        let confidence: Double
        let occurrences: Int
        let totalOpportunities: Int
    }

    let report: Report
}

// ShareReport.swift
struct ShareReportRequest: Codable {
    let reportData: [String: AnyCodable]
    let recipientEmail: String?
    let recipientName: String?
    let expiresInDays: Int?
}

struct ShareResponse: Codable {
    let success: Bool
    let token: String
    let shareUrl: String
    let expiresAt: String?
    let message: String
}

struct SharedReport: Codable {
    let report: [String: AnyCodable]
    let sharedBy: SharedBy
    let accessCount: Int
    let createdAt: String
    let expiresAt: String?
}

struct SharedBy: Codable {
    let email: String?
    let name: String?
}
```

## Step 4: UI Components

### Doctor Report Screen

```swift
struct DoctorReportView: View {
    @State var report: DoctorReport?
    @State var isLoading = false
    @State var days: Int = 30

    var body: some View {
        VStack {
            Picker("Period", selection: $days) {
                Text("30 days").tag(30)
                Text("60 days").tag(60)
                Text("90 days").tag(90)
            }
            .onChange(of: days) { generateReport() }

            if isLoading {
                ProgressView()
            } else if let report = report {
                ScrollView {
                    VStack(alignment: .leading) {
                        // Patient Info
                        Section("Patient Information") {
                            if let name = report.report.patient.name {
                                Text("Name: \(name)")
                            }
                            if let age = report.report.patient.age {
                                Text("Age: \(age)")
                            }
                            Text("Generated: \(report.report.generatedAt)")
                        }

                        // Summary
                        Section("Summary") {
                            Text("Total Check-ins: \(report.report.summary.totalCheckIns)")
                            Text("Overall Trend: \(report.report.summary.overallTrend)")

                            if !report.report.summary.topSymptoms.isEmpty {
                                VStack(alignment: .leading) {
                                    Text("Top Symptoms").font(.headline)
                                    ForEach(report.report.summary.topSymptoms, id: \.name) { symptom in
                                        HStack {
                                            Text(symptom.name)
                                            Spacer()
                                            Text("Avg: \(String(format: "%.1f", symptom.avgSeverity))/5")
                                        }
                                    }
                                }
                            }
                        }

                        // Appointment Questions
                        if !report.report.appointmentQuestions.isEmpty {
                            Section("Questions to Ask Your Doctor") {
                                ForEach(report.report.appointmentQuestions, id: \.self) { question in
                                    VStack(alignment: .leading) {
                                        Text(question)
                                            .font(.body)
                                            .padding(.vertical, 8)
                                    }
                                    Divider()
                                }
                            }
                        }

                        // Share Button
                        Button(action: shareReport) {
                            Label("Share with Doctor", systemImage: "square.and.arrow.up")
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding()
                }
            }
        }
        .onAppear { generateReport() }
    }

    func generateReport() {
        isLoading = true
        // Call API
    }

    func shareReport() {
        // Show share sheet or deep link
    }
}
```

## Step 5: Error Handling

Handle common error cases:

```swift
enum ExportAPIError: LocalizedError {
    case unauthorized
    case invalidData
    case networkError(URLError)
    case serverError(statusCode: Int)

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Please log in to access this report"
        case .invalidData:
            return "Unable to parse report data"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .serverError(let code):
            return "Server error: \(code)"
        }
    }
}
```

## Step 6: Deep Linking for Shares

For handling share tokens in the app:

```swift
// AppDelegate or SceneDelegate
func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }

    // Handle: pause://share/[token]
    if url.scheme == "pause" && url.host == "share" {
        let token = url.lastPathComponent
        showSharedReport(token: token)
    }
}

func showSharedReport(token: String) {
    // Fetch shared report without auth
    let url = URL(string: "https://api.pause.health/api/export/share?token=\(token)")!
    // Display in read-only view
}
```

## Step 7: Testing

### Manual Testing

1. **Generate Report:**
   ```bash
   curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
     "http://localhost:3000/api/export/doctor-report?days=30&sections=symptoms,sleep,meds"
   ```

2. **Create Share:**
   ```bash
   curl -X POST \
     -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
     -H "Content-Type: application/json" \
     -d '{"reportData": {}, "recipientEmail": "test@example.com"}' \
     http://localhost:3000/api/export/share
   ```

3. **Access Share:**
   ```bash
   curl "http://localhost:3000/api/export/share?token=<token>"
   ```

### Unit Tests

```swift
class ExportAPITests: XCTestCase {
    let api = ExportAPI()

    func testDoctorReportFetch() async throws {
        let report = try await api.getDoctorReport(days: 30, sections: ["symptoms"])
        XCTAssertNotNil(report)
        XCTAssertGreaterThan(report.report.summary.totalCheckIns, 0)
    }

    func testCSVExport() async throws {
        let data = try await api.exportCSV(days: 30)
        XCTAssertTrue(data.count > 0)
        XCTAssertTrue(String(data: data, encoding: .utf8)?.contains("Date") ?? false)
    }

    func testShareCreation() async throws {
        let report = try await api.getDoctorReport(days: 30)
        let share = try await api.createShare(
            report: report.report,
            recipientEmail: "test@example.com"
        )
        XCTAssertFalse(share.token.isEmpty)
    }

    func testShareAccess() async throws {
        let share = try await api.getSharedReport(token: "valid-token")
        XCTAssertNotNil(share.report)
    }
}
```

## Deployment Notes

1. **Database Migration:** Run migrations before deploying to production
2. **Token Cleanup:** Consider adding a cron job to delete expired shares
3. **Rate Limiting:** Add rate limiting to CSV export (large exports can be expensive)
4. **Analytics:** Track which features users export/share for insights
5. **Audit Logging:** Log all share creations for compliance/privacy

## Support

For issues or questions, check:
- `/src/app/api/export/doctor-report/route.ts` for report logic
- `/src/app/api/export/csv/route.ts` for CSV formatting
- `/src/app/api/export/share/route.ts` for sharing logic
- Database logs for query performance
