import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { subscriptions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getUserTier } from '@/lib/feature-gate';

const FREE_FEATURES = ['basic_logging', 'insights_preview', 'sos_breathing'];

const PREMIUM_FEATURES = [
  ...FREE_FEATURES,
  'full_correlations',
  'full_benchmarks',
  'ai_narratives',
  'export_pdf',
  'doctor_report',
];

const PREMIUM_PLUS_FEATURES = [
  ...PREMIUM_FEATURES,
  'lab_upload',
  'wearable_sync',
  'priority_support',
];

function getFeaturesForTier(tier: string): string[] {
  switch (tier) {
    case 'premium_plus':
      return PREMIUM_PLUS_FEATURES;
    case 'premium':
      return PREMIUM_FEATURES;
    default:
      return FREE_FEATURES;
  }
}

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tier = await getUserTier(userId);

  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  const subscription = rows[0] ?? null;

  const features = getFeaturesForTier(tier);

  return NextResponse.json({
    tier,
    status: subscription?.status ?? null,
    expiresAt: subscription?.expiresAt?.toISOString() ?? null,
    features,
  });
}
