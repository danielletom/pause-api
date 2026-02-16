/**
 * Compute and cache cycle analytics for a user.
 * Called after every bleeding event to keep stats fresh.
 */
import { db } from "@/db";
import { cycles, cycleAnalytics, bleedingEvents } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

// Flow intensity ordering for comparisons
const FLOW_ORDER: Record<string, number> = {
  spotting: 1,
  light: 2,
  medium: 3,
  heavy: 4,
  very_heavy: 5,
};

export async function computeCycleAnalytics(userId: string) {
  // Get all completed cycles
  const completedCycles = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.userId, userId), eq(cycles.status, "completed")))
    .orderBy(desc(cycles.startDate));

  const allCycles = await db
    .select()
    .from(cycles)
    .where(eq(cycles.userId, userId))
    .orderBy(desc(cycles.startDate));

  if (completedCycles.length === 0) {
    // Not enough data — remove stale analytics if any
    await db
      .delete(cycleAnalytics)
      .where(eq(cycleAnalytics.userId, userId));
    return null;
  }

  // ── Basic averages ──────────────────────────────────────
  const cycleLengths = completedCycles
    .map((c) => c.cycleLength)
    .filter((l): l is number => l !== null);
  const periodLengths = completedCycles
    .map((c) => c.periodLength)
    .filter((l): l is number => l !== null);

  const avgCycleLength =
    cycleLengths.length > 0
      ? cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length
      : null;
  const avgPeriodLength =
    periodLengths.length > 0
      ? periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length
      : null;

  // ── Variance and range ──────────────────────────────────
  const cycleRangeMin = cycleLengths.length > 0 ? Math.min(...cycleLengths) : null;
  const cycleRangeMax = cycleLengths.length > 0 ? Math.max(...cycleLengths) : null;
  const cycleVariance =
    cycleRangeMin !== null && cycleRangeMax !== null
      ? cycleRangeMax - cycleRangeMin
      : null;

  // Human-friendly label: "4–7 weeks"
  const cycleRangeLabel =
    cycleRangeMin !== null && cycleRangeMax !== null
      ? `${Math.round(cycleRangeMin / 7)}–${Math.round(cycleRangeMax / 7)} weeks`
      : null;

  // ── Stage estimation ────────────────────────────────────
  let stage: string | null = null;
  let stageConfidence = 0;

  if (cycleLengths.length >= 3) {
    if (cycleVariance !== null) {
      if (cycleVariance <= 7) {
        stage = "early_peri";
        stageConfidence = 0.6;
      } else if (cycleVariance <= 20) {
        stage = "mid_peri";
        stageConfidence = 0.7;
      } else if (cycleVariance <= 40) {
        stage = "late_peri";
        stageConfidence = 0.65;
      } else {
        stage = "approaching_menopause";
        stageConfidence = 0.5;
      }
    }
  }

  // ── Longest gap ─────────────────────────────────────────
  const longestGapDays =
    cycleLengths.length > 0 ? Math.max(...cycleLengths) : null;

  // ── Variability trend (first half vs second half) ───────
  let variabilityTrend: string = "stable";
  if (cycleLengths.length >= 6) {
    const mid = Math.floor(cycleLengths.length / 2);
    const firstHalf = cycleLengths.slice(mid); // older cycles (reversed order)
    const secondHalf = cycleLengths.slice(0, mid); // newer cycles
    const firstVariance =
      Math.max(...firstHalf) - Math.min(...firstHalf);
    const secondVariance =
      Math.max(...secondHalf) - Math.min(...secondHalf);
    if (secondVariance > firstVariance + 5) variabilityTrend = "increasing";
    else if (firstVariance > secondVariance + 5) variabilityTrend = "decreasing";
  }

  // ── Flow trend ──────────────────────────────────────────
  let flowTrend: string = "stable";
  if (completedCycles.length >= 4) {
    const recentFlows = completedCycles
      .slice(0, Math.floor(completedCycles.length / 2))
      .map((c) => FLOW_ORDER[c.peakFlow || ""] || 0);
    const olderFlows = completedCycles
      .slice(Math.floor(completedCycles.length / 2))
      .map((c) => FLOW_ORDER[c.peakFlow || ""] || 0);
    const avgRecent =
      recentFlows.reduce((a, b) => a + b, 0) / recentFlows.length;
    const avgOlder =
      olderFlows.reduce((a, b) => a + b, 0) / olderFlows.length;
    if (avgRecent > avgOlder + 0.5) flowTrend = "heavier";
    else if (avgOlder > avgRecent + 0.5) flowTrend = "lighter";
  }

  // ── Prediction ──────────────────────────────────────────
  let predictedNextStart: string | null = null;
  let predictionWindowDays: number | null = null;
  let predictionConfidence: string | null = null;

  if (avgCycleLength && allCycles.length > 0) {
    const lastCycleStart = allCycles[0].startDate;
    if (lastCycleStart) {
      const startDate = new Date(lastCycleStart);
      const predictedDate = new Date(startDate);
      predictedDate.setDate(predictedDate.getDate() + Math.round(avgCycleLength));
      predictedNextStart = predictedDate.toISOString().split("T")[0];

      if (cycleVariance !== null && cycleVariance > 20) {
        predictionWindowDays = Math.max(10, Math.round(cycleVariance / 2));
        predictionConfidence = "low";
      } else if (cycleVariance !== null && cycleVariance > 7) {
        predictionWindowDays = Math.max(5, Math.round(cycleVariance / 3));
        predictionConfidence = "medium";
      } else {
        predictionWindowDays = 5;
        predictionConfidence = "high";
      }
    }
  }

  // ── Spotting patterns ───────────────────────────────────
  let spotsBeforePeriodPct = 0;
  let avgSpottingLeadDays: number | null = null;

  if (completedCycles.length >= 3) {
    const spottingBeforeCounts: number[] = [];
    for (const cycle of completedCycles) {
      if (cycle.spottingDaysBeforeStart && cycle.spottingDaysBeforeStart > 0) {
        spottingBeforeCounts.push(cycle.spottingDaysBeforeStart);
      }
    }
    spotsBeforePeriodPct =
      completedCycles.length > 0
        ? (spottingBeforeCounts.length / completedCycles.length) * 100
        : 0;
    avgSpottingLeadDays =
      spottingBeforeCounts.length > 0
        ? spottingBeforeCounts.reduce((a, b) => a + b, 0) /
          spottingBeforeCounts.length
        : null;
  }

  // ── Upsert analytics ───────────────────────────────────
  const existing = await db
    .select({ id: cycleAnalytics.id })
    .from(cycleAnalytics)
    .where(eq(cycleAnalytics.userId, userId))
    .limit(1);

  const data = {
    userId,
    computedAt: new Date(),
    avgCycleLength,
    avgPeriodLength,
    cycleVariance,
    cycleRangeMin,
    cycleRangeMax,
    cycleRangeLabel,
    stage,
    stageConfidence,
    variabilityTrend,
    flowTrend,
    longestGapDays,
    predictedNextStart,
    predictionWindowDays,
    predictionConfidence,
    spotsBeforePeriodPct,
    avgSpottingLeadDays,
  };

  if (existing.length > 0) {
    await db
      .update(cycleAnalytics)
      .set(data)
      .where(eq(cycleAnalytics.userId, userId));
  } else {
    await db.insert(cycleAnalytics).values(data);
  }

  return data;
}
