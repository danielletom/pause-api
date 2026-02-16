import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { cycleAnalytics } from "@/db/schema";
import { eq } from "drizzle-orm";
import { computeCycleAnalytics } from "@/lib/period/compute-cycle-analytics";

// GET /api/period/cycles/analytics — return cached cycle analytics
export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check for existing analytics
  const existing = await db
    .select()
    .from(cycleAnalytics)
    .where(eq(cycleAnalytics.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    const analytics = existing[0];

    // Recompute if stale (older than 24 hours)
    const computedAt = analytics.computedAt
      ? new Date(analytics.computedAt)
      : null;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (!computedAt || computedAt < oneDayAgo) {
      // Recompute in background, return stale data for now
      computeCycleAnalytics(userId).catch(console.error);
    }

    return NextResponse.json(analytics);
  }

  // No analytics yet — compute fresh
  const fresh = await computeCycleAnalytics(userId);

  if (!fresh) {
    return NextResponse.json({
      message: "Not enough data to compute analytics",
      avgCycleLength: null,
      avgPeriodLength: null,
      stage: null,
      predictedNextStart: null,
    });
  }

  return NextResponse.json(fresh);
}
