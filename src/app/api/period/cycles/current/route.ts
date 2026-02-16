import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { cycles, bleedingEvents } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

// GET /api/period/cycles/current — get active cycle with daily logs
export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activeCycle = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.userId, userId), eq(cycles.status, "active")))
    .limit(1);

  if (activeCycle.length === 0) {
    return NextResponse.json({ cycle: null, events: [], daysSinceStart: null });
  }

  const cycle = activeCycle[0];

  // Get all events for this cycle
  const events = await db
    .select()
    .from(bleedingEvents)
    .where(eq(bleedingEvents.cycleId, cycle.id))
    .orderBy(desc(bleedingEvents.eventDate));

  // Calculate days since start
  const startDate = new Date(cycle.startDate);
  const today = new Date();
  const daysSinceStart = Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return NextResponse.json({
    cycle,
    events,
    daysSinceStart,
  });
}
