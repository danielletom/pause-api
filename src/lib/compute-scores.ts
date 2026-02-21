import { db } from '@/db';
import { dailyLogs, computedScores } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// ── Readiness Algorithm ─────────────────────────────────────────────────────
// Weighted: Sleep 40%, Mood 25%, Symptom load 20%, Stressors 15%

interface SymptomsEntry {
  name: string;
  severity: number;
  isStressor?: boolean;
}

interface ScoreComponents {
  sleep: number;
  mood: number;
  symptom: number;
  stressor: number;
}

function computeSleepScore(
  hours: number | null,
  quality: string | null,
  disruptions: number | null
): number {
  if (hours == null) return 50; // default when no data

  // Base score from hours (target = 8h)
  let score = Math.min(100, Math.max(10, (hours / 8) * 85));

  // Quality bonuses
  if (quality === 'great') score += 15;
  else if (quality === 'good') score += 5;
  else if (quality === 'poor') score -= 15;
  else if (quality === 'terrible') score -= 25;

  // Disruption penalty
  const disruptionCount = disruptions ?? 0;
  const penalty = Math.min(20, disruptionCount * 7);
  score -= penalty;

  return Math.min(100, Math.max(10, score));
}

function computeMoodScore(mood: number | null): number {
  if (mood == null) return 50; // default
  return mood * 20; // 1-5 scale -> 20-100
}

function computeSymptomScore(symptoms: SymptomsEntry[]): number {
  const nonStressorSymptoms = symptoms.filter((s) => !s.isStressor);
  if (nonStressorSymptoms.length === 0) return 100;

  const count = nonStressorSymptoms.length;
  const avgSeverity =
    nonStressorSymptoms.reduce((sum, s) => sum + (s.severity ?? 0), 0) / count;

  return Math.max(10, 100 - count * 10 - avgSeverity * 3);
}

function computeStressorScore(
  symptoms: SymptomsEntry[],
  contextStressorCount: number = 0,
): number {
  // Count stressors from legacy symptom format + context tags
  const symptomStressors = symptoms.filter((s) => s.isStressor).length;
  const totalStressors = symptomStressors + contextStressorCount;
  if (totalStressors === 0) return 100;

  return Math.max(10, 100 - totalStressors * 12);
}

function computeReadiness(components: ScoreComponents): number {
  const weighted =
    components.sleep * 0.4 +
    components.mood * 0.25 +
    components.symptom * 0.2 +
    components.stressor * 0.15;

  return Math.min(99, Math.max(5, Math.round(weighted)));
}

// ── Exported Functions ──────────────────────────────────────────────────────

/**
 * Compute readiness score and components for a user on a given date.
 * Queries dailyLogs, computes scores, and upserts into computedScores.
 */
export async function computeScoresForUser(
  userId: string,
  date: string
): Promise<{
  readiness: number | null;
  components: ScoreComponents | null;
}> {
  // Get all daily logs for this user + date
  const logs = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)));

  if (logs.length === 0) {
    return { readiness: null, components: null };
  }

  // Merge data from all logs for the day (morning + evening check-ins)
  // Use the most recent non-null value for each field
  let sleepHours: number | null = null;
  let sleepQuality: string | null = null;
  let disruptions: number | null = null;
  let mood: number | null = null;
  const allSymptoms: SymptomsEntry[] = [];
  const contextStressors = new Set<string>();

  // Known stressor context tags — these affect the stressor score
  const STRESSOR_TAGS = new Set([
    'stress', 'stressful', 'anxiety', 'overwhelmed',
    'work_stress', 'conflict', 'deadline', 'grief',
  ]);

  for (const log of logs) {
    if (log.sleepHours != null) sleepHours = log.sleepHours;
    if (log.sleepQuality != null) sleepQuality = log.sleepQuality;
    if (log.disruptions != null) disruptions = log.disruptions;
    if (log.mood != null) mood = log.mood;

    // symptomsJson can be Record<string, number> (current app) or SymptomsEntry[] (legacy)
    const raw = log.symptomsJson;
    if (raw && typeof raw === 'object') {
      if (Array.isArray(raw)) {
        // Legacy array format: [{name, severity, isStressor?}]
        allSymptoms.push(...(raw as SymptomsEntry[]));
      } else {
        // Object format: {symptom_key: severity_number}
        for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
          const sev = typeof val === 'number' ? val : 1;
          allSymptoms.push({ name: key, severity: sev });
        }
      }
    }

    // Process contextTags for stressor detection
    const tags = log.contextTags as string[] | null;
    if (Array.isArray(tags)) {
      for (const tag of tags) {
        const lower = tag.toLowerCase();
        if (STRESSOR_TAGS.has(lower)) {
          contextStressors.add(lower);
        }
      }
    }
  }

  // Deduplicate symptoms by name, keeping highest severity
  const symptomMap = new Map<string, SymptomsEntry>();
  for (const s of allSymptoms) {
    const existing = symptomMap.get(s.name);
    if (!existing || s.severity > existing.severity) {
      symptomMap.set(s.name, s);
    }
  }
  const mergedSymptoms = Array.from(symptomMap.values());

  // Compute individual component scores
  const components: ScoreComponents = {
    sleep: computeSleepScore(sleepHours, sleepQuality, disruptions),
    mood: computeMoodScore(mood),
    symptom: computeSymptomScore(mergedSymptoms),
    stressor: computeStressorScore(mergedSymptoms, contextStressors.size),
  };

  const readiness = computeReadiness(components);

  // Compute streak while we are here
  const streak = await computeStreak(userId);

  // Upsert into computedScores
  const existing = await db
    .select()
    .from(computedScores)
    .where(
      and(eq(computedScores.userId, userId), eq(computedScores.date, date))
    );

  if (existing.length > 0) {
    await db
      .update(computedScores)
      .set({
        readiness,
        sleepScore: components.sleep,
        symptomLoad: components.symptom,
        streak,
        componentsJson: components,
      })
      .where(
        and(eq(computedScores.userId, userId), eq(computedScores.date, date))
      );
  } else {
    await db.insert(computedScores).values({
      userId,
      date,
      readiness,
      sleepScore: components.sleep,
      symptomLoad: components.symptom,
      streak,
      componentsJson: components,
    });
  }

  return { readiness, components };
}

/**
 * Count the current consecutive-day logging streak for a user.
 * Queries all dailyLogs dates in descending order and counts unbroken days.
 */
export async function computeStreak(userId: string): Promise<number> {
  const rows = await db
    .select({ date: dailyLogs.date })
    .from(dailyLogs)
    .where(eq(dailyLogs.userId, userId))
    .orderBy(desc(dailyLogs.date));

  if (rows.length === 0) return 0;

  // Deduplicate dates (multiple logs per day)
  // Convert to strings first — Date objects don't deduplicate by value in a Set
  const uniqueDates = [...new Set(rows.map((r) => String(r.date).split('T')[0]))];

  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const current = new Date(uniqueDates[i - 1]!);
    const previous = new Date(uniqueDates[i]!);
    const diffMs = current.getTime() - previous.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Batch-compute scores for all users who have daily logs.
 * Used by the nightly cron job.
 */
export async function computeAllUserScores(): Promise<{
  processed: number;
  errors: number;
}> {
  // Get all distinct userIds from dailyLogs
  const userRows = await db
    .selectDistinct({ userId: dailyLogs.userId })
    .from(dailyLogs);

  const today = new Date().toISOString().split('T')[0]!;

  let processed = 0;
  let errors = 0;

  for (const row of userRows) {
    try {
      await computeScoresForUser(row.userId, today);
      processed++;
    } catch (err) {
      console.error(
        `[compute-scores] Error processing user ${row.userId}:`,
        err
      );
      errors++;
    }
  }

  return { processed, errors };
}
