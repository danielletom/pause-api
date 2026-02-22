import { db } from '@/db';
import { interpretedInsights, computedScores, narratives } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import type { NaturopathInsight } from './naturopath-agent';

// ---------------------------------------------------------------------------
// Content safety — scan for prohibited language
// ---------------------------------------------------------------------------

const PROHIBITED_PHRASES = [
  'you have',
  'diagnosed with',
  'diagnosis',
  'stop taking',
  'discontinue',
  'you should start',
  'prescribe',
  'prescription',
];

function scanForProhibitedContent(insight: NaturopathInsight): string[] {
  const violations: string[] = [];
  const allText = JSON.stringify(insight).toLowerCase();

  for (const phrase of PROHIBITED_PHRASES) {
    if (allText.includes(phrase)) {
      violations.push(`Found prohibited phrase: "${phrase}"`);
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Text truncation helpers
// ---------------------------------------------------------------------------

function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '…';
}

function truncateSentences(text: string, maxSentences: number, maxWords: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const limited = sentences.slice(0, maxSentences).join(' ').trim();
  return truncateWords(limited, maxWords);
}

// ---------------------------------------------------------------------------
// Delivery Agent — writes insight to DB
// ---------------------------------------------------------------------------

export async function deliverInsights(
  userId: string,
  date: string,
  insight: NaturopathInsight,
  metadata: {
    modelUsed: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
  },
): Promise<{ status: 'complete' | 'flagged'; violations: string[] }> {
  // 1. Content safety check
  const violations = scanForProhibitedContent(insight);
  const status = violations.length > 0 ? 'flagged' : 'complete';

  if (violations.length > 0) {
    console.warn(
      `[delivery-agent] Content safety violations for ${userId}:`,
      violations,
    );
  }

  // 2. Format text surfaces within limits
  const homeNarrative = truncateSentences(insight.dailyNarrative, 2, 45);
  const weeklyStory = truncateSentences(insight.weeklyStory, 3, 60);
  const forecast = truncateSentences(insight.forecast, 2, 40);
  const insightNudgeTitle = truncateWords(insight.insightNudge.title, 6);
  const insightNudgeBody = truncateWords(insight.insightNudge.body, 30);

  // 3. Write to interpretedInsights table (upsert — replace existing for this user+date)
  const existing = await db
    .select({ id: interpretedInsights.id })
    .from(interpretedInsights)
    .where(
      and(
        eq(interpretedInsights.userId, userId),
        eq(interpretedInsights.date, date),
      ),
    )
    .limit(1);

  const payload = {
    userId,
    date,
    rawInsightJson: insight as unknown as Record<string, unknown>,
    homeNarrative,
    weeklyStory,
    forecast,
    insightNudgeTitle,
    insightNudgeBody,
    correlationInsightsJson: insight.correlationInsights as unknown as Record<string, unknown>[],
    helpsHurtsJson: insight.helpsHurts as unknown as Record<string, unknown>,
    symptomGuidanceJson: insight.symptomGuidance as unknown as Record<string, unknown>,
    contradictionsJson: insight.contradictions as unknown as Record<string, unknown>[],
    modelUsed: metadata.modelUsed,
    inputTokens: metadata.inputTokens,
    outputTokens: metadata.outputTokens,
    latencyMs: metadata.latencyMs,
    pipelineVersion: 1,
    status,
    computedAt: new Date(),
  };

  if (existing.length > 0) {
    await db
      .update(interpretedInsights)
      .set(payload)
      .where(eq(interpretedInsights.id, existing[0]!.id));
  } else {
    await db.insert(interpretedInsights).values(payload);
  }

  // 4. Backfill computedScores.recommendation (backward compat)
  try {
    const scoreRows = await db
      .select({ id: computedScores.id })
      .from(computedScores)
      .where(
        and(eq(computedScores.userId, userId), eq(computedScores.date, date)),
      )
      .limit(1);

    if (scoreRows.length > 0) {
      await db
        .update(computedScores)
        .set({ recommendation: homeNarrative })
        .where(eq(computedScores.id, scoreRows[0]!.id));
    }
  } catch (err) {
    console.error('[delivery-agent] Failed to backfill computedScores:', err);
  }

  // 5. Backfill narratives table (backward compat)
  try {
    const existingNarrative = await db
      .select({ id: narratives.id })
      .from(narratives)
      .where(
        and(
          eq(narratives.userId, userId),
          eq(narratives.date, date),
          eq(narratives.type, 'weekly_story'),
        ),
      )
      .limit(1);

    if (existingNarrative.length > 0) {
      await db
        .update(narratives)
        .set({ text: weeklyStory })
        .where(eq(narratives.id, existingNarrative[0]!.id));
    } else if (weeklyStory) {
      await db.insert(narratives).values({
        userId,
        date,
        type: 'weekly_story',
        text: weeklyStory,
      });
    }
  } catch (err) {
    console.error('[delivery-agent] Failed to backfill narratives:', err);
  }

  return { status, violations };
}
