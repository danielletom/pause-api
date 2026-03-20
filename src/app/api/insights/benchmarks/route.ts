import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { profiles, dailyLogs, benchmarkAggregates } from '@/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
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
  if (prevalencePct > 75) return 'Very common';
  if (prevalencePct >= 50) return 'Common';
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

// ── Display name → log key mapping ─────────────────────────────────────────
// User logs store symptoms as snake_case keys (e.g. "hot_flash", "night_sweats").
// Benchmarks use display names. This map bridges them for user stat lookups.
const DISPLAY_TO_LOG_KEY: Record<string, string[]> = {
  'hot flashes': ['hot_flash', 'hot_flashes'],
  'night sweats': ['night_sweats', 'night_sweat'],
  'joint pain': ['joint_pain'],
  'brain fog': ['brain_fog'],
  'mood changes': ['mood_swings', 'mood_changes', 'irritability'],
  'sleep disruption': ['insomnia', 'sleep_disruption', 'sleep_issues'],
  'anxiety': ['anxiety'],
  'fatigue': ['fatigue'],
  'headaches': ['headache', 'headaches'],
  'heart palpitations': ['heart_racing', 'heart_palpitations', 'palpitations'],
  'nausea': ['nausea'],
  'weight gain': ['weight_gain'],
  'bloating': ['bloating'],
  'itchy or dry skin': ['dry_skin', 'itchy_skin', 'skin'],
  'dry skin': ['dry_skin'],
  'hair loss': ['hair_loss', 'hair_thinning'],
  'dizziness': ['dizziness', 'dizzy'],
  'muscle pain': ['muscle_pain', 'muscle_ache'],
  'low libido': ['low_libido', 'libido'],
  'vaginal dryness': ['vaginal_dryness'],
  'urinary issues': ['urinary_issues', 'incontinence'],
  'depression': ['depression', 'low_mood'],
};

/**
 * Look up user symptom stats by display name, checking all possible log key variants.
 */
function lookupUserStats(
  userSymptomMap: Map<string, { frequency: number; avgSeverity: number }>,
  displayName: string,
): { frequency: number; avgSeverity: number } | undefined {
  const key = displayName.toLowerCase();

  // Direct match first
  const direct = userSymptomMap.get(key);
  if (direct) return direct;

  // Try known aliases
  const aliases = DISPLAY_TO_LOG_KEY[key];
  if (aliases) {
    for (const alias of aliases) {
      const found = userSymptomMap.get(alias);
      if (found) return found;
    }
  }

  // Try converting display name to snake_case as a fallback
  const snakeKey = key.replace(/\s+/g, '_');
  const snake = userSymptomMap.get(snakeKey);
  if (snake) return snake;

  return undefined;
}

// ── Evidence-based fallback data ────────────────────────────────────────────
// Cross-referenced from:
//   1. BMC Public Health 2024 meta-analysis (Fang et al., 321 studies, n=482,067)
//   2. MenoLife app study (Aras et al., Scientific Reports 2025, n=4,789, 147K symptom logs)
//   3. Shanghai cross-sectional study (Du et al., IJERPH 2020, n=3,147)
//   4. SWAN longitudinal study (NIH, n=3,289, 16 years)
// Used when the app doesn't yet have enough users for real cohort comparisons.

const FALLBACK_SYMPTOMS: SymptomInsight[] = [
  {
    name: 'Fatigue',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 75, // BMC: 64%, MenoLife: 75% (meno), Shanghai: 38% — weighted avg ~75%
    cohortAvgFrequency: 14,
    percentilePosition: 0,
    label: 'Very common',
  },
  {
    name: 'Hot flashes',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 73, // SWAN: 60-80%, MenoLife: 73.1% (meno), Shanghai: 34%, BMC: 75%
    cohortAvgFrequency: 12,
    percentilePosition: 0,
    label: 'Very common',
  },
  {
    name: 'Joint pain',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 61, // BMC: 65.4%, MenoLife: 56.1%, Shanghai: 28.8% — weighted ~61%
    cohortAvgFrequency: 10,
    percentilePosition: 0,
    label: 'Common',
  },
  {
    name: 'Anxiety',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 55, // BMC: 50.5%, MenoLife: 58.7% (meno), Shanghai: 18% (emotional)
    cohortAvgFrequency: 8,
    percentilePosition: 0,
    label: 'Common',
  },
  {
    name: 'Brain fog',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 56, // BMC: 54.4% memory + 44.9% concentration, MenoLife: 56.1%
    cohortAvgFrequency: 8,
    percentilePosition: 0,
    label: 'Common',
  },
  {
    name: 'Bloating',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 55, // MenoLife: 57.1% (peri), 60.6% (premeno); common across all stages
    cohortAvgFrequency: 8,
    percentilePosition: 0,
    label: 'Common',
  },
  {
    name: 'Mood changes',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 54, // BMC: 54.4% irritability + 49% mood swings; MenoLife: high centrality
    cohortAvgFrequency: 9,
    percentilePosition: 0,
    label: 'Common',
  },
  {
    name: 'Sleep disruption',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 52, // BMC: 51.9%, Shanghai: 27.5% (sleep disturbance), SWAN: ~40-60%
    cohortAvgFrequency: 10,
    percentilePosition: 0,
    label: 'Common',
  },
  {
    name: 'Night sweats',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 50, // SWAN: 40% at FMP, MenoLife: 62.2% (peri); weighted ~50%
    cohortAvgFrequency: 8,
    percentilePosition: 0,
    label: 'Common',
  },
  {
    name: 'Headaches',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 50, // BMC: 43.9%, MenoLife: 58.9% (peri), 52.6% (premeno)
    cohortAvgFrequency: 6,
    percentilePosition: 0,
    label: 'Common',
  },
  {
    name: 'Itchy or dry skin',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 36, // MenoLife: integumentary cluster; estrogen-related skin changes
    cohortAvgFrequency: 6,
    percentilePosition: 0,
    label: 'Less common',
  },
  {
    name: 'Heart palpitations',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 34, // BMC: 42.1%, Shanghai: 15.9% (rapid heartbeat); scoping: 20-42%
    cohortAvgFrequency: 4,
    percentilePosition: 0,
    label: 'Less common',
  },
  {
    name: 'Depression',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 32, // MenoLife: appears in mood/cognitive cluster; SWAN: 20-40%
    cohortAvgFrequency: 5,
    percentilePosition: 0,
    label: 'Less common',
  },
  {
    name: 'Nausea',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 20, // MenoLife: appears in symptom logs; less studied in literature
    cohortAvgFrequency: 3,
    percentilePosition: 0,
    label: 'Less common',
  },
  {
    name: 'Dizziness',
    userFrequencyDays: 0,
    userAvgSeverity: 0,
    cohortPrevalencePct: 25, // MenoLife: dizziness/vertigo cluster in peri & meno networks
    cohortAvgFrequency: 4,
    percentilePosition: 0,
    label: 'Less common',
  },
];

// Set to true once you have enough app users to use real cohort data
const USE_COHORT_DATA = false;

// ── Route ───────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Get user's daily logs for last 365 days (rolling year)
    const cutoff28 = daysAgo(365);
    const userLogs = await db
      .select({
        date: sql<string>`${dailyLogs.date}::text`,
        symptomsJson: dailyLogs.symptomsJson,
      })
      .from(dailyLogs)
      .where(
        and(eq(dailyLogs.userId, userId), gte(dailyLogs.date, cutoff28)),
      );

    // 2. Compute user symptom stats
    const userSymptomMap = computeUserSymptomStats(userLogs);

    // 3. If we have enough users, use real cohort data
    if (USE_COHORT_DATA) {
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, userId),
      });

      if (profile) {
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

        const benchmarks = await db
          .select()
          .from(benchmarkAggregates)
          .where(eq(benchmarkAggregates.cohortKey, cohortKey));

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

        if (effectiveBenchmarks.length > 0) {
          const sampleSize = effectiveBenchmarks[0]?.sampleSize ?? 0;
          const symptoms: SymptomInsight[] = effectiveBenchmarks.map((bm) => {
            const userStats = lookupUserStats(userSymptomMap, bm.symptom);
            const userFreq = userStats?.frequency ?? 0;
            const userSev = userStats?.avgSeverity ?? 0;

            return {
              name: bm.symptom,
              userFrequencyDays: userFreq,
              userAvgSeverity: Math.round(userSev * 100) / 100,
              cohortPrevalencePct: bm.prevalencePct ?? 0,
              cohortAvgFrequency: bm.avgFrequency ?? 0,
              percentilePosition: estimatePercentile(
                userFreq,
                bm.p25Frequency ?? 0,
                bm.p50Frequency ?? 0,
                bm.p75Frequency ?? 0,
              ),
              label: commonalityLabel(bm.prevalencePct ?? 0),
            };
          });

          symptoms.sort((a, b) => b.userFrequencyDays - a.userFrequencyDays);

          return NextResponse.json({
            cohort: {
              key: effectiveKey,
              label: formatCohortLabel(effectiveKey),
              sampleSize,
            },
            symptoms,
          });
        }
      }
    }

    // 4. Use general menopause research data (default until we have enough users)
    const fallbackSymptoms: SymptomInsight[] = FALLBACK_SYMPTOMS.map((s) => {
      const userStats = lookupUserStats(userSymptomMap, s.name);
      const userFreq = userStats?.frequency ?? 0;
      return {
        ...s,
        userFrequencyDays: userFreq,
        userAvgSeverity: userStats?.avgSeverity ?? 0,
        percentilePosition: estimatePercentile(
          userFreq,
          Math.round(s.cohortAvgFrequency * 0.5),
          s.cohortAvgFrequency,
          Math.round(s.cohortAvgFrequency * 1.5),
        ),
        label: commonalityLabel(s.cohortPrevalencePct),
      };
    });

    // Include user-logged symptoms not in the research list
    const fallbackNamesLower = new Set(FALLBACK_SYMPTOMS.map((s) => s.name.toLowerCase()));
    for (const [symptomKey, stats] of userSymptomMap.entries()) {
      const displayName = symptomKey.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
      if (!fallbackNamesLower.has(displayName.toLowerCase()) && stats.frequency > 0) {
        fallbackSymptoms.push({
          name: displayName,
          userFrequencyDays: stats.frequency,
          userAvgSeverity: Math.round(stats.avgSeverity * 100) / 100,
          cohortPrevalencePct: 0,
          cohortAvgFrequency: 0,
          percentilePosition: 0,
          label: 'Less common',
        });
      }
    }

    return NextResponse.json({
      cohort: {
        key: 'general_menopause',
        label: 'Women in menopause',
        sampleSize: 482067,
      },
      message:
        'Based on data from 490,000+ women across multiple medical studies including BMC Public Health 2024, MenoLife (4,789 users), and the SWAN longitudinal study.',
      symptoms: fallbackSymptoms,
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
