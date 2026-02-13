import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { profiles, dailyLogs, benchmarkAggregates } from '@/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { buildCohortKey } from '@/lib/compute-benchmarks';

// ── Types ───────────────────────────────────────────────────────────────────

type SymptomsJson = Record<string, number>;

interface SymptomInsight {
  name: string;
  userFrequencyDays: number;
  userAvgSeverity: number;
  cohortPrevalencePct: number;
  cohortAvgFrequency: number;
  percentilePosition: number;
  label: 'Very common' | 'Common' | 'Less common';
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function computeUserAvgSeverity(
  logs: { symptomsJson: SymptomsJson | null }[],
): number {
  let totalSeverity = 0;
  let count = 0;

  for (const log of logs) {
    if (!log.symptomsJson || typeof log.symptomsJson !== 'object') continue;
    const symptoms = log.symptomsJson as SymptomsJson;
    for (const val of Object.values(symptoms)) {
      if (typeof val === 'number') {
        totalSeverity += val;
        count++;
      }
    }
  }

  if (count === 0) return 2; // default moderate
  return totalSeverity / count;
}

/**
 * Estimate user's percentile position using linear interpolation
 * against p25/p50/p75 from the benchmark data.
 */
function estimatePercentile(
  userFrequency: number,
  p25: number,
  p50: number,
  p75: number,
): number {
  if (userFrequency <= 0) return 0;

  // Linear interpolation between known percentile anchors
  if (userFrequency <= p25) {
    if (p25 === 0) return 25;
    return Math.round((userFrequency / p25) * 25);
  }
  if (userFrequency <= p50) {
    if (p50 === p25) return 50;
    return Math.round(25 + ((userFrequency - p25) / (p50 - p25)) * 25);
  }
  if (userFrequency <= p75) {
    if (p75 === p50) return 75;
    return Math.round(50 + ((userFrequency - p50) / (p75 - p50)) * 25);
  }

  // Above p75 — extrapolate towards 100, cap at 99
  if (p75 === 0) return 99;
  const extra = ((userFrequency - p75) / p75) * 25;
  return Math.min(99, Math.round(75 + extra));
}

function commonalityLabel(
  prevalencePct: number,
): 'Very common' | 'Common' | 'Less common' {
  if (prevalencePct >= 70) return 'Very common';
  if (prevalencePct >= 40) return 'Common';
  return 'Less common';
}

function formatCohortLabel(key: string): string {
  const parts = key.split('_');
  const formatted = parts.map((p) => {
    if (p === 'unknown') return 'All stages';
    if (p === 'unknown_age' || p === 'unknownage') return 'All ages';
    return p.charAt(0).toUpperCase() + p.slice(1);
  });
  return formatted.join(', ');
}

// ── Hardcoded fallback data ─────────────────────────────────────────────────

const FALLBACK_SYMPTOMS: SymptomInsight[] = [
  {
    name: 'Hot flashes',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 80,
    cohortAvgFrequency: 12,
    percentilePosition: 0,
    label: 'Very common',
  },
  {
    name: 'Night sweats',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 70,
    cohortAvgFrequency: 8,
    percentilePosition: 0,
    label: 'Very common',
  },
  {
    name: 'Sleep disruption',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 65,
    cohortAvgFrequency: 10,
    percentilePosition: 0,
    label: 'Common',
  },
  {
    name: 'Mood changes',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 60,
    cohortAvgFrequency: 9,
    percentilePosition: 0,
    label: 'Common',
  },
  {
    name: 'Brain fog',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 55,
    cohortAvgFrequency: 7,
    percentilePosition: 0,
    label: 'Common',
  },
  {
    name: 'Joint pain',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 50,
    cohortAvgFrequency: 8,
    percentilePosition: 0,
    label: 'Common',
  },
  {
    name: 'Fatigue',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 72,
    cohortAvgFrequency: 14,
    percentilePosition: 0,
    label: 'Very common',
  },
  {
    name: 'Anxiety',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 45,
    cohortAvgFrequency: 6,
    percentilePosition: 0,
    label: 'Common',
  },
];

// ── Route ───────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Get the user's profile
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 2. Get user's daily logs for last 28 days
    const cutoff28 = daysAgo(28);
    const userLogs = await db
      .select({
        date: dailyLogs.date,
        symptomsJson: dailyLogs.symptomsJson,
      })
      .from(dailyLogs)
      .where(
        and(eq(dailyLogs.userId, userId), gte(dailyLogs.date, cutoff28)),
      );

    // 3. Compute user's avg severity and cohort key
    const avgSeverity = computeUserAvgSeverity(
      userLogs.map((l) => ({
        symptomsJson: l.symptomsJson as SymptomsJson | null,
      })),
    );
    const cohortKey = buildCohortKey(
      profile.stage,
      profile.dateOfBirth,
      avgSeverity,
    );

    // 4. Get benchmark data for this cohort
    const benchmarks = await db
      .select()
      .from(benchmarkAggregates)
      .where(eq(benchmarkAggregates.cohortKey, cohortKey));

    // If no benchmarks, try widened key (without severity)
    let effectiveBenchmarks = benchmarks;
    let effectiveKey = cohortKey;

    if (benchmarks.length === 0) {
      const parts = cohortKey.split('_');
      const widenedKey = parts.slice(0, -1).join('_');
      const widenedBenchmarks = await db
        .select()
        .from(benchmarkAggregates)
        .where(eq(benchmarkAggregates.cohortKey, widenedKey));

      if (widenedBenchmarks.length > 0) {
        effectiveBenchmarks = widenedBenchmarks;
        effectiveKey = widenedKey;
      }
    }

    // 5. If still no data, return fallback
    if (effectiveBenchmarks.length === 0) {
      // Compute user's own symptom stats for the fallback response
      const userSymptomMap = computeUserSymptomStats(userLogs);
      const fallbackSymptoms = FALLBACK_SYMPTOMS.map((s) => {
        const userStats = userSymptomMap.get(s.name.toLowerCase());
        return {
          ...s,
          userFrequencyDays: userStats?.frequency ?? 0,
          userAvgSeverity: userStats?.avgSeverity ?? 0,
        };
      });

      return NextResponse.json({
        cohort: {
          key: cohortKey,
          label: formatCohortLabel(cohortKey),
          sampleSize: 0,
        },
        message:
          'Not enough data for your specific cohort yet. Showing general population benchmarks. As more users join, your comparisons will become more personalised.',
        symptoms: fallbackSymptoms,
      });
    }

    // 6. Compute per-symptom user stats
    const userSymptomMap = computeUserSymptomStats(userLogs);

    // 7. Build response for each benchmarked symptom
    const sampleSize = effectiveBenchmarks[0]?.sampleSize ?? 0;
    const symptoms: SymptomInsight[] = effectiveBenchmarks.map((bm) => {
      const userStats = userSymptomMap.get(bm.symptom.toLowerCase());
      const userFreq = userStats?.frequency ?? 0;
      const userSev = userStats?.avgSeverity ?? 0;

      const pctPosition = estimatePercentile(
        userFreq,
        bm.p25Frequency ?? 0,
        bm.p50Frequency ?? 0,
        bm.p75Frequency ?? 0,
      );

      return {
        name: bm.symptom,
        userFrequencyDays: userFreq,
        userAvgSeverity: Math.round(userSev * 100) / 100,
        cohortPrevalencePct: bm.prevalencePct ?? 0,
        cohortAvgFrequency: bm.avgFrequency ?? 0,
        percentilePosition: pctPosition,
        label: commonalityLabel(bm.prevalencePct ?? 0),
      };
    });

    // Sort by user frequency descending so their most-experienced symptoms come first
    symptoms.sort((a, b) => b.userFrequencyDays - a.userFrequencyDays);

    return NextResponse.json({
      cohort: {
        key: effectiveKey,
        label: formatCohortLabel(effectiveKey),
        sampleSize,
      },
      symptoms,
    });
  } catch (err) {
    console.error('Benchmarks insights error:', err);
    return NextResponse.json(
      { error: 'Failed to compute insights' },
      { status: 500 },
    );
  }
}

// ── User symptom stats from 28-day logs ─────────────────────────────────────

function computeUserSymptomStats(
  logs: { date: string; symptomsJson: unknown }[],
): Map<string, { frequency: number; avgSeverity: number }> {
  // For each symptom, track unique days and severities
  const symptomDays = new Map<string, Map<string, number>>(); // symptom -> (date -> max severity)

  for (const log of logs) {
    if (!log.symptomsJson || typeof log.symptomsJson !== 'object') continue;
    const symptoms = log.symptomsJson as SymptomsJson;

    for (const [name, severity] of Object.entries(symptoms)) {
      if (typeof severity !== 'number') continue;
      const lowerName = name.toLowerCase();

      if (!symptomDays.has(lowerName)) {
        symptomDays.set(lowerName, new Map());
      }
      const dayMap = symptomDays.get(lowerName)!;
      const existing = dayMap.get(log.date);
      if (existing === undefined || severity > existing) {
        dayMap.set(log.date, severity);
      }
    }
  }

  const result = new Map<string, { frequency: number; avgSeverity: number }>();
  for (const [symptom, dayMap] of symptomDays.entries()) {
    const severities = Array.from(dayMap.values());
    const frequency = severities.length;
    const avgSeverity =
      severities.reduce((a, b) => a + b, 0) / severities.length;
    result.set(symptom, { frequency, avgSeverity });
  }

  return result;
}
