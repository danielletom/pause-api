import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { computedScores, dailyLogs, userCorrelations, narratives } from '@/db/schema';
import { eq, and, gte, desc, isNull, sql } from 'drizzle-orm';
import { verifyCronSecret } from '@/lib/cron-auth';
import { generateWeeklyNarrative, generateReadinessNarrative } from '@/lib/claude';
import type { WeekSummary, ScoreComponents } from '@/lib/claude';

const MAX_USERS_PER_RUN = 500;

export async function GET(request: NextRequest) {
  const cronCheck = verifyCronSecret(request);
  if (cronCheck) return cronCheck;

  // Kill switch
  const narrativesEnabled = process.env.NARRATIVES_ENABLED;
  if (!narrativesEnabled || narrativesEnabled === 'false') {
    return NextResponse.json(
      { message: 'Narratives generation is disabled' },
      { status: 200 }
    );
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const isMonday = today.getUTCDay() === 1;

  let weeklyStoriesCount = 0;
  let readinessNarrativesCount = 0;
  let errorsCount = 0;

  // --- Weekly story generation (Mondays only) ---
  if (isMonday) {
    try {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

      // Get distinct users who have computedScores in the last 7 days
      const activeUsers = await db
        .selectDistinct({ userId: computedScores.userId })
        .from(computedScores)
        .where(gte(computedScores.date, sevenDaysAgoStr))
        .limit(MAX_USERS_PER_RUN);

      for (const { userId } of activeUsers) {
        try {
          // Get daily logs for last 7 days
          const logs = await db
            .select()
            .from(dailyLogs)
            .where(
              and(
                eq(dailyLogs.userId, userId),
                gte(dailyLogs.date, sevenDaysAgoStr)
              )
            );

          if (logs.length === 0) continue;

          // Compute top symptoms (top 3 by frequency)
          // Handles both formats: {key: severity} (current app) and [{name, severity}] (legacy)
          const symptomMap = new Map<string, { totalSeverity: number; count: number }>();
          for (const log of logs) {
            const raw = log.symptomsJson;
            if (!raw || typeof raw !== 'object') continue;

            if (Array.isArray(raw)) {
              // Legacy format: [{name, severity}]
              for (const s of raw as { name: string; severity: number }[]) {
                const existing = symptomMap.get(s.name) ?? { totalSeverity: 0, count: 0 };
                existing.totalSeverity += s.severity;
                existing.count += 1;
                symptomMap.set(s.name, existing);
              }
            } else {
              // Current format: {symptom_key: severity}
              for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
                const sev = typeof val === 'number' ? val : (typeof val === 'object' && val !== null ? ((val as any).severity ?? 1) : 1);
                const existing = symptomMap.get(key) ?? { totalSeverity: 0, count: 0 };
                existing.totalSeverity += sev;
                existing.count += 1;
                symptomMap.set(key, existing);
              }
            }
          }

          const topSymptoms = Array.from(symptomMap.entries())
            .map(([name, data]) => ({
              name,
              avgSeverity: Math.round((data.totalSeverity / data.count) * 10) / 10,
              dayCount: data.count,
            }))
            .sort((a, b) => b.dayCount - a.dayCount)
            .slice(0, 3);

          // Compute averages
          const sleepValues = logs
            .map((l) => l.sleepHours)
            .filter((v): v is number => v != null);
          const avgSleepHours =
            sleepValues.length > 0
              ? sleepValues.reduce((sum, v) => sum + v, 0) / sleepValues.length
              : 0;

          const moodValues = logs
            .map((l) => l.mood)
            .filter((v): v is number => v != null);
          const avgMood =
            moodValues.length > 0
              ? moodValues.reduce((sum, v) => sum + v, 0) / moodValues.length
              : 0;

          // Best day (highest mood)
          let bestDay: WeekSummary['bestDay'] = null;
          let worstDay: WeekSummary['worstDay'] = null;

          for (const log of logs) {
            const rawSymptoms = log.symptomsJson;
            const symptomCount = !rawSymptoms ? 0 : Array.isArray(rawSymptoms) ? rawSymptoms.length : (typeof rawSymptoms === 'object' ? Object.keys(rawSymptoms as Record<string, unknown>).length : 0);
            const mood = log.mood ?? 0;

            if (!bestDay || mood > bestDay.mood) {
              bestDay = { date: String(log.date), mood, symptomCount };
            }

            // Worst day: lowest mood + most symptoms
            if (
              !worstDay ||
              mood < worstDay.mood ||
              (mood === worstDay.mood && symptomCount > worstDay.symptomCount)
            ) {
              worstDay = { date: String(log.date), mood, symptomCount };
            }
          }

          // Get streak from latest computedScores
          const latestScore = await db
            .select({ streak: computedScores.streak })
            .from(computedScores)
            .where(eq(computedScores.userId, userId))
            .orderBy(desc(computedScores.date))
            .limit(1);

          const streak = latestScore[0]?.streak ?? 0;

          // Get top 2 correlations
          const correlations = await db
            .select()
            .from(userCorrelations)
            .where(eq(userCorrelations.userId, userId))
            .orderBy(desc(userCorrelations.confidence))
            .limit(2);

          const topCorrelations = correlations.map((c) => ({
            factor: c.factorA,
            symptom: c.factorB,
            direction: c.direction,
            effectSizePct: c.effectSizePct,
          }));

          const weekData: WeekSummary = {
            topSymptoms,
            avgSleepHours: Math.round(avgSleepHours * 10) / 10,
            avgMood: Math.round(avgMood * 10) / 10,
            bestDay,
            worstDay,
            streak,
            topCorrelations,
            totalLogs: logs.length,
          };

          const narrativeText = await generateWeeklyNarrative(weekData);

          // Check if a narrative already exists for this user/date/type
          const existingNarrative = await db
            .select({ id: narratives.id })
            .from(narratives)
            .where(
              and(
                eq(narratives.userId, userId),
                eq(narratives.date, todayStr!),
                eq(narratives.type, 'weekly_story')
              )
            )
            .limit(1);

          if (existingNarrative.length > 0) {
            await db
              .update(narratives)
              .set({ text: narrativeText })
              .where(eq(narratives.id, existingNarrative[0].id));
          } else {
            await db.insert(narratives).values({
              userId,
              date: todayStr!,
              type: 'weekly_story',
              text: narrativeText,
            });
          }

          weeklyStoriesCount++;
        } catch (error) {
          console.error(`Error generating weekly narrative for user ${userId}:`, error);
          errorsCount++;
        }
      }
    } catch (error) {
      console.error('Error in weekly story generation:', error);
      errorsCount++;
    }
  }

  // --- Readiness narrative (daily) ---
  try {
    // Get computedScores for today that don't have a recommendation
    const scoresToProcess = await db
      .select()
      .from(computedScores)
      .where(
        and(
          eq(computedScores.date, todayStr),
          isNull(computedScores.recommendation)
        )
      )
      .limit(MAX_USERS_PER_RUN);

    for (const score of scoresToProcess) {
      try {
        // Parse componentsJson
        const components = score.componentsJson as Record<string, number> | null;

        // Get today's daily logs for this user to find top symptom
        const todayLogs = await db
          .select()
          .from(dailyLogs)
          .where(
            and(
              eq(dailyLogs.userId, score.userId),
              eq(dailyLogs.date, todayStr)
            )
          )
          .limit(1);

        let topSymptom: string | null = null;
        if (todayLogs.length > 0) {
          const raw = todayLogs[0].symptomsJson;
          if (raw && typeof raw === 'object') {
            if (Array.isArray(raw)) {
              // Legacy format
              const sorted = [...(raw as { name: string; severity: number }[])].sort((a, b) => b.severity - a.severity);
              if (sorted.length > 0) topSymptom = sorted[0].name;
            } else {
              // Current format: {key: severity}
              const entries = Object.entries(raw as Record<string, unknown>)
                .map(([k, v]) => ({ name: k, severity: typeof v === 'number' ? v : 1 }))
                .sort((a, b) => b.severity - a.severity);
              if (entries.length > 0) topSymptom = entries[0].name;
            }
          }
        }

        const scoreData: ScoreComponents = {
          readiness: score.readiness ?? 0,
          sleep: components?.sleep ?? score.sleepScore ?? 0,
          mood: components?.mood ?? 0,
          symptomLoad: score.symptomLoad ?? 0,
          stressors: components?.stressors ?? 0,
          sleepHours: components?.sleepHours ?? null,
          topSymptom,
        };

        // Get correlations for this user to enrich narrative
        const userCorrs = await db
          .select()
          .from(userCorrelations)
          .where(eq(userCorrelations.userId, score.userId))
          .orderBy(desc(userCorrelations.confidence))
          .limit(2);
        const corrData = userCorrs.map((c) => {
          const factorLabel = c.factorA.startsWith('med_')
            ? c.factorA.slice(4).charAt(0).toUpperCase() + c.factorA.slice(5)
            : c.factorA.replace(/_/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase());
          const symptomLabel = c.factorB.replace(/_/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase());
          const verb = c.direction === 'positive' ? 'increases' : 'reduces';
          const rounded = Math.round(Math.abs(c.effectSizePct ?? 0));
          return {
            factor: c.factorA,
            symptom: c.factorB,
            direction: c.direction,
            effectSizePct: c.effectSizePct ?? 0,
            humanLabel: `${factorLabel} ${verb} ${symptomLabel.toLowerCase()} by ${rounded}%`,
          };
        });

        const narrativeText = await generateReadinessNarrative(scoreData, corrData);

        // Update computedScores with the recommendation
        await db
          .update(computedScores)
          .set({ recommendation: narrativeText })
          .where(eq(computedScores.id, score.id));

        readinessNarrativesCount++;
      } catch (error) {
        console.error(`Error generating readiness narrative for score ${score.id}:`, error);
        errorsCount++;
      }
    }
  } catch (error) {
    console.error('Error in readiness narrative generation:', error);
    errorsCount++;
  }

  return NextResponse.json({
    weeklyStories: weeklyStoriesCount,
    readinessNarratives: readinessNarrativesCount,
    errors: errorsCount,
  });
}
