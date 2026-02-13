import { db } from '@/db';
import { profiles, dailyLogs, benchmarkAggregates } from '@/db/schema';
import { eq, and, gte } from 'drizzle-orm';

// ── Types ───────────────────────────────────────────────────────────────────

type SymptomsJson = Record<string, number>;

interface UserContext {
  userId: string;
  cohortKey: string;
  logs: { date: string; symptomsJson: SymptomsJson }[];
}

// ── Stage normalisation ─────────────────────────────────────────────────────

function normaliseStage(raw: string | null): string {
  if (!raw) return 'unknown';
  const lower = raw.toLowerCase().trim();

  if (lower.includes('post')) return 'postmenopause';
  // check 'post' before 'peri' so "postmenopause" isn't caught by peri prefix
  if (lower.startsWith('peri') || lower === 'perimenopause') return 'perimenopause';
  if (lower === 'menopause' || lower === 'meno') return 'menopause';
  if (
    lower === "i'm not sure" ||
    lower === 'not_sure' ||
    lower === 'not sure' ||
    lower === 'unknown'
  ) {
    return 'unknown';
  }

  return 'unknown';
}

// ── Age bucket ──────────────────────────────────────────────────────────────

function ageBucket(dateOfBirth: string | null): string {
  if (!dateOfBirth) return 'unknown_age';

  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return 'unknown_age';

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  if (age < 40) return 'under_40';
  if (age < 45) return '40-44';
  if (age < 50) return '45-49';
  if (age < 55) return '50-54';
  if (age < 60) return '55-59';
  return '60_plus';
}

// ── Severity tier ───────────────────────────────────────────────────────────

function severityTier(avgSeverity: number): string {
  if (avgSeverity < 1.5) return 'mild';
  if (avgSeverity <= 2.5) return 'moderate';
  return 'severe';
}

// ── Public: build a cohort key ──────────────────────────────────────────────

export function buildCohortKey(
  stage: string | null,
  dateOfBirth: string | null,
  avgSeverity: number,
): string {
  const s = normaliseStage(stage);
  const a = ageBucket(dateOfBirth);
  const sev = severityTier(avgSeverity);
  return `${s}_${a}_${sev}`;
}

// ── Percentile helpers ──────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

// ── Helpers for date math ───────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// ── Compute avg severity for a user across their 28-day logs ────────────────

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

// ── Core aggregation ────────────────────────────────────────────────────────

interface CohortStats {
  cohortKey: string;
  sampleSize: number;
  symptomRows: {
    symptom: string;
    prevalencePct: number;
    avgFrequency: number;
    avgSeverity: number;
    p25Frequency: number;
    p50Frequency: number;
    p75Frequency: number;
    sampleSize: number;
  }[];
}

function computeCohortStats(
  cohortKey: string,
  users: UserContext[],
): CohortStats {
  const sampleSize = users.length;

  // Collect all unique symptoms across the cohort (from 90-day logs already filtered)
  const allSymptoms = new Set<string>();
  for (const user of users) {
    for (const log of user.logs) {
      if (log.symptomsJson && typeof log.symptomsJson === 'object') {
        for (const key of Object.keys(log.symptomsJson)) {
          allSymptoms.add(key);
        }
      }
    }
  }

  const last28d = daysAgo(28);
  const symptomRows: CohortStats['symptomRows'] = [];

  for (const symptom of allSymptoms) {
    // Per-user stats for this symptom (using 28-day window for prevalence/frequency)
    const userFrequencies: number[] = [];
    const userSeverities: number[] = [];
    let usersWithSymptom = 0;

    for (const user of users) {
      const recentLogs = user.logs.filter((l) => l.date >= last28d);
      // Deduplicate by date — use the max severity per day
      const dayMap = new Map<string, number>();
      for (const log of recentLogs) {
        if (
          log.symptomsJson &&
          typeof log.symptomsJson === 'object' &&
          symptom in log.symptomsJson
        ) {
          const sev = (log.symptomsJson as SymptomsJson)[symptom];
          const existing = dayMap.get(log.date);
          if (existing === undefined || sev > existing) {
            dayMap.set(log.date, sev);
          }
        }
      }

      const daysLogged = dayMap.size;
      if (daysLogged > 0) {
        usersWithSymptom++;
        userFrequencies.push(daysLogged);
        const severities = Array.from(dayMap.values());
        const avgSev =
          severities.reduce((a, b) => a + b, 0) / severities.length;
        userSeverities.push(avgSev);
      } else {
        // User did not log this symptom — counts as 0 frequency for percentile calc
        userFrequencies.push(0);
      }
    }

    if (usersWithSymptom === 0) continue;

    const prevalencePct = (usersWithSymptom / sampleSize) * 100;
    const avgFrequency =
      userFrequencies.reduce((a, b) => a + b, 0) / sampleSize;
    const avgSeverity =
      userSeverities.length > 0
        ? userSeverities.reduce((a, b) => a + b, 0) / userSeverities.length
        : 0;

    const sorted = [...userFrequencies].sort((a, b) => a - b);
    const p25 = percentile(sorted, 25);
    const p50 = percentile(sorted, 50);
    const p75 = percentile(sorted, 75);

    symptomRows.push({
      symptom,
      prevalencePct: Math.round(prevalencePct * 10) / 10,
      avgFrequency: Math.round(avgFrequency * 100) / 100,
      avgSeverity: Math.round(avgSeverity * 100) / 100,
      p25Frequency: Math.round(p25 * 100) / 100,
      p50Frequency: Math.round(p50 * 100) / 100,
      p75Frequency: Math.round(p75 * 100) / 100,
      sampleSize,
    });
  }

  return { cohortKey, sampleSize, symptomRows };
}

// ── Public: run full benchmark computation ──────────────────────────────────

const MIN_COHORT_SIZE = 50;

export async function computeAllBenchmarks(): Promise<{
  cohorts: number;
  errors: number;
}> {
  let cohortsProcessed = 0;
  let errors = 0;

  try {
    // 1. Get all profiles with onboarding complete
    const allProfiles = await db
      .select({
        userId: profiles.userId,
        stage: profiles.stage,
        dateOfBirth: profiles.dateOfBirth,
      })
      .from(profiles)
      .where(eq(profiles.onboardingComplete, true));

    if (allProfiles.length === 0) {
      return { cohorts: 0, errors: 0 };
    }

    // 2. Get all daily logs for last 90 days
    const cutoff90 = daysAgo(90);
    const cutoff28 = daysAgo(28);

    const allLogs = await db
      .select({
        userId: dailyLogs.userId,
        date: dailyLogs.date,
        symptomsJson: dailyLogs.symptomsJson,
      })
      .from(dailyLogs)
      .where(gte(dailyLogs.date, cutoff90));

    // Index logs by userId
    const logsByUser = new Map<
      string,
      { date: string; symptomsJson: SymptomsJson }[]
    >();
    for (const log of allLogs) {
      const existing = logsByUser.get(log.userId) || [];
      existing.push({
        date: log.date,
        symptomsJson: (log.symptomsJson as SymptomsJson) || {},
      });
      logsByUser.set(log.userId, existing);
    }

    // 3. Compute avg severity per user (28-day window) and build cohort key
    const userContexts: UserContext[] = [];
    for (const profile of allProfiles) {
      const userLogs = logsByUser.get(profile.userId) || [];
      const recentLogs = userLogs.filter((l) => l.date >= cutoff28);
      const avgSev = computeUserAvgSeverity(
        recentLogs.map((l) => ({ symptomsJson: l.symptomsJson })),
      );
      const cohortKey = buildCohortKey(
        profile.stage,
        profile.dateOfBirth,
        avgSev,
      );

      userContexts.push({
        userId: profile.userId,
        cohortKey,
        logs: userLogs, // full 90-day logs for symptom discovery
      });
    }

    // 4. Group users by cohort key
    const cohortMap = new Map<string, UserContext[]>();
    for (const ctx of userContexts) {
      const existing = cohortMap.get(ctx.cohortKey) || [];
      existing.push(ctx);
      cohortMap.set(ctx.cohortKey, existing);
    }

    // 5. Also build a map without severity suffix for widening fallback
    // e.g. "perimenopause_40-44" -> all users regardless of severity
    const widenedMap = new Map<string, UserContext[]>();
    for (const ctx of userContexts) {
      const parts = ctx.cohortKey.split('_');
      // Remove the last part (severity tier)
      const widenedKey = parts.slice(0, -1).join('_');
      const existing = widenedMap.get(widenedKey) || [];
      existing.push(ctx);
      widenedMap.set(widenedKey, existing);
    }

    // 6. Process each cohort
    const processedKeys = new Set<string>();

    for (const [cohortKey, users] of cohortMap.entries()) {
      try {
        let effectiveKey = cohortKey;
        let effectiveUsers = users;

        if (users.length < MIN_COHORT_SIZE) {
          // Try widening: remove severity
          const parts = cohortKey.split('_');
          const widenedKey = parts.slice(0, -1).join('_');
          const widenedUsers = widenedMap.get(widenedKey);

          if (widenedUsers && widenedUsers.length >= MIN_COHORT_SIZE) {
            // Use widened key but only if we haven't already processed it
            effectiveKey = widenedKey;
            effectiveUsers = widenedUsers;
          } else {
            // Still too small — skip
            continue;
          }
        }

        // Skip if we already processed this effective key
        if (processedKeys.has(effectiveKey)) continue;
        processedKeys.add(effectiveKey);

        const stats = computeCohortStats(effectiveKey, effectiveUsers);

        // Delete old rows for this cohort
        await db
          .delete(benchmarkAggregates)
          .where(eq(benchmarkAggregates.cohortKey, effectiveKey));

        // Insert new rows
        if (stats.symptomRows.length > 0) {
          await db.insert(benchmarkAggregates).values(
            stats.symptomRows.map((row) => ({
              cohortKey: effectiveKey,
              symptom: row.symptom,
              prevalencePct: row.prevalencePct,
              avgFrequency: row.avgFrequency,
              avgSeverity: row.avgSeverity,
              p25Frequency: row.p25Frequency,
              p50Frequency: row.p50Frequency,
              p75Frequency: row.p75Frequency,
              sampleSize: row.sampleSize,
            })),
          );
        }

        cohortsProcessed++;
      } catch (err) {
        console.error(`Error processing cohort ${cohortKey}:`, err);
        errors++;
      }
    }
  } catch (err) {
    console.error('Fatal error in computeAllBenchmarks:', err);
    errors++;
  }

  return { cohorts: cohortsProcessed, errors };
}
