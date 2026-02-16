import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bleedingEvents, cycles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getPeakFlow } from "@/lib/period/triage";
import { computeCycleAnalytics } from "@/lib/period/compute-cycle-analytics";

// POST /api/period/events/:id/convert-to-period — convert spotting to period_start
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const eventId = parseInt(id, 10);
  if (isNaN(eventId)) {
    return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
  }

  // Fetch the event
  const existing = await db
    .select()
    .from(bleedingEvents)
    .where(and(eq(bleedingEvents.id, eventId), eq(bleedingEvents.userId, userId)))
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const event = existing[0];

  if (event.type !== "spotting" && event.type !== "light_bleeding") {
    return NextResponse.json(
      { error: "Only spotting or light_bleeding events can be converted" },
      { status: 400 }
    );
  }

  // Close any active cycle
  const activeCycle = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.userId, userId), eq(cycles.status, "active")))
    .limit(1);

  if (activeCycle.length > 0) {
    const prev = activeCycle[0];
    const startDate = new Date(prev.startDate);
    const endDate = new Date(event.eventDate);
    const cycleLength = Math.round(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Get previous cycle events for summary
    const prevEvents = await db
      .select()
      .from(bleedingEvents)
      .where(eq(bleedingEvents.cycleId, prev.id));

    const flows = prevEvents.map((e) => e.flowIntensity);
    const peakFlow = getPeakFlow(flows);
    const periodDays = prevEvents.filter(
      (e) =>
        e.type === "period_start" ||
        e.type === "period_daily" ||
        e.type === "period_end"
    ).length;

    await db
      .update(cycles)
      .set({
        status: "completed",
        endDate: event.eventDate,
        cycleLength,
        periodLength: periodDays > 0 ? periodDays : null,
        peakFlow,
        updatedAt: new Date(),
      })
      .where(eq(cycles.id, prev.id));
  }

  // Create new cycle starting from this event's date
  const [newCycle] = await db
    .insert(cycles)
    .values({
      userId,
      startDate: event.eventDate,
      status: "active",
    })
    .returning();

  // Update the event: convert type and link to new cycle
  const [updated] = await db
    .update(bleedingEvents)
    .set({
      type: "period_start",
      sourceCategory: "period",
      convertedFromSpotting: true,
      cycleId: newCycle.id,
      updatedAt: new Date(),
    })
    .where(eq(bleedingEvents.id, eventId))
    .returning();

  // Recompute analytics
  computeCycleAnalytics(userId).catch(console.error);

  return NextResponse.json({
    event: updated,
    cycle: newCycle,
  });
}
