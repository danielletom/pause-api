import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bleedingEvents, cycles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getPeakFlow } from "@/lib/period/triage";
import { computeCycleAnalytics } from "@/lib/period/compute-cycle-analytics";

// POST /api/period/daily — quick daily flow log for active period
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Must have an active cycle
  const activeCycle = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.userId, userId), eq(cycles.status, "active")))
    .limit(1);

  if (activeCycle.length === 0) {
    return NextResponse.json(
      { error: "No active period. Start a period first." },
      { status: 400 }
    );
  }

  const cycle = activeCycle[0];
  const today = new Date().toISOString().split("T")[0];
  const eventDate = body.eventDate || today;

  // If ending the period
  if (body.endPeriod) {
    // Create period_end event
    const [endEvent] = await db
      .insert(bleedingEvents)
      .values({
        userId,
        type: "period_end",
        eventDate,
        flowIntensity: body.flowIntensity || null,
        painLevel: body.painLevel || null,
        symptoms: body.symptoms || [],
        mood: body.mood || null,
        sourceCategory: "period",
        cycleId: cycle.id,
        notes: body.notes || null,
      })
      .returning();

    // Calculate period length
    const startDate = new Date(cycle.startDate);
    const endDate = new Date(eventDate);
    const periodLength =
      Math.round(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1; // inclusive

    // Get all events in this cycle for summary
    const cycleEvents = await db
      .select()
      .from(bleedingEvents)
      .where(eq(bleedingEvents.cycleId, cycle.id));

    const flows = cycleEvents.map((e) => e.flowIntensity);
    const peakFlow = getPeakFlow(flows);
    const spottingCount = cycleEvents.filter(
      (e) => e.type === "spotting"
    ).length;

    // Mark cycle period as ended (but cycle stays active until next period_start)
    await db
      .update(cycles)
      .set({
        periodLength,
        peakFlow,
        spottingEvents: spottingCount,
        updatedAt: new Date(),
      })
      .where(eq(cycles.id, cycle.id));

    // Recompute analytics
    computeCycleAnalytics(userId).catch(console.error);

    return NextResponse.json({
      event: endEvent,
      periodEnded: true,
      periodLength,
    });
  }

  // Normal daily log
  const [dailyEvent] = await db
    .insert(bleedingEvents)
    .values({
      userId,
      type: "period_daily",
      eventDate,
      flowIntensity: body.flowIntensity || null,
      hasClotting: body.hasClotting ?? null,
      clotSize: body.clotSize || null,
      painLevel: body.painLevel || null,
      symptoms: body.symptoms || [],
      mood: body.mood || null,
      sourceCategory: "period",
      cycleId: cycle.id,
      notes: body.notes || null,
    })
    .returning();

  // Recompute analytics
  computeCycleAnalytics(userId).catch(console.error);

  return NextResponse.json(dailyEvent, { status: 201 });
}
