import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { gratitudeEntries } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

/* ── GET: Return a random gratitude entry ─────────────────────────── */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [entry] = await db
    .select()
    .from(gratitudeEntries)
    .where(eq(gratitudeEntries.userId, userId))
    .orderBy(sql`RANDOM()`)
    .limit(1);

  if (!entry) {
    return NextResponse.json({ error: 'No gratitude entries yet' }, { status: 404 });
  }

  return NextResponse.json(entry);
}
