import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { subscriptions, profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/admin/set-tier
 * Body: { email: string, tier: "free" | "premium" | "premium_plus" }
 *
 * Sets a user's subscription tier. Creates a subscription row if none exists.
 * Protected by ADMIN_SECRET header.
 */
export async function POST(request: NextRequest) {
  const adminSecret = request.headers.get('x-admin-secret');
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email, tier } = await request.json();
  if (!email || !tier) {
    return NextResponse.json({ error: 'email and tier required' }, { status: 400 });
  }

  // Look up userId from profiles by matching Clerk email
  // Since profiles use Clerk userId, we need to find by email in profiles
  const allProfiles = await db
    .select({ userId: profiles.userId, email: profiles.email })
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);

  if (allProfiles.length === 0) {
    return NextResponse.json({ error: `No profile found for ${email}` }, { status: 404 });
  }

  const userId = allProfiles[0].userId;

  // Upsert subscription
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(subscriptions)
      .set({ tier, status: 'active', provider: 'admin' })
      .where(eq(subscriptions.userId, userId));
  } else {
    await db.insert(subscriptions).values({
      userId,
      tier,
      status: 'active',
      provider: 'admin',
      startedAt: new Date(),
    });
  }

  return NextResponse.json({ ok: true, userId, tier });
}
