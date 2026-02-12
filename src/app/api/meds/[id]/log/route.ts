import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { medLogs } from '@/db/schema';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const newLog = await db
    .insert(medLogs)
    .values({
      userId,
      medicationId: parseInt(id),
      date: new Date().toISOString().split('T')[0],
      taken: true,
      takenAt: new Date(),
    })
    .returning();

  return NextResponse.json(newLog[0], { status: 201 });
}
