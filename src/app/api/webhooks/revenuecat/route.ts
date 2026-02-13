import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { subscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  verifyRevenueCatSignature,
  mapProductToTier,
  mapEventToStatus,
} from '@/lib/revenuecat';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-revenuecat-signature');

  if (!verifyRevenueCatSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = payload?.event;
  if (!event) {
    return NextResponse.json({ error: 'Missing event' }, { status: 400 });
  }

  const userId: string = event.app_user_id;
  const eventType: string = event.type;
  const productId: string = event.product_id ?? '';
  const expirationAtMs: number | null = event.expiration_at_ms ?? null;

  const tier = mapProductToTier(productId);
  const status = mapEventToStatus(eventType);
  const expiresAt = expirationAtMs ? new Date(expirationAtMs) : null;

  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(subscriptions)
      .set({
        tier,
        status,
        provider: 'revenuecat',
        expiresAt,
      })
      .where(eq(subscriptions.userId, userId));
  } else {
    await db.insert(subscriptions).values({
      userId,
      tier,
      status,
      provider: 'revenuecat',
      expiresAt,
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
