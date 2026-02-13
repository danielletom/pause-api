import { db } from '@/db';
import { subscriptions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export type Tier = 'free' | 'premium' | 'premium_plus';

const TIER_ORDER: Tier[] = ['free', 'premium', 'premium_plus'];

/**
 * Look up the user's active subscription tier.
 * Returns 'free' if no active subscription exists.
 */
export async function getUserTier(userId: string): Promise<Tier> {
  const sub = await db
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active'))
    )
    .limit(1);

  if (sub.length === 0) return 'free';

  const tier = sub[0].tier as Tier | null;
  return tier && TIER_ORDER.includes(tier) ? tier : 'free';
}

/**
 * Check whether the user's tier meets the minimum required tier.
 */
export function requireTier(userTier: Tier, minimumTier: Tier): boolean {
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(minimumTier);
}
