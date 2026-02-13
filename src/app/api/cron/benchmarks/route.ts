import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/cron-auth';
import { computeAllBenchmarks } from '@/lib/compute-benchmarks';

export async function GET(request: NextRequest) {
  const unauthorized = verifyCronSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await computeAllBenchmarks();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Cron benchmarks error:', err);
    return NextResponse.json(
      { error: 'Benchmark computation failed' },
      { status: 500 },
    );
  }
}
