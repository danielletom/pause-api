import { db } from '@/db';
import {
  dailyLogs,
  medLogs,
  medications,
  userCorrelations,
} from '@/db/schema';
import { eq, sql, and, gte, countDistinct } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DayVector {
  factors: Record<string, boolean>;
  symptoms: Record<string, boolean>;
}

interface CorrelationResult {
  factorA: string;
  factorB: string;
  direction: 'positive' | 'negative';
  confidence: number;
  effectSizePct: number;
  occurrences: number;
  totalOpportunities: number;
  lagDays: number;
}

// ---------------------------------------------------------------------------
// Helpers — factor extraction
// ---------------------------------------------------------------------------

const EXERCISE_TAGS = ['exercise', 'workout'];
const STRESS_TAGS = ['stress', 'stressful'];
const SOCIAL_TAGS = ['social', 'friends', 'family'];

function tagsIncludeAny(
  tags: string[] | null | undefined,
  needles: string[],
): boolean {
  if (!tags || !Array.isArray(tags)) return false;
  const lower = tags.map((t) => t.toLowerCase());
  return needles.some((n) => lower.includes(n));
}

function tagsInclude(
  tags: string[] | null | undefined,
  needle: string,
): boolean {
  return tagsIncludeAny(tags, [needle]);
}

// ---------------------------------------------------------------------------
// Build per-day vectors
// ---------------------------------------------------------------------------

function buildDayVectors(
  logs: {
    date: string;
    symptomsJson: Record<string, number> | null;
    sleepHours: number | null;
    sleepQuality: string | null;
    disruptions: number | null;
    contextTags: string[] | null;
    cycleDataJson: { status?: string; flow?: string } | null;
    logType: string | null;
  }[],
  medLogRows: {
    date: string;
    medicationName: string;
    taken: boolean;
  }[],
): Map<string, DayVector> {
  const dayMap = new Map<string, DayVector>();

  const ensureDay = (dateStr: string): DayVector => {
    if (!dayMap.has(dateStr)) {
      dayMap.set(dateStr, { factors: {}, symptoms: {} });
    }
    return dayMap.get(dateStr)!;
  };

  // Process daily logs
  for (const log of logs) {
    const dateStr = log.date;
    const day = ensureDay(dateStr);

    // Sleep factors (from morning logs, but we accept any log with sleep data)
    if (log.sleepHours != null) {
      if (log.sleepHours < 6) day.factors['sleep_under_6h'] = true;
      if (log.sleepHours >= 7) day.factors['sleep_over_7h'] = true;
    }

    // Context-tag factors
    const tags = log.contextTags;
    if (tagsIncludeAny(tags, EXERCISE_TAGS)) day.factors['exercised'] = true;
    if (tagsInclude(tags, 'alcohol')) day.factors['alcohol'] = true;
    if (tagsInclude(tags, 'caffeine')) day.factors['caffeine'] = true;
    if (tagsIncludeAny(tags, STRESS_TAGS)) day.factors['high_stress'] = true;
    if (tagsIncludeAny(tags, SOCIAL_TAGS))
      day.factors['social_activity'] = true;

    // Cycle data
    const cycleData = log.cycleDataJson as
      | { status?: string; flow?: string }
      | null
      | undefined;
    if (cycleData?.status === 'period') day.factors['period_day'] = true;

    // Symptoms — present if severity > 0
    const symptoms = log.symptomsJson as Record<string, number> | null;
    if (symptoms && typeof symptoms === 'object') {
      for (const [symptomName, severity] of Object.entries(symptoms)) {
        if (typeof severity === 'number' && severity > 0) {
          day.symptoms[symptomName] = true;
        }
      }
    }
  }

  // Process medication logs
  for (const ml of medLogRows) {
    const dateStr = ml.date;
    const day = ensureDay(dateStr);
    if (ml.taken) {
      const factorKey = `med_${ml.medicationName}`;
      day.factors[factorKey] = true;
    }
  }

  return dayMap;
}

// ---------------------------------------------------------------------------
// Cross-correlation engine
// ---------------------------------------------------------------------------

function computeCrossCorrelations(
  dayMap: Map<string, DayVector>,
): CorrelationResult[] {
  // Collect all factor and symptom names across all days
  const allFactors = new Set<string>();
  const allSymptoms = new Set<string>();

  for (const dv of dayMap.values()) {
    for (const f of Object.keys(dv.factors)) allFactors.add(f);
    for (const s of Object.keys(dv.symptoms)) allSymptoms.add(s);
  }

  // Sort dates for lag computation
  const sortedDates = Array.from(dayMap.keys()).sort();
  const dateIndex = new Map<string, number>();
  for (let i = 0; i < sortedDates.length; i++) {
    dateIndex.set(sortedDates[i], i);
  }

  // Helper: advance a date string by N days
  const addDays = (dateStr: string, n: number): string => {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const results: CorrelationResult[] = [];

  for (const factor of allFactors) {
    for (const symptom of allSymptoms) {
      let bestResult: CorrelationResult | null = null;
      let bestAbsEffect = -Infinity;

      for (const lag of [0, 1, 2, 3, 5, 7]) {
        let occurrences = 0;
        let totalOpportunities = 0;
        let symptomWithoutFactor = 0;
        let daysWithoutFactor = 0;

        for (const dateStr of sortedDates) {
          const day = dayMap.get(dateStr)!;
          const factorPresent = day.factors[factor] === true;
          const targetDateStr = addDays(dateStr, lag);
          const targetDay = dayMap.get(targetDateStr);

          if (factorPresent) {
            totalOpportunities++;
            if (targetDay && targetDay.symptoms[symptom] === true) {
              occurrences++;
            }
          } else {
            // Factor absent — count symptom presence on target date
            daysWithoutFactor++;
            if (targetDay && targetDay.symptoms[symptom] === true) {
              symptomWithoutFactor++;
            }
          }
        }

        // Skip if insufficient data
        if (totalOpportunities === 0 || occurrences < 5) continue;

        const confidence = occurrences / totalOpportunities;
        if (confidence < 0.6) continue;

        const rateWith = occurrences / totalOpportunities;
        const rateWithout =
          daysWithoutFactor > 0
            ? symptomWithoutFactor / daysWithoutFactor
            : 0;
        // Use risk difference when baseline is 0 (avoids division by near-zero)
        const effectSizePct = rateWithout > 0.05
          ? ((rateWith - rateWithout) / rateWithout) * 100
          : (rateWith - rateWithout) * 100;
        const direction: 'positive' | 'negative' =
          rateWith > rateWithout ? 'positive' : 'negative';

        const absEffect = Math.abs(effectSizePct);
        if (absEffect > bestAbsEffect) {
          bestAbsEffect = absEffect;
          bestResult = {
            factorA: factor,
            factorB: symptom,
            direction,
            confidence,
            effectSizePct,
            occurrences,
            totalOpportunities,
            lagDays: lag,
          };
        }
      }

      if (bestResult) {
        results.push(bestResult);
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API — single user
// ---------------------------------------------------------------------------

export async function computeCorrelationsForUser(
  userId: string,
): Promise<number> {
  // Fetch all daily logs for the user
  const userDailyLogs = await db
    .select({
      date: sql<string>`${dailyLogs.date}::text`,
      symptomsJson: dailyLogs.symptomsJson,
      sleepHours: dailyLogs.sleepHours,
      sleepQuality: dailyLogs.sleepQuality,
      disruptions: dailyLogs.disruptions,
      contextTags: dailyLogs.contextTags,
      cycleDataJson: dailyLogs.cycleDataJson,
      logType: dailyLogs.logType,
    })
    .from(dailyLogs)
    .where(eq(dailyLogs.userId, userId));

  // Fetch all medication logs joined with medication names
  const userMedLogs = await db
    .select({
      date: sql<string>`${medLogs.date}::text`,
      medicationName: medications.name,
      taken: medLogs.taken,
    })
    .from(medLogs)
    .innerJoin(medications, eq(medLogs.medicationId, medications.id))
    .where(eq(medLogs.userId, userId));

  // Build day vectors
  const dayMap = buildDayVectors(
    userDailyLogs as {
      date: string;
      symptomsJson: Record<string, number> | null;
      sleepHours: number | null;
      sleepQuality: string | null;
      disruptions: number | null;
      contextTags: string[] | null;
      cycleDataJson: { status?: string; flow?: string } | null;
      logType: string | null;
    }[],
    userMedLogs as {
      date: string;
      medicationName: string;
      taken: boolean;
    }[],
  );

  // Compute correlations
  const correlations = computeCrossCorrelations(dayMap);

  // Replace old correlations for this user
  await db
    .delete(userCorrelations)
    .where(eq(userCorrelations.userId, userId));

  if (correlations.length > 0) {
    await db.insert(userCorrelations).values(
      correlations.map((c) => ({
        userId,
        factorA: c.factorA,
        factorB: c.factorB,
        direction: c.direction,
        confidence: c.confidence,
        effectSizePct: c.effectSizePct,
        occurrences: c.occurrences,
        totalOpportunities: c.totalOpportunities,
        lagDays: c.lagDays,
        computedAt: new Date(),
      })),
    );
  }

  return correlations.length;
}

// ---------------------------------------------------------------------------
// Public API — all users (batch)
// ---------------------------------------------------------------------------

export async function computeAllCorrelations(): Promise<{
  processed: number;
  skipped: number;
  errors: number;
}> {
  // Find users with >= 14 distinct log dates
  const eligibleUsers = await db
    .select({
      userId: dailyLogs.userId,
      dateCount: countDistinct(dailyLogs.date).as('date_count'),
    })
    .from(dailyLogs)
    .groupBy(dailyLogs.userId)
    .having(gte(countDistinct(dailyLogs.date), 14));

  const userIds = eligibleUsers.map((row) => row.userId);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async (userId) => {
      try {
        const count = await computeCorrelationsForUser(userId);
        if (count > 0) {
          processed++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(
          `[compute-correlations] Error processing user ${userId}:`,
          err,
        );
        errors++;
      }
    });

    await Promise.all(batchPromises);
  }

  return { processed, skipped, errors };
}
