import { NextResponse } from 'next/server';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { signToken, verifyAppleToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identityToken, firstName, lastName, email } = body;

    if (!identityToken) {
      return NextResponse.json({ error: 'Missing identity token' }, { status: 400 });
    }

    // Verify the Apple identity token
    const appleUser = await verifyAppleToken(identityToken);
    const userId = `apple_${appleUser.sub}`;

    // Find or create user
    let user = await db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
    });

    const userEmail = email || appleUser.email;
    const userName = [firstName, lastName].filter(Boolean).join(' ') || undefined;

    if (!user) {
      const [newUser] = await db.insert(profiles).values({
        userId,
        name: userName,
        email: userEmail,
        onboardingComplete: false,
      }).returning();
      user = newUser;
    } else if (userName || userEmail) {
      // Update name/email if provided (Apple only sends these on first sign-in)
      await db.update(profiles).set({
        ...(userName && !user.name ? { name: userName } : {}),
        ...(userEmail && !user.email ? { email: userEmail } : {}),
      }).where(eq(profiles.userId, userId));
    }

    // Generate JWT
    const token = await signToken(userId);

    return NextResponse.json({
      token,
      firstName: user?.name?.split(' ')[0] || firstName || '',
      email: user?.email || userEmail || '',
    });
  } catch (error) {
    console.error('Apple auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
}
