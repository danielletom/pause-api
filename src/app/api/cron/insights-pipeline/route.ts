import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/cron-auth';
import {
  runInsightsPipeline,
  runInsightsPipelineForUser,
} from '@/lib/insights-pipeline';

export const maxDuration = 120; // AI calls take longer — allow 2 minutes

export async function GET(request: NextRequest) {
  const unauthorized = verifyCronSecret(request);
  if (unauthorized) return unauthorized;

  // Support ?user=xxx for single-user test mode
  const { searchParams } = new URL(request.url);
  const testUserId = searchParams.get('user');

  if (testUserId) {
    const startMs = Date.now();
    try {
      const result = await runInsightsPipelineForUser(testUserId);
      return NextResponse.json({
        ...result,
        userId: testUserId,
        durationMs: Date.now() - startMs,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      return NextResponse.json(
        { error: errMsg, stack, userId: testUserId, durationMs: Date.now() - startMs },
        { status: 500 },
      );
    }
  }

  const startMs = Date.now();
  const result = await runInsightsPipeline();
  const durationMs = Date.now() - startMs;

  return NextResponse.json({
    ...result,
    durationMs,
  });
}
