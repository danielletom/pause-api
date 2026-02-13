import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { dailyLogs, userCorrelations } from '@/db/schema';
import { eq, desc, countDistinct, max } from 'drizzle-orm';
import { getUserTier } from '@/lib/feature-gate';

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

  const tier = await getUserTier(userId);

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
    .orderBy(desc(userCorrelations.effectSizePct));

  const totalFound = allCorrelations.length;

  // Free tier: only top 2; premium: all
  const visibleCorrelations =
    tier === 'free' ? allCorrelations.slice(0, 2) : allCorrelations;

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

  // Shape the response
  const correlations = visibleCorrelations.map((c) => ({
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
  }));

  return NextResponse.json({
    correlations,
    lastComputed,
    dataQuality,
    totalFound,
  });
}
