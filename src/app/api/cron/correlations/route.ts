import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/cron-auth';
import { computeAllCorrelations } from '@/lib/compute-correlations';

export const maxDuration = 60; // Allow up to 60s for heavy computation

export async function GET(request: NextRequest) {
  const unauthorized = verifyCronSecret(request);
  if (unauthorized) return unauthorized;

  const result = await computeAllCorrelations();
  return NextResponse.json(result);
}
