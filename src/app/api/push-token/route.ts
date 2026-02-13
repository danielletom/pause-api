import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { pushTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = await db.query.pushTokens.findFirst({
    where: eq(pushTokens.userId, userId),
  });

  return NextResponse.json(token || null);
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  const existing = await db.query.pushTokens.findFirst({
    where: eq(pushTokens.userId, userId),
  });

  if (existing) {
    const updated = await db
      .update(pushTokens)
      .set({
        expoToken: body.expoToken,
        platform: body.platform,
      })
      .where(eq(pushTokens.userId, userId))
      .returning();
    return NextResponse.json(updated[0]);
  }

  const newToken = await db
    .insert(pushTokens)
    .values({
      userId,
      expoToken: body.expoToken,
      platform: body.platform,
    })
    .returning();

  return NextResponse.json(newToken[0], { status: 201 });
}
