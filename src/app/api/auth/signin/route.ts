import { NextResponse } from 'next/server';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { signToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Find user by email
    const user = await db.query.profiles.findFirst({
      where: eq(profiles.email, email),
    });

    if (!user) {
      return NextResponse.json({ error: 'No account found with this email' }, { status: 401 });
    }

    // For now, accept any password for existing users migrating from Clerk
    // TODO: Add proper password hashing (bcrypt) once migration is complete
    const token = await signToken(user.userId);

    return NextResponse.json({
      token,
      firstName: user.name?.split(' ')[0] || '',
      email: user.email || '',
    });
  } catch (error) {
    console.error('Sign in error:', error);
    return NextResponse.json({ error: 'Sign in failed' }, { status: 500 });
  }
}
