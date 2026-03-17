import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { waitlist, profiles } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/waitlist?product=supplement — check if user is on waitlist
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const product = url.searchParams.get('product') || 'supplement';

  const rows = await db
    .select()
    .from(waitlist)
    .where(and(eq(waitlist.userId, userId), eq(waitlist.product, product)))
    .limit(1);

  return NextResponse.json({ joined: rows.length > 0 });
}

// POST /api/waitlist — join waitlist
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { product = 'supplement' } = await request.json().catch(() => ({}));

  // Check if already on waitlist
  const existing = await db
    .select()
    .from(waitlist)
    .where(and(eq(waitlist.userId, userId), eq(waitlist.product, product)))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ ok: true, already: true });
  }

  // Get user email from profile
  const profile = await db
    .select({ email: profiles.email })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  await db.insert(waitlist).values({
    userId,
    email: profile[0]?.email ?? null,
    product,
  });

  return NextResponse.json({ ok: true });
}
