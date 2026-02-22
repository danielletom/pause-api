import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/cron-auth';
import {
  runInsightsPipeline,
  runInsightsPipelineForUser,
} from '@/lib/insights-pipeline';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export const maxDuration = 120; // AI calls take longer — allow 2 minutes

// ---------------------------------------------------------------------------
// Diagnostic: test OpenAI connectivity with a tiny call
// ---------------------------------------------------------------------------

async function testOpenAIConnection(): Promise<{
  ok: boolean;
  keyPresent: boolean;
  keyPrefix: string;
  keyLength: number;
  response?: string;
  error?: string;
  errorType?: string;
  durationMs: number;
}> {
  const key = process.env.OPENAI_API_KEY ?? '';
  const keyPresent = key.length > 0;
  const keyPrefix = key.slice(0, 10) + '...';
  const keyLength = key.length;

  const startMs = Date.now();
  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      maxOutputTokens: 20,
      prompt: 'Say "hello" and nothing else.',
      maxRetries: 0, // No retries — see the raw error
    });
    return {
      ok: true,
      keyPresent,
      keyPrefix,
      keyLength,
      response: text.trim(),
      durationMs: Date.now() - startMs,
    };
  } catch (err: unknown) {
    const errObj = err as Record<string, unknown>;
    return {
      ok: false,
      keyPresent,
      keyPrefix,
      keyLength,
      error: err instanceof Error ? err.message : String(err),
      errorType: err instanceof Error ? err.constructor.name : typeof err,
      durationMs: Date.now() - startMs,
    };
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const unauthorized = verifyCronSecret(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);

  // ?diag=true — just test OpenAI connectivity
  if (searchParams.get('diag') === 'true') {
    const result = await testOpenAIConnection();
    return NextResponse.json({ diagnostic: result });
  }

  // ?user=xxx — single-user test mode
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
