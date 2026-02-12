import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  });

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  const existing = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  });

  if (existing) {
    const updated = await db
      .update(profiles)
      .set({
        name: body.name ?? existing.name,
        email: body.email ?? existing.email,
        dateOfBirth: body.dateOfBirth ?? existing.dateOfBirth,
        stage: body.stage ?? existing.stage,
        symptoms: body.symptoms ?? existing.symptoms,
        goals: body.goals ?? existing.goals,
        onboardingComplete: body.onboardingComplete ?? existing.onboardingComplete,
      })
      .where(eq(profiles.userId, userId))
      .returning();
    return NextResponse.json(updated[0]);
  }

  const newProfile = await db
    .insert(profiles)
    .values({
      userId,
      name: body.name,
      email: body.email,
      dateOfBirth: body.dateOfBirth,
      stage: body.stage,
      symptoms: body.symptoms || [],
      goals: body.goals || [],
      onboardingComplete: body.onboardingComplete || false,
    })
    .returning();

  return NextResponse.json(newProfile[0], { status: 201 });
}
