import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { medications } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const meds = await db.query.medications.findMany({
    where: and(eq(medications.userId, userId), eq(medications.active, true)),
  });

  return NextResponse.json(meds);
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  const newMed = await db
    .insert(medications)
    .values({
      userId,
      name: body.name,
      dose: body.dose,
      time: body.time,
      frequency: body.frequency || 'daily',
      type: body.type,
    })
    .returning();

  return NextResponse.json(newMed[0], { status: 201 });
}
