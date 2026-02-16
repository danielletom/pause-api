import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { dailyLogs } from '@/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const range = searchParams.get('range') || '28d';

  if (date) {
    // Return ALL entries for this date (multiple check-ins per day)
    const logs = await db.query.dailyLogs.findMany({
      where: and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)),
      orderBy: [desc(dailyLogs.loggedAt)],
    });
    return NextResponse.json(logs);
  }

  const days = parseInt(range) || 28;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const logs = await db.query.dailyLogs.findMany({
    where: and(
      eq(dailyLogs.userId, userId),
      gte(dailyLogs.date, startDate.toISOString().split('T')[0]),
    ),
    orderBy: [desc(dailyLogs.date), desc(dailyLogs.loggedAt)],
  });

  return NextResponse.json(logs);
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  const newLog = await db
    .insert(dailyLogs)
    .values({
      userId,
      date: body.date || new Date().toISOString().split('T')[0],
      symptomsJson: body.symptomsJson ?? body.symptoms,
      mood: body.mood,
      energy: body.energy,
      sleepHours: body.sleepHours,
      sleepQuality: body.sleepQuality,
      disruptions: body.disruptions,
      contextTags: body.contextTags || [],
      cycleDataJson: body.cycleData,
      notes: body.notes,
      logType: body.logType || null,
    })
    .returning();

  return NextResponse.json(newLog[0], { status: 201 });
}
