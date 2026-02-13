import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/cron-auth';
import { computeAllUserScores } from '@/lib/compute-scores';

export async function GET(request: NextRequest) {
  const unauthorized = verifyCronSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await computeAllUserScores();
    return NextResponse.json({
      success: true,
      ...result,
      computedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cron/compute-scores] Failed:', error);
    return NextResponse.json(
      { error: 'Score computation failed' },
      { status: 500 }
    );
  }
}
