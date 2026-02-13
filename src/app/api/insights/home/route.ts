import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import {
  dailyLogs,
  computedScores,
  medications,
  medLogs,
  userCorrelations,
  narratives,
} from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { computeScoresForUser, computeStreak } from '@/lib/compute-scores';

// ── Types ───────────────────────────────────────────────────────────────────

interface SymptomEntry {
  name: string;
  severity: number;
}

interface HomeResponse {
  readiness: number | null;
  readinessComponents: Record<string, number> | null;
  streak: number;
  symptomSummary: { name: string; severity: number }[];
  insightNudge: { title: string; body: string } | null;
  medsToday: {
    id: number;
    name: string;
    dose: string | null;
    time: string | null;
    taken: boolean;
  }[];
  recommendation: string | null;
  narrative: string | null;
}

// ── Route Handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Parse optional date query param, default to today
    const { searchParams } = new URL(request.url);
    const date =
      searchParams.get('date') || new Date().toISOString().split('T')[0]!;

    // 1. Get or compute readiness scores
    let readiness: number | null = null;
    let readinessComponents: Record<string, number> | null = null;
    let recommendation: string | null = null;

    const scoreRows = await db
      .select()
      .from(computedScores)
      .where(
        and(eq(computedScores.userId, userId), eq(computedScores.date, date))
      );

    if (scoreRows.length > 0) {
      const row = scoreRows[0]!;
      readiness = row.readiness;
      readinessComponents = row.componentsJson as Record<string, number> | null;
      recommendation = row.recommendation;
    } else {
      // Compute on-demand if no pre-computed score exists
      const computed = await computeScoresForUser(userId, date);
      readiness = computed.readiness;
      readinessComponents = computed.components as Record<
        string,
        number
      > | null;
    }

    // 2. Get daily logs for symptom summary
    const logs = await db
      .select()
      .from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)));

    // Build symptom summary: merge all symptoms, deduplicate, sort by severity
    const symptomMap = new Map<string, number>();
    for (const log of logs) {
      const symptoms = log.symptomsJson as SymptomEntry[] | null;
      if (Array.isArray(symptoms)) {
        for (const s of symptoms) {
          const existing = symptomMap.get(s.name);
          if (existing == null || s.severity > existing) {
            symptomMap.set(s.name, s.severity);
          }
        }
      }
    }
    const symptomSummary = Array.from(symptomMap.entries())
      .map(([name, severity]) => ({ name, severity }))
      .sort((a, b) => b.severity - a.severity);

    // 3. Get active medications + today's med logs -> build checklist
    const activeMeds = await db
      .select()
      .from(medications)
      .where(
        and(eq(medications.userId, userId), eq(medications.active, true))
      );

    const todayMedLogs = await db
      .select()
      .from(medLogs)
      .where(and(eq(medLogs.userId, userId), eq(medLogs.date, date)));

    const takenMedIds = new Set(
      todayMedLogs.filter((ml) => ml.taken).map((ml) => ml.medicationId)
    );

    const medsToday = activeMeds.map((med) => ({
      id: med.id,
      name: med.name,
      dose: med.dose,
      time: med.time,
      taken: takenMedIds.has(med.id),
    }));

    // 4. Get top user correlation for insight nudge
    let insightNudge: { title: string; body: string } | null = null;

    const correlationRows = await db
      .select()
      .from(userCorrelations)
      .where(eq(userCorrelations.userId, userId))
      .orderBy(desc(userCorrelations.confidence))
      .limit(1);

    if (correlationRows.length > 0) {
      const c = correlationRows[0]!;
      const lagText = c.lagDays === 1 ? '1 day' : `${c.lagDays ?? 0} day(s)`;
      insightNudge = {
        title: 'Pattern detected',
        body: `Your ${c.factorB} gets worse ${lagText} after ${c.factorA}. We saw this ${c.occurrences} out of ${c.totalOpportunities} times.`,
      };
    } else {
      // Fallback: streak-based message
      const streak = await computeStreak(userId);
      if (streak >= 7) {
        insightNudge = {
          title: 'Keep it going!',
          body: `You've logged ${streak} days in a row. Patterns start emerging after 14 days of data.`,
        };
      } else if (streak >= 3) {
        insightNudge = {
          title: 'Building momentum',
          body: `${streak}-day streak! Keep logging daily so we can find your patterns.`,
        };
      } else if (streak >= 1) {
        insightNudge = {
          title: 'Getting started',
          body: 'Log daily to help us find patterns in your symptoms. It takes about 2 weeks to see insights.',
        };
      }
    }

    // 5. Get latest weekly story narrative
    let narrativeText: string | null = null;

    const narrativeRows = await db
      .select()
      .from(narratives)
      .where(
        and(eq(narratives.userId, userId), eq(narratives.type, 'weekly_story'))
      )
      .orderBy(desc(narratives.date))
      .limit(1);

    if (narrativeRows.length > 0) {
      narrativeText = narrativeRows[0]!.text;
    }

    // 6. Get streak
    const streak = await computeStreak(userId);

    // 7. Build response
    const response: HomeResponse = {
      readiness,
      readinessComponents,
      streak,
      symptomSummary,
      insightNudge,
      medsToday,
      recommendation,
      narrative: narrativeText,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[insights/home] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load home insights' },
      { status: 500 }
    );
  }
}
