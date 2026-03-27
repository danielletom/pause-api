# Doctor Report & Export API Implementation

## Overview

Three new API endpoints have been created for the Pause menopause wellness app to support doctor report generation, sharing, and CSV data export.

## Files Created

### 1. Doctor Report Endpoint
**Path:** `/src/app/api/export/doctor-report/route.ts`

**Endpoint:** `GET /api/export/doctor-report?days=30|60|90&sections=symptoms,sleep,meds,mood,triggers`

**Features:**
- Requires Clerk authentication (userId from auth context)
- Accepts `days` parameter: 30, 60, or 90 days of historical data
- Accepts optional `sections` parameter to include specific data sections
- Returns a comprehensive patient report with the following structure:

```json
{
  "report": {
    "generatedAt": "ISO timestamp",
    "dateRange": {
      "start": "YYYY-MM-DD",
      "end": "YYYY-MM-DD",
      "days": 30
    },
    "patient": {
      "name": "string or null",
      "age": "number or null",
      "stage": "perimenopause | menopause | etc."
    },
    "summary": {
      "totalCheckIns": 28,
      "avgReadiness": null,
      "topSymptoms": [
        {
          "name": "hot_flash",
          "avgSeverity": 2.1,
          "frequency": 18,
          "trend": "improving|stable|worsening"
        }
      ],
      "overallTrend": "improving|stable|worsening"
    },
    "sections": {
      "symptoms": {
        "data": [/* SymptomData[] */],
        "notes": "Based on X check-ins over Y days"
      },
      "sleep": {
        "avgHours": 6.5,
        "avgQuality": "good",
        "nightsLogged": 28,
        "logsWithData": 24
      },
      "medications": {
        "data": [
          {
            "name": "Estradiol",
            "dose": "2mg",
            "frequency": "daily",
            "adherenceRate": 92,
            "daysLogged": 25,
            "daysTaken": 23
          }
        ],
        "totalActive": 3
      },
      "mood": {
        "avgMood": 6.2,
        "avgEnergy": 5.8,
        "moodTrend": "stable",
        "energyTrend": "improving"
      },
      "correlations": [
        {
          "factor": "sleep_under_6h",
          "symptom": "hot_flash",
          "direction": "positive",
          "effectSizePct": 25.5,
          "confidence": 0.87,
          "occurrences": 12,
          "totalOpportunities": 15
        }
      ]
    },
    "appointmentQuestions": [
      "I've been experiencing hot flashes with an average severity of 2.1/5...",
      "I'm averaging only 6.5 hours of sleep per night..."
    ]
  }
}
```

**Key Features:**
- Calculates symptom trends comparing first half vs second half of the period
- Computes medication adherence rates based on med_logs
- Generates appointment questions from top symptoms, sleep issues, medication adherence problems, and detected patterns
- Includes only data from the requested sections parameter
- Uses Drizzle ORM for type-safe database queries

---

### 2. Report Share Endpoint
**Path:** `/src/app/api/export/share/route.ts`

**POST Endpoint:** `POST /api/export/share`

Accepts request body:
```json
{
  "reportData": { /* full report object */ },
  "recipientEmail": "doctor@example.com",
  "recipientName": "Dr. Smith",
  "expiresInDays": 30
}
```

Returns:
```json
{
  "success": true,
  "token": "a3f2d1e9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2",
  "shareUrl": "https://app.pause.health/share/a3f2d1e9...",
  "expiresAt": "2026-04-25T12:30:45.123Z",
  "message": "Report share link created. It will expire on 4/25/2026."
}
```

**GET Endpoint:** `GET /api/export/share?token=xxx`

Retrieves a shared report without authentication. Returns:
```json
{
  "report": { /* full report object */ },
  "sharedBy": {
    "email": "doctor@example.com",
    "name": "Dr. Smith"
  },
  "accessCount": 5,
  "createdAt": "2026-03-26T12:30:45.123Z",
  "expiresAt": "2026-04-25T12:30:45.123Z"
}
```

**Features:**
- Creates a unique, cryptographically secure token using `crypto.randomBytes(32)`
- Stores share record in the new `reportShares` table
- Supports optional expiration dates (default 30 days)
- Tracks access count and last accessed timestamp
- Validates token expiration on retrieval
- Returns 404 if share not found or has expired
- POST requires Clerk authentication; GET does not (unauthenticated sharing)

---

### 3. CSV Export Endpoint
**Path:** `/src/app/api/export/csv/route.ts`

**Endpoint:** `GET /api/export/csv?days=30|60|90`

**Returns:** CSV file download with proper headers:
- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="pause-export-YYYY-MM-DD.csv"`

**CSV Columns:**
- Date
- Symptoms (formatted with severity, e.g., "hot_flash (3/5); night_sweats (2/5)")
- Mood (1-10)
- Energy (1-10)
- Sleep Hours
- Sleep Quality
- Meds Taken (Yes/No)
- Notes
- Dynamic medication columns (one per medication taken in the period, e.g., "Estradiol (taken)")

**Example CSV Output:**
```
Date,Symptoms,Mood (1-10),Energy (1-10),Sleep Hours,Sleep Quality,Meds Taken,Notes,Estradiol (taken),Progesterone (taken)
2026-03-26,hot_flash (3/5); night_sweats (2/5),6,5.5,6.5,good,Yes,Slept okay but hot flashes at 3am,Yes,Yes
2026-03-25,hot_flash (2/5),7,6,7,good,Yes,,Yes,Yes
```

**Features:**
- Requires Clerk authentication
- Accepts `days` parameter: 30, 60, or 90 (default 30)
- Properly escapes CSV fields containing commas, quotes, or newlines
- Dynamically includes medication columns based on what was tracked in the period
- Joins with medications table to show med names
- Merges med_logs to show adherence on each date

---

## Database Schema Changes

### New Table: `reportShares`

Added to `/src/db/schema.ts`:

```typescript
export const reportShares = pgTable("report_shares", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  token: text("token").unique().notNull(),
  reportData: jsonb("report_data").notNull(),
  recipientEmail: text("recipient_email"),
  recipientName: text("recipient_name"),
  expiresAt: timestamp("expires_at"),
  accessCount: integer("access_count").default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

This table stores:
- Unique tokens for secure sharing
- Full report data as JSONB (allows querying/filtering later if needed)
- Recipient information (email/name for tracking who it was shared with)
- Expiration dates for time-limited access
- Access metrics (count and last accessed time)

---

## Implementation Details

### Authentication
- **Doctor Report & CSV Export:** Require Clerk authentication via `auth()` from `@clerk/nextjs/server`
- **Report Share (GET):** No authentication required — shares are accessed via token only
- **Report Share (POST):** Requires Clerk authentication

### Error Handling
All endpoints follow the existing pattern:
- Return 401 if authentication required and missing
- Return 400 for invalid query parameters or request bodies
- Return 404 if resource not found
- Return 500 for unexpected server errors with detailed console logging
- All errors return JSON responses with descriptive messages

### Database Queries
Uses Drizzle ORM following existing codebase patterns:
- Proper `where` clauses with `eq`, `and`, `gte`, `lte`, `desc` operators
- Type-safe schema references
- Limit clauses to prevent unbounded queries
- Proper error handling for database operations

### Data Processing
- **Symptom Trend Calculation:** Splits data into first/second half by timestamp, compares averages to determine improving/stable/worsening
- **Medication Adherence:** Calculates percentage based on med_logs with `taken` flag
- **CSV Formatting:** Proper escaping for RFC 4180 compliance
- **Appointment Questions:** Generated dynamically based on actual user data with fallback logic

---

## Testing Checklist

### Doctor Report Endpoint
- [ ] Test with `days=30`, `days=60`, `days=90`
- [ ] Test with various `sections` combinations
- [ ] Verify unauthorized requests return 401
- [ ] Test with user having no data (empty results)
- [ ] Verify trend calculation works correctly
- [ ] Verify appointment questions are generated only when relevant data exists

### CSV Export Endpoint
- [ ] Test CSV file download with correct headers
- [ ] Verify CSV is properly escaped (fields with commas/quotes)
- [ ] Test with multiple medications
- [ ] Test with various `days` parameters
- [ ] Verify filename includes correct date
- [ ] Test with missing symptom data (empty cells)

### Share Endpoint
- [ ] Test POST to create share link
- [ ] Test GET with valid token returns report
- [ ] Test GET with expired token (403 response)
- [ ] Test GET with invalid token (404 response)
- [ ] Verify access count increments on GET
- [ ] Test without authentication on POST (401)
- [ ] Test expiration date defaults to 30 days

---

## Future Enhancements

1. **Email Integration:** Actually send emails to recipients (currently POST just creates link)
2. **Share Revocation:** Add endpoint to revoke shares before expiration
3. **Dynamic Route:** Create `/api/export/share/[token]/route.ts` for cleaner URL handling
4. **PDF Export:** Generate PDF reports with formatting for printing/sharing with doctors
5. **Scheduled Reports:** Background job to auto-generate monthly reports
6. **Share Analytics:** Dashboard showing who accessed reports and when
7. **Templates:** Multiple report templates (patient-focused, doctor-focused, research-focused)
8. **Filtering:** Allow filtering appointments questions by category or confidence level

---

## Environment Variables

Add to `.env.local` if customizing share URLs:

```
NEXT_PUBLIC_APP_URL=https://app.pause.health
```

(Used in share endpoint to construct the share URL)

---

## API Usage Examples

### Generate a 60-day doctor report with all sections
```bash
curl -H "Authorization: Bearer <token>" \
  "https://api.pause.health/api/export/doctor-report?days=60&sections=symptoms,sleep,meds,mood,triggers"
```

### Export 30 days of data as CSV
```bash
curl -H "Authorization: Bearer <token>" \
  "https://api.pause.health/api/export/csv?days=30" \
  -o export.csv
```

### Create a shareable link
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reportData": { /* report object */ },
    "recipientEmail": "dr@example.com",
    "recipientName": "Dr. Smith",
    "expiresInDays": 14
  }' \
  https://api.pause.health/api/export/share
```

### Access shared report (no auth required)
```bash
curl "https://api.pause.health/api/export/share?token=a3f2d1e9c8b7a6f5..."
```
