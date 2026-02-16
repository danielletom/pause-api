import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bleedingEvents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { computeCycleAnalytics } from "@/lib/period/compute-cycle-analytics";

// PUT /api/period/events/:id — update a bleeding event
export async function PUT(
  request: NextRequest,
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

  const body = await request.json();
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.flowIntensity !== undefined) updateData.flowIntensity = body.flowIntensity;
  if (body.hasClotting !== undefined) updateData.hasClotting = body.hasClotting;
  if (body.clotSize !== undefined) updateData.clotSize = body.clotSize;
  if (body.painLevel !== undefined) updateData.painLevel = body.painLevel;
  if (body.symptoms !== undefined) updateData.symptoms = body.symptoms;
  if (body.mood !== undefined) updateData.mood = body.mood;
  if (body.notes !== undefined) updateData.notes = body.notes;

  const [updated] = await db
    .update(bleedingEvents)
    .set(updateData)
    .where(and(eq(bleedingEvents.id, eventId), eq(bleedingEvents.userId, userId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Recompute analytics
  computeCycleAnalytics(userId).catch(console.error);

  return NextResponse.json(updated);
}

// DELETE /api/period/events/:id — delete a bleeding event
export async function DELETE(
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

  const [deleted] = await db
    .delete(bleedingEvents)
    .where(and(eq(bleedingEvents.id, eventId), eq(bleedingEvents.userId, userId)))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Recompute analytics
  computeCycleAnalytics(userId).catch(console.error);

  return NextResponse.json({ deleted: true, id: eventId });
}
