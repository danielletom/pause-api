import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import {
  profiles,
  dailyLogs,
  medications,
  medLogs,
  userCorrelations,
} from '@/db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

// ── Types ───────────────────────────────────────────────────────────────────

interface DoctorReportRequest {
  days: 30 | 60 | 90;
  sections?: ('symptoms' | 'sleep' | 'meds' | 'mood' | 'triggers')[];
}

interface SymptomData {
  name: string;
  avgSeverity: number;
  frequency: number;
  trend: 'improving' | 'stable' | 'worsening';
}

interface MedicationData {
  name: string;
  dose: string | null;
  frequency: string | null;
  adherenceRate: number;
  daysLogged: number;
  daysTaken: number;
}

interface SleepData {
  avgHours: number;
  avgQuality: string | null;
  nightsLogged: number;
  logsWithData: number;
}

interface MoodData {
  avgMood: number;
  avgEnergy: number;
  moodTrend: 'improving' | 'stable' | 'worsening';
  energyTrend: 'improving' | 'stable' | 'worsening';
}

interface CorrelationData {
  factor: string;
  symptom: string;
  direction: 'positive' | 'negative';
  effectSizePct: number;
  confidence: number;
  occurrences: number;
  totalOpportunities: number;
}

interface DoctorReportResponse {
  report: {
    generatedAt: string;
    dateRange: {
      start: string;
      end: string;
      days: number;
    };
    patient: {
      name: string | null;
      age: number | null;
      stage: string | null;
    };
    summary: {
      totalCheckIns: number;
      avgReadiness: number | null;
      topSymptoms: SymptomData[];
      overallTrend: 'improving' | 'stable' | 'worsening';
    };
    sections: {
      symptoms?: {
        data: SymptomData[];
        notes: string;
      };
      sleep?: SleepData;
      medications?: {
        data: MedicationData[];
        totalActive: number;
      };
      mood?: MoodData;
      correlations?: CorrelationData[];
    };
    appointmentQuestions: string[];
  };
}

// ── Utility Functions ───────────────────────────────────────────────────────

function calculateAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function calculateTrend(
  values: number[]
): 'improving' | 'stable' | 'worsening' {
  if (values.length < 2) return 'stable';

  // Split into two halves and compare averages
  const midpoint = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, midpoint);
  const secondHalf = values.slice(midpoint);

  const avg1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avg2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const percentChange = ((avg2 - avg1) / avg1) * 100;

  if (percentChange < -10) return 'improving'; // Lower is better
  if (percentChange > 10) return 'worsening';
  return 'stable';
}

// ── Route Handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const daysParam = parseInt(searchParams.get('days') || '30') as 30 | 60 | 90;
    const sectionsParam = searchParams.get('sections')
      ? searchParams.get('sections')!.split(',')
      : ['symptoms', 'sleep', 'meds', 'mood', 'triggers'];

    // Validate days parameter
    const days = [30, 60, 90].includes(daysParam) ? daysParam : 30;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startDateStr = startDate.toISOString().split('T')[0]!;
    const endDateStr = endDate.toISOString().split('T')[0]!;

    // 1. Get patient profile
    const profileRows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    const profile = profileRows.length > 0 ? profileRows[0] : null;
    const age = calculateAge(profile?.dateOfBirth || null);

    // 2. Get daily logs for the date range
    const logs = await db
      .select()
      .from(dailyLogs)
      .where(
        and(
          eq(dailyLogs.userId, userId),
          gte(dailyLogs.date, startDateStr),
          lte(dailyLogs.date, endDateStr)
        )
      )
      .orderBy(desc(dailyLogs.date));

    const totalCheckIns = logs.length;

    // 3. Build symptom data
    const symptomMap = new Map<
      string,
      { severities: number[]; dates: string[] }
    >();

    for (const log of logs) {
      const raw = log.symptomsJson;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
          const sev =
            typeof val === 'number'
              ? val
              : typeof val === 'object' && val !== null
                ? ((val as any).severity ?? 1)
                : 1;
          if (!symptomMap.has(key)) {
            symptomMap.set(key, { severities: [], dates: [] });
          }
          symptomMap.get(key)!.severities.push(sev);
          symptomMap.get(key)!.dates.push(log.date);
        }
      }
    }

    const topSymptoms: SymptomData[] = Array.from(symptomMap.entries())
      .map(([name, data]) => ({
        name,
        avgSeverity:
          data.severities.reduce((a, b) => a + b, 0) / data.severities.length,
        frequency: data.severities.length,
        trend: calculateTrend(data.severities),
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    // 4. Calculate overall trend (average of top symptoms)
    const allSeverities = Array.from(symptomMap.values())
      .flatMap((d) => d.severities)
      .sort((a, b) => a - b);
    const overallTrend = calculateTrend(allSeverities);

    // 5. Get sleep data
    let sleepData: SleepData | undefined;
    if (sectionsParam.includes('sleep')) {
      const logsWithSleep = logs.filter((l) => l.sleepHours != null);
      const sleepHours = logsWithSleep.map((l) => l.sleepHours as number);
      const avgHours =
        sleepHours.length > 0
          ? sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length
          : 0;

      const qualityMap = new Map<string, number>();
      logsWithSleep.forEach((l) => {
        if (l.sleepQuality) {
          qualityMap.set(
            l.sleepQuality,
            (qualityMap.get(l.sleepQuality) || 0) + 1
          );
        }
      });

      let avgQuality: string | null = null;
      if (qualityMap.size > 0) {
        avgQuality = Array.from(qualityMap.entries()).sort(
          (a, b) => b[1] - a[1]
        )[0]![0];
      }

      sleepData = {
        avgHours: Math.round(avgHours * 10) / 10,
        avgQuality,
        nightsLogged: logs.length,
        logsWithData: logsWithSleep.length,
      };
    }

    // 6. Get medication data
    let medicationData: { data: MedicationData[]; totalActive: number } | undefined;
    if (sectionsParam.includes('meds')) {
      const activeMeds = await db
        .select()
        .from(medications)
        .where(and(eq(medications.userId, userId), eq(medications.active, true)));

      const medLogsData = await db
        .select()
        .from(medLogs)
        .where(
          and(
            eq(medLogs.userId, userId),
            gte(medLogs.date, startDateStr),
            lte(medLogs.date, endDateStr)
          )
        );

      const medData: MedicationData[] = activeMeds.map((med) => {
        const medsForThisMed = medLogsData.filter(
          (ml) => ml.medicationId === med.id
        );
        const daysTaken = medsForThisMed.filter((ml) => ml.taken).length;
        const daysLogged = medsForThisMed.length;
        const adherenceRate =
          daysLogged > 0 ? Math.round((daysTaken / daysLogged) * 100) : 0;

        return {
          name: med.name,
          dose: med.dose,
          frequency: med.frequency,
          adherenceRate,
          daysLogged,
          daysTaken,
        };
      });

      medicationData = {
        data: medData,
        totalActive: activeMeds.length,
      };
    }

    // 7. Get mood/energy data
    let moodData: MoodData | undefined;
    if (sectionsParam.includes('mood')) {
      const logsWithMood = logs.filter((l) => l.mood != null);
      const logsWithEnergy = logs.filter((l) => l.energy != null);

      const moodScores = logsWithMood.map((l) => l.mood as number);
      const energyScores = logsWithEnergy.map((l) => l.energy as number);

      const avgMood =
        moodScores.length > 0
          ? Math.round(
              (moodScores.reduce((a, b) => a + b, 0) / moodScores.length) * 10
            ) / 10
          : 0;
      const avgEnergy =
        energyScores.length > 0
          ? Math.round(
              (energyScores.reduce((a, b) => a + b, 0) /
                energyScores.length) *
                10
            ) / 10
          : 0;

      moodData = {
        avgMood,
        avgEnergy,
        moodTrend: calculateTrend(moodScores),
        energyTrend: calculateTrend(energyScores),
      };
    }

    // 8. Get correlations/triggers
    let correlations: CorrelationData[] | undefined;
    if (sectionsParam.includes('triggers')) {
      const correlationRows = await db
        .select()
        .from(userCorrelations)
        .where(eq(userCorrelations.userId, userId))
        .orderBy(desc(userCorrelations.confidence))
        .limit(10);

      correlations = correlationRows.map((c) => ({
        factor: c.factorA,
        symptom: c.factorB,
        direction: c.direction as 'positive' | 'negative',
        effectSizePct: c.effectSizePct ?? 0,
        confidence: c.confidence ?? 0,
        occurrences: c.occurrences ?? 0,
        totalOpportunities: c.totalOpportunities ?? 0,
      }));
    }

    // 9. Generate appointment questions
    const appointmentQuestions: string[] = [];

    if (topSymptoms.length > 0) {
      const topSymptom = topSymptoms[0];
      appointmentQuestions.push(
        `I've been experiencing ${topSymptom.name.replace(/_/g, ' ')} with an average severity of ${topSymptom.avgSeverity.toFixed(1)}/5, occurring ${topSymptom.frequency} times over the last ${days} days. The trend has been ${topSymptom.trend}. What management strategies would you recommend?`
      );
    }

    if (sleepData && sleepData.logsWithData > 0) {
      if (sleepData.avgHours < 6) {
        appointmentQuestions.push(
          `I'm averaging only ${sleepData.avgHours} hours of sleep per night. Are there any treatments or lifestyle changes that could help improve my sleep duration?`
        );
      } else if (sleepData.avgQuality === 'poor') {
        appointmentQuestions.push(
          `While I'm getting ${sleepData.avgHours} hours of sleep, the quality is often poor. What could be causing this and how can we address it?`
        );
      }
    }

    if (medicationData && medicationData.data.length > 0) {
      const lowAdherence = medicationData.data.filter(
        (m) => m.adherenceRate < 80
      );
      if (lowAdherence.length > 0) {
        appointmentQuestions.push(
          `I'm having difficulty maintaining consistent adherence with ${lowAdherence.map((m) => m.name).join(', ')}. Are there strategies to help me remember to take these, or alternatives available?`
        );
      }
    }

    if (correlations && correlations.length > 0) {
      const helpfulCorr = correlations.find((c) => c.direction === 'negative');
      if (helpfulCorr) {
        appointmentQuestions.push(
          `I've noticed that ${helpfulCorr.factor.replace(/_/g, ' ')} tends to reduce ${helpfulCorr.symptom.replace(/_/g, ' ')} in my tracking data. Should I prioritize this strategy?`
        );
      }

      const harmfulCorr = correlations.find((c) => c.direction === 'positive');
      if (harmfulCorr) {
        appointmentQuestions.push(
          `My data suggests ${harmfulCorr.factor.replace(/_/g, ' ')} worsens ${harmfulCorr.symptom.replace(/_/g, ' ')}. Should I try to avoid this trigger?`
        );
      }
    }

    if (moodData) {
      if (moodData.avgMood < 3) {
        appointmentQuestions.push(
          `My average mood score over the last ${days} days has been ${moodData.avgMood.toFixed(1)}/5. I'm concerned about my mental health. What resources or treatments would you recommend?`
        );
      }
    }

    // 10. Build response
    const response: DoctorReportResponse = {
      report: {
        generatedAt: new Date().toISOString(),
        dateRange: {
          start: startDateStr,
          end: endDateStr,
          days,
        },
        patient: {
          name: profile?.name || null,
          age,
          stage: profile?.stage || null,
        },
        summary: {
          totalCheckIns,
          avgReadiness: null, // Not computed from current data
          topSymptoms,
          overallTrend,
        },
        sections: {
          ...(sectionsParam.includes('symptoms') && {
            symptoms: {
              data: topSymptoms,
              notes: `Based on ${totalCheckIns} check-ins over ${days} days`,
            },
          }),
          ...(sleepData && { sleep: sleepData }),
          ...(medicationData && { medications: medicationData }),
          ...(moodData && { mood: moodData }),
          ...(correlations && { correlations }),
        },
        appointmentQuestions: appointmentQuestions.slice(0, 5),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[export/doctor-report] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate doctor report' },
      { status: 500 }
    );
  }
}
