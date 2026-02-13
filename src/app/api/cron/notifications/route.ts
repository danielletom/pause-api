import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { pushTokens, dailyLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  // Verify cron secret — not Clerk-authed
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];

  // Get all push tokens
  const tokens = await db.query.pushTokens.findMany();

  // Check who has logged today
  const todayLogs = await db.query.dailyLogs.findMany({
    columns: { userId: true, date: true },
  });
  const loggedUserIds = new Set(
    todayLogs
      .filter((l) => l.date === today)
      .map((l) => l.userId)
  );

  // Filter to users who haven't logged today
  const toNotify = tokens.filter((t) => !loggedUserIds.has(t.userId));

  if (toNotify.length === 0) {
    return NextResponse.json({ sent: 0, errors: 0 });
  }

  // Build Expo push messages
  const messages = toNotify.map((t) => ({
    to: t.expoToken,
    title: 'Time to check in',
    body: 'How are you feeling today? A quick log takes 30 seconds.',
    sound: 'default' as const,
    data: { screen: '/(app)/quick-log' },
  }));

  // Send via Expo push service (batches of 100)
  let sent = 0;
  let errors = 0;

  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(batch),
      });

      if (response.ok) {
        sent += batch.length;
      } else {
        errors += batch.length;
      }
    } catch {
      errors += batch.length;
    }
  }

  return NextResponse.json({ sent, errors });
}
