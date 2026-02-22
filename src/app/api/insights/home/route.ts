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
  content,
  interpretedInsights,
} from '@/db/schema';
import { eq, and, desc, sql, isNull, isNotNull } from 'drizzle-orm';
import { computeScoresForUser, computeStreak } from '@/lib/compute-scores';
import { generateReadinessNarrative, type ScoreComponents } from '@/lib/claude';

// ── Types ───────────────────────────────────────────────────────────────────

interface SymptomEntry {
  name: string;
  severity: number;
  isStressor?: boolean;
}

interface HomeResponse {
  readiness: number | null;
  readinessComponents: Record<string, number> | null;
  streak: number;
  symptomSummary: { name: string; severity: number }[];
  stressorSummary: string[];
  topCorrelations: { factor: string; symptom: string; direction: string; effectSizePct: number; humanLabel: string }[];
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
  suggestedAudio: {
    id: number;
    title: string;
    contentType: string;
    durationMinutes: number | null;
    category: string | null;
    tags: unknown;
  } | null;
  tomorrowForecast: string | null;
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

    // 0. Check for pre-computed pipeline insights (from nightly naturopath agent)
    const pipelineRows = await db
      .select()
      .from(interpretedInsights)
      .where(
        and(
          eq(interpretedInsights.userId, userId),
          eq(interpretedInsights.date, date),
        ),
      )
      .limit(1);

    const pipelineInsight = pipelineRows.length > 0 ? pipelineRows[0] : null;

    // 1. Recompute readiness scores from latest logs
    //    Compare with cached score to decide whether the AI narrative
    //    needs regenerating (avoids unnecessary API calls while still
    //    reflecting evening check-in data in the score).
    let readiness: number | null = null;
    let readinessComponents: Record<string, number> | null = null;
    let recommendation: string | null = null;

    // Read the previously cached score + recommendation before recomputing
    const scoreRows = await db
      .select()
      .from(computedScores)
      .where(
        and(eq(computedScores.userId, userId), eq(computedScores.date, date))
      );
    const cachedRecommendation = scoreRows.length > 0 ? scoreRows[0]!.recommendation : null;
    const cachedAt = scoreRows.length > 0 ? scoreRows[0]!.createdAt : null;

    // Recompute from all logs (morning + evening)
    const computed = await computeScoresForUser(userId, date);
    readiness = computed.readiness;
    readinessComponents = computed.components as Record<string, number> | null;

    // Check if new logs arrived since the narrative was cached
    // If a new check-in was added, regenerate so the narrative reflects it
    const latestLog = await db
      .select({ loggedAt: dailyLogs.loggedAt })
      .from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)))
      .orderBy(desc(dailyLogs.loggedAt))
      .limit(1);
    const latestLogTime = latestLog.length > 0 ? latestLog[0]!.loggedAt : null;
    const hasNewLogsSinceCached = cachedAt && latestLogTime
      ? new Date(latestLogTime).getTime() > new Date(cachedAt).getTime()
      : false;

    // Prefer pipeline narrative > cached recommendation > regenerate
    if (pipelineInsight?.homeNarrative) {
      recommendation = pipelineInsight.homeNarrative;
    } else if (cachedRecommendation && !hasNewLogsSinceCached) {
      recommendation = cachedRecommendation;
    }

    // 2. Get daily logs for symptom + stressor summary
    const logs = await db
      .select()
      .from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)));

    // Build symptom summary: merge all symptoms, deduplicate, sort by severity
    // symptomsJson can be either Record<string, number> (from app) or SymptomEntry[] (legacy)
    const symptomMap = new Map<string, number>();
    const stressorSet = new Set<string>();
    for (const log of logs) {
      const raw = log.symptomsJson;
      if (raw && typeof raw === 'object') {
        if (Array.isArray(raw)) {
          // Legacy array format: [{name, severity, isStressor?}]
          for (const s of raw as SymptomEntry[]) {
            if (s.isStressor) {
              stressorSet.add(s.name);
            } else {
              const existing = symptomMap.get(s.name);
              if (existing == null || s.severity > existing) {
                symptomMap.set(s.name, s.severity);
              }
            }
          }
        } else {
          // Object format: {symptom_key: severity} — what the app actually writes
          for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
            const sev = typeof val === 'number' ? val : (typeof val === 'object' && val !== null ? ((val as any).severity ?? 1) : 1);
            const existing = symptomMap.get(key);
            if (existing == null || sev > existing) {
              symptomMap.set(key, sev);
            }
          }
        }
      }
      // Also check contextTags for stressors
      const tags = log.contextTags as string[] | null;
      if (Array.isArray(tags)) {
        tags.forEach((t) => stressorSet.add(t));
      }
    }
    const symptomSummary = Array.from(symptomMap.entries())
      .map(([name, severity]) => ({ name, severity }))
      .sort((a, b) => b.severity - a.severity);
    const stressorSummary = Array.from(stressorSet);

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

    // 4. Get top user correlations — used for nudge AND enriching recommendation
    let insightNudge: { title: string; body: string } | null = null;

    const correlationRows = await db
      .select()
      .from(userCorrelations)
      .where(eq(userCorrelations.userId, userId))
      .orderBy(desc(userCorrelations.confidence))
      .limit(3);

    // Build top correlations for frontend
    const topCorrelations = correlationRows.map((c) => {
      const factorLabel = c.factorA.replace(/_/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase());
      const symptomLabel = c.factorB.replace(/_/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase());
      const verb = c.direction === 'positive' ? 'increases' : 'reduces';
      const rounded = Math.round(Math.abs(c.effectSizePct ?? 0));
      return {
        factor: c.factorA,
        symptom: c.factorB,
        direction: c.direction,
        effectSizePct: c.effectSizePct ?? 0,
        humanLabel: `${factorLabel} ${verb} ${symptomLabel.toLowerCase()} by ${rounded}pp`,
      };
    });

    // Prefer pipeline nudge if available
    if (pipelineInsight?.insightNudgeTitle && pipelineInsight?.insightNudgeBody) {
      insightNudge = {
        title: pipelineInsight.insightNudgeTitle,
        body: pipelineInsight.insightNudgeBody,
      };
    } else if (correlationRows.length > 0) {
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

    // 4b. Generate readiness recommendation inline if missing
    if (!recommendation && readiness != null && logs.length > 0) {
      // Find sleep hours from logs
      let sleepHours: number | null = null;
      let topSymptom: string | null = null;
      for (const log of logs) {
        if (log.sleepHours != null) sleepHours = log.sleepHours;
      }
      if (symptomSummary.length > 0) {
        topSymptom = symptomSummary[0].name;
      }

      const scoreData: ScoreComponents = {
        readiness,
        sleep: readinessComponents?.sleep ?? 0,
        mood: readinessComponents?.mood ?? 0,
        symptomLoad: readinessComponents?.symptom ?? 0,
        stressors: readinessComponents?.stressor ?? 0,
        sleepHours,
        topSymptom,
      };

      // Try AI-generated narrative first, fall back to conversational template
      try {
        recommendation = await generateReadinessNarrative(scoreData, topCorrelations);
      } catch (aiError) {
        console.error('[insights/home] AI narrative failed, using fallback:', aiError);
        // Conversational fallback using actual data
        const topSymptomLabel = topSymptom ? topSymptom.replace(/_/g, ' ') : null;

        let corrTip = '';
        if (topCorrelations.length > 0) {
          const c = topCorrelations[0];
          const factor = c.factor.replace(/_/g, ' ');
          const symptom = c.symptom.replace(/_/g, ' ');
          const pct = Math.round(Math.abs(c.effectSizePct));
          if (c.direction === 'negative') {
            corrTip = ` Your data shows ${factor} reduces ${symptom} by ${pct}% — worth trying today.`;
          } else {
            corrTip = ` We've noticed ${factor} tends to increase ${symptom} by ${pct}%.`;
          }
        }

        if (readiness >= 70) {
          const sleepNote = sleepHours
            ? `${sleepHours} hours of sleep is paying off`
            : 'Your body feels well-rested';
          recommendation = `${sleepNote} — you're in a good place today.${corrTip || ' A good day to move your body if you feel up to it.'}`;
        } else if (readiness >= 40) {
          const sleepNote = sleepHours
            ? `You got ${sleepHours} hours of sleep, which is helping`
            : 'Some things are working in your favour';
          const dragNote = topSymptomLabel
            ? `but ${topSymptomLabel} is weighing on things`
            : 'but your body could use some extra care';
          recommendation = `${sleepNote}, ${dragNote}. Listen to what your body needs today.${corrTip}`;
        } else {
          const context = sleepHours && sleepHours < 6
            ? `Only ${sleepHours} hours of sleep is making everything feel harder`
            : topSymptomLabel
              ? `${topSymptomLabel.charAt(0).toUpperCase() + topSymptomLabel.slice(1)} is weighing heavily today`
              : 'Your body is carrying a lot today';
          recommendation = `${context}. Be extra gentle with yourself — rest is productive too.${corrTip}`;
        }
      }

      // Cache the recommendation for future requests
      try {
        const existingScore = await db
          .select({ id: computedScores.id })
          .from(computedScores)
          .where(and(eq(computedScores.userId, userId), eq(computedScores.date, date)))
          .limit(1);
        if (existingScore.length > 0 && recommendation) {
          await db
            .update(computedScores)
            .set({ recommendation })
            .where(eq(computedScores.id, existingScore[0]!.id));
        }
      } catch {
        // Non-fatal — caching failure doesn't break the response
      }
    }

    // 5. Get latest weekly story narrative — prefer pipeline
    let narrativeText: string | null = null;

    if (pipelineInsight?.weeklyStory) {
      narrativeText = pipelineInsight.weeklyStory;
    } else {
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
    }

    // 6. Get streak
    const streak = await computeStreak(userId);

    // 7. Suggested evening audio — personalized based on top symptom + time of day
    let suggestedAudio: HomeResponse['suggestedAudio'] = null;
    try {
      // Map user's top symptom to a content category
      const symptomToCategory: Record<string, string> = {
        hot_flashes: 'Hot Flashes', hot_flash: 'Hot Flashes', night_sweats: 'Sleep',
        insomnia: 'Sleep', sleep_disruption: 'Sleep', poor_sleep: 'Sleep',
        anxiety: 'Mood', mood_swings: 'Mood', irritability: 'Mood', depression: 'Mood',
        brain_fog: 'Brain Fog', fatigue: 'Sleep', joint_pain: 'Body',
        weight_gain: 'Nutrition', bloating: 'Nutrition', headache: 'Body',
      };

      // Determine the best category to recommend
      let targetCategory: string | null = null;
      if (symptomSummary.length > 0) {
        const topSymptomKey = symptomSummary[0].name.toLowerCase().replace(/\s+/g, '_');
        targetCategory = symptomToCategory[topSymptomKey] || null;
      }

      // Determine time-of-day tag preference
      const hour = new Date().getHours();
      const timeTag = hour >= 18 ? 'evening' : hour >= 12 ? 'afternoon' : 'morning';

      // Query for audio content matching category + time, excluding program episodes
      // Priority: 1) matches category + time tag, 2) matches category, 3) matches time tag, 4) any meditation/podcast
      const audioItems = await db
        .select({
          id: content.id,
          title: content.title,
          contentType: content.contentType,
          durationMinutes: content.durationMinutes,
          category: content.category,
          tags: content.tags,
        })
        .from(content)
        .where(
          and(
            eq(content.status, 'published'),
            eq(content.format, 'audio'),
            isNull(content.programWeek) // Exclude program episodes
          )
        )
        .orderBy(sql`RANDOM()`)
        .limit(20);

      if (audioItems.length > 0) {
        // Score each item
        const scored = audioItems.map((item) => {
          let score = 0;
          const itemTags = Array.isArray(item.tags) ? item.tags as string[] : [];

          // Category match (strongest signal)
          if (targetCategory && item.category === targetCategory) score += 10;

          // Time-of-day tag match
          if (itemTags.includes(timeTag)) score += 5;
          if (itemTags.includes('anytime')) score += 2;

          // Prefer meditations in the evening, podcasts otherwise
          if (hour >= 18 && item.contentType === 'meditation') score += 3;
          if (hour < 18 && item.contentType === 'podcast') score += 3;

          // Sleep-related content gets a boost in the evening
          if (hour >= 18 && (item.category === 'Sleep' || itemTags.includes('sleep'))) score += 4;

          return { item, score };
        });

        // Pick the highest scored item
        scored.sort((a, b) => b.score - a.score);
        const best = scored[0].item;
        suggestedAudio = {
          id: best.id,
          title: best.title,
          contentType: best.contentType,
          durationMinutes: best.durationMinutes,
          category: best.category,
          tags: best.tags,
        };
      }
    } catch (err) {
      console.error('[insights/home] Suggested audio error:', err);
    }

    // 8. Tomorrow's forecast — prefer pipeline, fall back to heuristic
    let tomorrowForecast: string | null = pipelineInsight?.forecast ?? null;
    try {
      if (tomorrowForecast) {
        // Pipeline already provided — skip heuristic
      } else
      if (readiness != null && readinessComponents) {
        const sleepComp = readinessComponents.sleep ?? 0;
        const moodComp = readinessComponents.mood ?? 0;
        const symptomComp = readinessComponents.symptom ?? 0;

        // Find the weakest component to give targeted advice
        const components = [
          { name: 'sleep', score: sleepComp, label: 'sleep' },
          { name: 'mood', score: moodComp, label: 'mood' },
          { name: 'symptom', score: symptomComp, label: 'symptoms' },
        ].sort((a, b) => a.score - b.score);

        const weakest = components[0];
        const strongest = components[components.length - 1];

        // Predict tomorrow's readiness based on patterns
        // If user sleeps well (7+ hrs), readiness typically improves by 5-12 points
        const potentialBoost = weakest.name === 'sleep' ? 12 : weakest.name === 'mood' ? 8 : 5;
        const predictedReadiness = Math.min(99, readiness + potentialBoost);

        // Build personalized forecast using correlations
        let correlationTip = '';
        if (topCorrelations.length > 0) {
          const bestCorr = topCorrelations.find((c) => c.direction === 'negative'); // find something that helps
          if (bestCorr) {
            const factor = bestCorr.factor.replace(/_/g, ' ');
            correlationTip = ` Your data shows ${factor} helps — try including it.`;
          }
        }

        // Generate the forecast text
        if (weakest.name === 'sleep') {
          const sleepHrs = logs.find((l) => l.sleepHours != null)?.sleepHours;
          const targetHrs = sleepHrs && sleepHrs < 7 ? 7 : 8;
          tomorrowForecast = `Sleep ${targetHrs}+ hours tonight and your readiness could reach ${predictedReadiness}. ${strongest.label.charAt(0).toUpperCase() + strongest.label.slice(1)} is your strongest area right now.${correlationTip}`;
        } else if (weakest.name === 'mood') {
          tomorrowForecast = `Focus on winding down gently tonight — your mood score has room to improve. With rest, readiness could reach ${predictedReadiness}.${correlationTip}`;
        } else {
          tomorrowForecast = `Your ${weakest.label} were elevated today. A calm evening routine could help bring readiness to ${predictedReadiness} tomorrow.${correlationTip}`;
        }
      } else if (streak < 3) {
        tomorrowForecast = 'Log a few more days so we can start predicting your readiness. Patterns emerge quickly!';
      }
    } catch (err) {
      console.error('[insights/home] Tomorrow forecast error:', err);
    }

    // 9. Build response
    const response: HomeResponse = {
      readiness,
      readinessComponents,
      streak,
      symptomSummary,
      stressorSummary,
      topCorrelations,
      insightNudge,
      medsToday,
      recommendation,
      narrative: narrativeText,
      suggestedAudio,
      tomorrowForecast,
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
