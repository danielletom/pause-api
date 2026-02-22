import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { dailyLogs, userCorrelations, interpretedInsights } from '@/db/schema';
import { eq, and, desc, countDistinct, max, sql } from 'drizzle-orm';
// import { getUserTier } from '@/lib/feature-gate'; // Removed: showing all correlations now

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFactorLabel(factor: string): string {
  // Handle medication factors: "med_aspirin" -> "Aspirin"
  if (factor.startsWith('med_')) {
    const medName = factor.slice(4);
    return medName.charAt(0).toUpperCase() + medName.slice(1);
  }

  // Replace underscores with spaces, capitalize each word
  return factor
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSymptomLabel(symptom: string): string {
  return symptom
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function generateHumanLabel(
  factorA: string,
  factorB: string,
  direction: 'positive' | 'negative',
  effectSizePct: number,
): string {
  const factorLabel = formatFactorLabel(factorA);
  const symptomLabel = formatSymptomLabel(factorB);
  const verb = direction === 'positive' ? 'increases' : 'reduces';
  const rounded = Math.round(Math.abs(effectSizePct));
  return `${factorLabel} ${verb} ${symptomLabel.toLowerCase()} by ${rounded}%`;
}

function determineDataQuality(
  distinctDates: number,
): 'building' | 'moderate' | 'strong' {
  if (distinctDates < 14) return 'building';
  if (distinctDates < 30) return 'moderate';
  return 'strong';
}

// ---------------------------------------------------------------------------
// GET /api/insights/correlations
// ---------------------------------------------------------------------------

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch all correlations for the user, ordered by effect size descending
  const allCorrelations = await db
    .select({
      factorA: userCorrelations.factorA,
      factorB: userCorrelations.factorB,
      direction: userCorrelations.direction,
      confidence: userCorrelations.confidence,
      effectSizePct: userCorrelations.effectSizePct,
      occurrences: userCorrelations.occurrences,
      lagDays: userCorrelations.lagDays,
      computedAt: userCorrelations.computedAt,
    })
    .from(userCorrelations)
    .where(eq(userCorrelations.userId, userId))
    .orderBy(desc(sql`ABS(${userCorrelations.effectSizePct})`));

  const totalFound = allCorrelations.length;

  // Show all correlations — this is a health app, users need the full picture
  const visibleCorrelations = allCorrelations;

  // Get the most recent computedAt timestamp
  const latestRow = await db
    .select({
      latest: max(userCorrelations.computedAt),
    })
    .from(userCorrelations)
    .where(eq(userCorrelations.userId, userId));

  const lastComputed = latestRow[0]?.latest
    ? latestRow[0].latest.toISOString()
    : null;

  // Count distinct log dates for data quality assessment
  const dateCountResult = await db
    .select({
      dateCount: countDistinct(dailyLogs.date).as('date_count'),
    })
    .from(dailyLogs)
    .where(eq(dailyLogs.userId, userId));

  const distinctDates = Number(dateCountResult[0]?.dateCount ?? 0);
  const dataQuality = determineDataQuality(distinctDates);

  // Load naturopath enrichments if available
  const today = new Date().toISOString().split('T')[0]!;
  const pipelineRows = await db
    .select({
      correlationInsightsJson: interpretedInsights.correlationInsightsJson,
      helpsHurtsJson: interpretedInsights.helpsHurtsJson,
      contradictionsJson: interpretedInsights.contradictionsJson,
    })
    .from(interpretedInsights)
    .where(
      and(
        eq(interpretedInsights.userId, userId),
        eq(interpretedInsights.date, today),
      ),
    )
    .limit(1);

  const pipelineInsight = pipelineRows.length > 0 ? pipelineRows[0] : null;

  // Build a lookup map from pipeline correlation insights
  const insightMap = new Map<
    string,
    { explanation: string; mechanism: string; recommendation: string; caveat: string | null }
  >();
  if (pipelineInsight?.correlationInsightsJson) {
    const insights = pipelineInsight.correlationInsightsJson as {
      factor: string;
      symptom: string;
      explanation: string;
      mechanism: string;
      recommendation: string;
      caveat: string | null;
    }[];
    for (const ins of insights) {
      insightMap.set(`${ins.factor}__${ins.symptom}`, ins);
    }
  }

  // Shape the response — enrich with naturopath fields when available
  const correlations = visibleCorrelations.map((c) => {
    const enrichment = insightMap.get(`${c.factorA}__${c.factorB}`);
    return {
      factor: c.factorA,
      symptom: c.factorB,
      direction: c.direction as 'positive' | 'negative',
      confidence: c.confidence,
      effectSizePct: c.effectSizePct,
      occurrences: c.occurrences,
      lagDays: c.lagDays,
      humanLabel: generateHumanLabel(
        c.factorA,
        c.factorB,
        c.direction as 'positive' | 'negative',
        c.effectSizePct!,
      ),
      // Naturopath enrichments (optional — frontend renders if present)
      ...(enrichment && {
        explanation: enrichment.explanation,
        mechanism: enrichment.mechanism,
        recommendation: enrichment.recommendation,
        caveat: enrichment.caveat,
      }),
    };
  });

  // Build response with optional naturopath enrichments
  const response: Record<string, unknown> = {
    correlations,
    lastComputed,
    dataQuality,
    totalFound,
  };

  if (pipelineInsight?.helpsHurtsJson) {
    response.helpsHurts = pipelineInsight.helpsHurtsJson;
  }
  if (pipelineInsight?.contradictionsJson) {
    response.contradictions = pipelineInsight.contradictionsJson;
  }

  return NextResponse.json(response);
}
