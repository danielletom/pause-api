import { createHmac, timingSafeEqual } from 'crypto';

export function verifyRevenueCatSignature(
  body: string,
  signature: string | null
): boolean {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return false;
  }

  const computedHmac = createHmac('sha256', secret).update(body).digest('hex');

  const sigBuffer = Buffer.from(signature, 'utf-8');
  const computedBuffer = Buffer.from(computedHmac, 'utf-8');

  if (sigBuffer.length !== computedBuffer.length) {
    return false;
  }

  return timingSafeEqual(sigBuffer, computedBuffer);
}

const PRODUCT_TIER_MAP: Record<string, 'premium' | 'premium_plus'> = {
  pause_premium_monthly: 'premium',
  pause_premium_annual: 'premium',
  pause_plus_monthly: 'premium_plus',
  pause_plus_annual: 'premium_plus',
};

export function mapProductToTier(
  productId: string
): 'free' | 'premium' | 'premium_plus' {
  return PRODUCT_TIER_MAP[productId] ?? 'free';
}

const EVENT_STATUS_MAP: Record<string, string> = {
  INITIAL_PURCHASE: 'active',
  RENEWAL: 'active',
  PRODUCT_CHANGE: 'active',
  UNCANCELLATION: 'active',
  CANCELLATION: 'cancelled',
  EXPIRATION: 'expired',
  BILLING_ISSUE: 'billing_issue',
};

export function mapEventToStatus(eventType: string): string {
  return EVENT_STATUS_MAP[eventType] ?? 'unknown';
}
