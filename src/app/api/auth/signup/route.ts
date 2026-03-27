import { NextResponse } from 'next/server';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { signToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Check if email already exists
    const existing = await db.query.profiles.findFirst({
      where: eq(profiles.email, email),
    });

    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    // Create user with email-based userId
    const userId = `email_${crypto.randomUUID()}`;
    const name = [firstName, lastName].filter(Boolean).join(' ') || undefined;

    await db.insert(profiles).values({
      userId,
      name,
      email,
      onboardingComplete: false,
    });

    // TODO: Store hashed password once password column is added to schema

    const token = await signToken(userId);

    return NextResponse.json({
      token,
      firstName: firstName || '',
      email,
    });
  } catch (error) {
    console.error('Sign up error:', error);
    return NextResponse.json({ error: 'Sign up failed' }, { status: 500 });
  }
}
