import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sosEvents } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const events = await db.query.sosEvents.findMany({
    where: eq(sosEvents.userId, userId),
    orderBy: [desc(sosEvents.startedAt)],
  });

  return NextResponse.json({ events, count: events.length });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  const newEvent = await db
    .insert(sosEvents)
    .values({
      userId,
      completed: body.completed ?? true,
      durationSeconds: body.durationSeconds,
      rating: body.rating,
    })
    .returning();

  return NextResponse.json(newEvent[0], { status: 201 });
}
