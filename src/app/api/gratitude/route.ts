import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gratitudeEntries } from '@/db/schema';
import { eq, and, desc, sql, gte } from 'drizzle-orm';

/* ── Theme detection ──────────────────────────────────────────────── */
const THEME_KEYWORDS: Record<string, string[]> = {
  people: ['friend', 'mum', 'mom', 'dad', 'daughter', 'son', 'partner', 'husband', 'wife', 'colleague', 'sarah', 'jen', 'family', 'kids', 'children', 'she ', 'he ', 'they ', 'checked in', 'called', 'texted', 'laughed', 'together', 'coffee with', 'dinner with', 'lunch with', 'support', 'kind', 'love'],
  health: ['sleep', 'slept', 'body', 'walk', 'gym', 'yoga', 'exercise', 'headache', 'pain', 'supplements', 'medication', 'energy', 'woke up', 'rest', 'health', 'strong', 'progress', 'adjusting'],
  moments: ['sun', 'morning', 'quiet', 'garden', 'rain', 'window', 'sky', 'beautiful', 'light', 'nature', 'photo', 'music', 'cooking', 'moment', 'enjoyed', 'noticed', 'the way'],
  comfort: ['tea', 'coffee', 'bath', 'pillow', 'sofa', 'cosy', 'warm', 'blanket', 'candle', 'book', 'reading', 'salts', 'holding', 'cup', 'comfortable', 'soft'],
  growth: ['managed', 'realising', 'progress', 'learned', 'accomplished', 'deadline', 'said no', 'brave', 'handled', 'better than', 'evolving', 'changing', 'proud', 'goal', 'first time', 'new'],
};

function detectTheme(text: string): string {
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {};
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    scores[theme] = keywords.filter(kw => lower.includes(kw)).length;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : 'moments'; // default to moments
}

/* ── GET: List gratitude entries ──────────────────────────────────── */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '90d';
  const theme = searchParams.get('theme'); // optional filter
  const stats = searchParams.get('stats'); // if "true", return aggregate stats

  // Stats mode — return theme counts, streak, totals
  if (stats === 'true') {
    const allEntries = await db.query.gratitudeEntries.findMany({
      where: eq(gratitudeEntries.userId, userId),
      orderBy: [desc(gratitudeEntries.date)],
    });

    const themeCounts: Record<string, number> = {};
    const uniqueDates = new Set<string>();
    allEntries.forEach(e => {
      if (e.theme) themeCounts[e.theme] = (themeCounts[e.theme] || 0) + 1;
      uniqueDates.add(e.date);
    });

    // Calculate streak
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    const sortedDates = [...uniqueDates].sort((a, b) => b.localeCompare(a));
    const checkDate = new Date();
    if (sortedDates[0] !== today) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    for (const d of sortedDates) {
      const expected = checkDate.toISOString().split('T')[0];
      if (d === expected) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (d < expected) {
        break;
      }
    }

    // Top theme
    const topTheme = Object.entries(themeCounts).sort((a, b) => b[1] - a[1])[0];

    return NextResponse.json({
      totalCount: allEntries.length,
      uniqueDays: uniqueDates.size,
      streak,
      themeCounts,
      topTheme: topTheme ? { theme: topTheme[0], count: topTheme[1] } : null,
      firstEntryDate: sortedDates[sortedDates.length - 1] || null,
    });
  }

  // Feed mode — return entries for the date range
  const days = parseInt(range) || 90;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const conditions = [
    eq(gratitudeEntries.userId, userId),
    gte(gratitudeEntries.date, startDate.toISOString().split('T')[0]),
  ];
  if (theme) {
    conditions.push(eq(gratitudeEntries.theme, theme));
  }

  const entries = await db.query.gratitudeEntries.findMany({
    where: and(...conditions),
    orderBy: [desc(gratitudeEntries.date), desc(gratitudeEntries.createdAt)],
  });

  return NextResponse.json(entries);
}

/* ── POST: Create a gratitude entry ───────────────────────────────── */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  if (!body.text?.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  const theme = body.theme || detectTheme(body.text);
  const today = new Date().toISOString().split('T')[0];

  const [entry] = await db
    .insert(gratitudeEntries)
    .values({
      userId,
      date: body.date || today,
      text: body.text.trim(),
      theme,
      mood: body.mood || null,
      time: body.time || (new Date().getHours() < 14 ? 'morning' : 'evening'),
      sourceLogId: body.sourceLogId || null,
    })
    .returning();

  return NextResponse.json(entry, { status: 201 });
}
