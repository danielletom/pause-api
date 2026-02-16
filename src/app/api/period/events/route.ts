import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bleedingEvents, cycles, profiles } from "@/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import {
  getSourceCategory,
  shouldFlagGP,
  validateEventData,
  getPeakFlow,
} from "@/lib/period/triage";
import { computeCycleAnalytics } from "@/lib/period/compute-cycle-analytics";

// POST /api/period/events — create a new bleeding event
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Validate
  const validationError = validateEventData({
    type: body.type,
    eventDate: body.eventDate,
    flowIntensity: body.flowIntensity,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // Check if user has declared menopause
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  });
  const hasDeclaredMenopause = !!profile?.menopauseDeclaredAt;

  // Determine source category & GP flag
  const sourceCategory =
    body.sourceCategory || getSourceCategory(body.type);
  const gpFlag = shouldFlagGP({
    type: body.type,
    flowIntensity: body.flowIntensity,
    hasClotting: body.hasClotting,
    clotSize: body.clotSize,
    hasDeclaredMenopause,
  });

  let cycleId: number | null = null;

  // If period_start, create a new cycle and close any active one
  if (body.type === "period_start") {
    // Complete any active cycle
    const activeCycle = await db
      .select()
      .from(cycles)
      .where(and(eq(cycles.userId, userId), eq(cycles.status, "active")))
      .limit(1);

    if (activeCycle.length > 0) {
      const prev = activeCycle[0];
      const startDate = new Date(prev.startDate);
      const endDate = new Date(body.eventDate);
      const cycleLength = Math.round(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Get all events in previous cycle to compute summary
      const prevEvents = await db
        .select()
        .from(bleedingEvents)
        .where(eq(bleedingEvents.cycleId, prev.id));

      const flows = prevEvents.map((e) => e.flowIntensity);
      const peakFlow = getPeakFlow(flows);

      // Count period days (non-spotting events)
      const periodDays = prevEvents.filter(
        (e) =>
          e.type === "period_start" ||
          e.type === "period_daily" ||
          e.type === "period_end"
      ).length;

      // Count spotting events before the period started
      const spottingEvents = prevEvents.filter(
        (e) => e.type === "spotting"
      ).length;

      await db
        .update(cycles)
        .set({
          status: "completed",
          endDate: body.eventDate,
          cycleLength,
          periodLength: periodDays > 0 ? periodDays : null,
          peakFlow,
          spottingEvents,
          updatedAt: new Date(),
        })
        .where(eq(cycles.id, prev.id));
    }

    // Create new active cycle
    const [newCycle] = await db
      .insert(cycles)
      .values({
        userId,
        startDate: body.eventDate,
        status: "active",
      })
      .returning();

    cycleId = newCycle.id;
  } else {
    // For non-start events, attach to active cycle if one exists
    const activeCycle = await db
      .select()
      .from(cycles)
      .where(and(eq(cycles.userId, userId), eq(cycles.status, "active")))
      .limit(1);

    if (activeCycle.length > 0) {
      cycleId = activeCycle[0].id;
    }
  }

  // Create the bleeding event
  const [event] = await db
    .insert(bleedingEvents)
    .values({
      userId,
      type: body.type,
      eventDate: body.eventDate,
      flowIntensity: body.flowIntensity || null,
      hasClotting: body.hasClotting ?? null,
      clotSize: body.clotSize || null,
      painLevel: body.painLevel || null,
      symptoms: body.symptoms || [],
      mood: body.mood || null,
      sourceCategory,
      gpFlag,
      notes: body.notes || null,
      cycleId,
    })
    .returning();

  // Recompute analytics in background
  computeCycleAnalytics(userId).catch(console.error);

  return NextResponse.json(event, { status: 201 });
}

// GET /api/period/events — list bleeding events with optional filters
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const type = searchParams.get("type");

  const conditions = [eq(bleedingEvents.userId, userId)];
  if (from) conditions.push(gte(bleedingEvents.eventDate, from));
  if (to) conditions.push(lte(bleedingEvents.eventDate, to));
  if (type) conditions.push(eq(bleedingEvents.type, type));

  const events = await db
    .select()
    .from(bleedingEvents)
    .where(and(...conditions))
    .orderBy(desc(bleedingEvents.eventDate));

  return NextResponse.json(events);
}
