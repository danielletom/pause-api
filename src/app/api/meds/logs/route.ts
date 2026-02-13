import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { medLogs, medications } from '@/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';

// GET /api/meds/logs?date=YYYY-MM-DD  → logs for a single day
// GET /api/meds/logs?range=7d          → logs for the last N days
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const range = searchParams.get('range');

  if (date) {
    const logs = await db.query.medLogs.findMany({
      where: and(eq(medLogs.userId, userId), eq(medLogs.date, date)),
    });
    return NextResponse.json(logs);
  }

  // Range query — default 7 days
  const days = parseInt(range || '7') || 7;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const logs = await db.query.medLogs.findMany({
    where: and(
      eq(medLogs.userId, userId),
      gte(medLogs.date, startDate.toISOString().split('T')[0]),
    ),
    orderBy: [desc(medLogs.date)],
  });

  return NextResponse.json(logs);
}
