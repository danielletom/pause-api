import { NextRequest, NextResponse } from 'next/server';

/**
 * Verify the CRON_SECRET bearer token on cron job routes.
 * Returns a 401 NextResponse if invalid, or null if valid.
 */
export function verifyCronSecret(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
