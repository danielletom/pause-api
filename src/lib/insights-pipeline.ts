import { db } from '@/db';
import {
  dailyLogs,
  profiles,
  medications,
  medLogs,
  computedScores,
  userCorrelations,
  bleedingEvents,
} from '@/db/schema';
import { eq, and, desc, gte, countDistinct, sql } from 'drizzle-orm';
import { interpretInsights, type UserInsightContext } from './naturopath-agent';
import { deliverInsights } from './delivery-agent';
import { generateFallbackInsight } from './insights-fallback';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BATCH_SIZE = 10; // AI calls are slower — smaller batches
const TIMEOUT_PER_USER_MS = 30_000;
const MIN_LOG_DAYS = 14; // need enough data for meaningful correlations

// ---------------------------------------------------------------------------
// Context gathering — collects everything the naturopath needs
// ---------------------------------------------------------------------------

async function gatherUserContext(
  userId: string,
  date: string,
): Promise<UserInsightContext> {
  // All queries run in parallel for speed
  const [
    profileRows,
    correlationRows,
    medRows,
    recentScoreRows,
    recentLogRows,
    bleedingRows,
    todayLogs,
    todayScoreRows,
    medLogRows,
  ] = await Promise.all([
    // Profile
    db
      .select({
        stage: profiles.stage,
        symptoms: profiles.symptoms,
        goals: profiles.goals,
        dateOfBirth: profiles.dateOfBirth,
      })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1),

    // Correlations (top 15 by absolute effect size)
    db
      .select({
        factorA: userCorrelations.factorA,
        factorB: userCorrelations.factorB,
        direction: userCorrelations.direction,
        effectSizePct: userCorrelations.effectSizePct,
        occurrences: userCorrelations.occurrences,
        lagDays: userCorrelations.lagDays,
      })
      .from(userCorrelations)
      .where(eq(userCorrelations.userId, userId))
      .orderBy(desc(sql`ABS(${userCorrelations.effectSizePct})`))
      .limit(15),

    // Active medications
    db
      .select({
        id: medications.id,
        name: medications.name,
        dose: medications.dose,
        time: medications.time,
      })
      .from(medications)
      .where(and(eq(medications.userId, userId), eq(medications.active, true))),

    // Recent scores (7 days)
    db
      .select({
        date: computedScores.date,
        readiness: computedScores.readiness,
        sleepScore: computedScores.sleepScore,
        symptomLoad: computedScores.symptomLoad,
      })
      .from(computedScores)
      .where(eq(computedScores.userId, userId))
      .orderBy(desc(computedScores.date))
      .limit(7),

    // Recent logs (14 days)
    db
      .select({
        date: sql<string>`${dailyLogs.date}::text`,
        sleepHours: dailyLogs.sleepHours,
        sleepQuality: dailyLogs.sleepQuality,
        mood: dailyLogs.mood,
        symptomsJson: dailyLogs.symptomsJson,
        contextTags: dailyLogs.contextTags,
      })
      .from(dailyLogs)
      .where(eq(dailyLogs.userId, userId))
      .orderBy(desc(dailyLogs.date))
      .limit(30), // Might be multiple logs per day

    // Recent bleeding events (last 90 days)
    db
      .select({
        eventDate: sql<string>`${bleedingEvents.eventDate}::text`,
        type: bleedingEvents.type,
      })
      .from(bleedingEvents)
      .where(eq(bleedingEvents.userId, userId))
      .orderBy(desc(bleedingEvents.eventDate))
      .limit(30),

    // Today's logs
    db
      .select({
        sleepHours: dailyLogs.sleepHours,
        mood: dailyLogs.mood,
        symptomsJson: dailyLogs.symptomsJson,
      })
      .from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date))),

    // Today's score
    db
      .select({
        readiness: computedScores.readiness,
      })
      .from(computedScores)
      .where(and(eq(computedScores.userId, userId), eq(computedScores.date, date)))
      .limit(1),

    // Med logs (last 14 days for adherence calc)
    db
      .select({
        medicationId: medLogs.medicationId,
        taken: medLogs.taken,
        date: sql<string>`${medLogs.date}::text`,
      })
      .from(medLogs)
      .where(eq(medLogs.userId, userId))
      .orderBy(desc(medLogs.date))
      .limit(200),
  ]);

  // --- Build profile ---
  const profile = profileRows[0] ?? {
    stage: null,
    symptoms: [],
    goals: [],
    dateOfBirth: null,
  };

  // --- Build medications with adherence ---
  const medsWithAdherence = medRows.map((med) => {
    const medLogEntries = medLogRows.filter(
      (ml) => ml.medicationId === med.id,
    );
    const totalDays = medLogEntries.length;
    const takenDays = medLogEntries.filter((ml) => ml.taken).length;
    return {
      name: med.name,
      dose: med.dose,
      time: med.time,
      recentAdherencePct: totalDays > 0 ? (takenDays / totalDays) * 100 : 0,
    };
  });

  // --- Build correlations ---
  const correlations = correlationRows.map((c) => ({
    factorA: c.factorA,
    factorB: c.factorB,
    direction: c.direction as string,
    effectSizePct: c.effectSizePct ?? 0,
    occurrences: c.occurrences ?? 0,
    lagDays: c.lagDays ?? 0,
  }));

  // --- Build recent scores ---
  const recentScores = recentScoreRows.map((s) => ({
    date: s.date,
    readiness: s.readiness,
    sleepScore: s.sleepScore,
    symptomLoad: s.symptomLoad,
  }));

  // --- Build recent logs (dedupe by date, keep latest per day) ---
  const logsByDate = new Map<
    string,
    {
      date: string;
      sleepHours: number | null;
      sleepQuality: string | null;
      mood: number | null;
      symptoms: Record<string, number>;
      contextTags: string[];
    }
  >();

  for (const log of recentLogRows) {
    const dateStr = log.date;
    const existing = logsByDate.get(dateStr);
    const symptoms = (log.symptomsJson as Record<string, number>) ?? {};
    const tags = (log.contextTags as string[]) ?? [];

    if (!existing) {
      logsByDate.set(dateStr, {
        date: dateStr,
        sleepHours: log.sleepHours,
        sleepQuality: log.sleepQuality,
        mood: log.mood,
        symptoms,
        contextTags: tags,
      });
    } else {
      // Merge: prefer non-null values, merge symptoms
      if (log.sleepHours != null) existing.sleepHours = log.sleepHours;
      if (log.sleepQuality != null) existing.sleepQuality = log.sleepQuality;
      if (log.mood != null) existing.mood = log.mood;
      for (const [k, v] of Object.entries(symptoms)) {
        if (typeof v === 'number' && v > 0) {
          existing.symptoms[k] = Math.max(existing.symptoms[k] ?? 0, v);
        }
      }
      for (const tag of tags) {
        if (!existing.contextTags.includes(tag)) {
          existing.contextTags.push(tag);
        }
      }
    }
  }

  const recentLogs = Array.from(logsByDate.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14);

  // --- Build cycle data ---
  const periodDates = bleedingRows
    .filter(
      (b) =>
        b.type === 'period_start' ||
        b.type === 'period_daily' ||
        b.type === 'period_end',
    )
    .map((b) => b.eventDate);

  const cycleData =
    periodDates.length > 0
      ? {
          recentPeriodDates: periodDates.slice(0, 10),
          avgCycleLength: null as number | null, // Could compute but keeping simple
          stage: profile.stage,
        }
      : null;

  // --- Build today's score ---
  let todayScore: UserInsightContext['todayScore'] = null;
  if (todayLogs.length > 0 || todayScoreRows.length > 0) {
    let sleepHours: number | null = null;
    let mood: number | null = null;
    let topSymptom: string | null = null;

    for (const log of todayLogs) {
      if (log.sleepHours != null) sleepHours = log.sleepHours;
      if (log.mood != null) mood = log.mood;
      const symp = log.symptomsJson as Record<string, number> | null;
      if (symp) {
        let maxSev = 0;
        for (const [name, sev] of Object.entries(symp)) {
          if (typeof sev === 'number' && sev > maxSev) {
            maxSev = sev;
            topSymptom = name;
          }
        }
      }
    }

    todayScore = {
      readiness: todayScoreRows[0]?.readiness ?? null,
      sleepHours,
      topSymptom,
      mood,
    };
  }

  return {
    userId,
    date,
    profile: {
      stage: profile.stage,
      symptoms: Array.isArray(profile.symptoms)
        ? (profile.symptoms as string[])
        : [],
      goals: Array.isArray(profile.goals) ? (profile.goals as string[]) : [],
      dateOfBirth: profile.dateOfBirth,
    },
    correlations,
    medications: medsWithAdherence,
    recentScores,
    recentLogs,
    cycleData,
    todayScore,
  };
}

// ---------------------------------------------------------------------------
// Process a single user
// ---------------------------------------------------------------------------

async function processUser(
  userId: string,
  date: string,
  useFallback: boolean,
): Promise<{ tokens: number; status: 'complete' | 'fallback' | 'error' }> {
  const ctx = await gatherUserContext(userId, date);

  if (useFallback) {
    const fallbackInsight = generateFallbackInsight(ctx);
    await deliverInsights(userId, date, fallbackInsight, {
      modelUsed: 'fallback',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
    });
    return { tokens: 0, status: 'fallback' };
  }

  // AI path with timeout
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), TIMEOUT_PER_USER_MS),
  );

  try {
    const { insight, inputTokens, outputTokens, latencyMs } =
      await Promise.race([interpretInsights(ctx), timeoutPromise]);

    await deliverInsights(userId, date, insight, {
      modelUsed: 'gpt-4o-mini',
      inputTokens,
      outputTokens,
      latencyMs,
    });

    return { tokens: inputTokens + outputTokens, status: 'complete' };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errName = err instanceof Error ? err.constructor.name : typeof err;
    const errCause = err instanceof Error && err.cause ? String(err.cause) : undefined;
    console.error(
      `[insights-pipeline] AI failed for ${userId}: [${errName}] ${errMsg}`,
      errCause ? `cause: ${errCause}` : '',
    );

    // Fallback on any failure — embed error detail for debugging
    const fallbackInsight = generateFallbackInsight(ctx);
    await deliverInsights(userId, date, fallbackInsight, {
      modelUsed: `fallback:${errName}:${errMsg.slice(0, 200)}`,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
    });

    return { tokens: 0, status: 'fallback' };
  }
}

// ---------------------------------------------------------------------------
// Public API — run pipeline for all eligible users
// ---------------------------------------------------------------------------

export async function runInsightsPipeline(): Promise<{
  processed: number;
  fallbacks: number;
  errors: number;
  totalTokens: number;
}> {
  const pipelineEnabled = process.env.INSIGHTS_PIPELINE_ENABLED !== 'false';
  const allowlist = process.env.INSIGHTS_PIPELINE_USER_ALLOWLIST
    ? process.env.INSIGHTS_PIPELINE_USER_ALLOWLIST.split(',').map((s) =>
        s.trim(),
      )
    : null;

  const today = new Date().toISOString().split('T')[0]!;

  // Find eligible users (>= 14 distinct log dates)
  const eligibleUsers = await db
    .select({
      userId: dailyLogs.userId,
      dateCount: countDistinct(dailyLogs.date).as('date_count'),
    })
    .from(dailyLogs)
    .groupBy(dailyLogs.userId)
    .having(gte(countDistinct(dailyLogs.date), MIN_LOG_DAYS));

  let userIds = eligibleUsers.map((row) => row.userId);

  // Apply allowlist filter if set
  if (allowlist) {
    userIds = userIds.filter((id) => allowlist.includes(id));
  }

  let processed = 0;
  let fallbacks = 0;
  let errors = 0;
  let totalTokens = 0;

  // Process in batches
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((userId) =>
        processUser(userId, today, !pipelineEnabled),
      ),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { tokens, status } = result.value;
        totalTokens += tokens;
        if (status === 'complete') processed++;
        else if (status === 'fallback') fallbacks++;
        else errors++;
      } else {
        console.error(
          '[insights-pipeline] Unexpected rejection:',
          result.reason,
        );
        errors++;
      }
    }
  }

  return { processed, fallbacks, errors, totalTokens };
}

// ---------------------------------------------------------------------------
// Public API — run pipeline for a single user (for testing / on-demand)
// ---------------------------------------------------------------------------

export async function runInsightsPipelineForUser(
  userId: string,
  date?: string,
): Promise<{ tokens: number; status: 'complete' | 'fallback' | 'error' }> {
  const targetDate = date ?? new Date().toISOString().split('T')[0]!;
  return processUser(userId, targetDate, false);
}
