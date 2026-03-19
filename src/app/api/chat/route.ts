import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { dailyLogs, profiles, medications, userCorrelations as correlationsTable } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Build rich user context for the AI
async function buildUserContext(userId: string) {
  const today = new Date().toISOString().split('T')[0];

  const [profile, recentLogs, userMeds, userCorrelations] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, userId)).then(r => r[0]),
    db.select().from(dailyLogs)
      .where(eq(dailyLogs.userId, userId))
      .orderBy(desc(dailyLogs.date))
      .limit(14),
    db.select().from(medications).where(eq(medications.userId, userId)),
    db.select().from(correlationsTable)
      .where(eq(correlationsTable.userId, userId))
      .orderBy(desc(correlationsTable.effectSizePct))
      .limit(10),
  ]);

  // Compute summary
  const last7 = recentLogs.slice(0, 7);
  const avgMood = last7.filter(l => l.mood).reduce((s, l) => s + (l.mood ?? 0), 0) / Math.max(1, last7.filter(l => l.mood).length);
  const avgSleep = last7.filter(l => l.sleepHours).reduce((s, l) => s + (l.sleepHours ?? 0), 0) / Math.max(1, last7.filter(l => l.sleepHours).length);

  // Top symptoms this week
  const symptomCounts: Record<string, number> = {};
  last7.forEach(l => {
    const symptoms = l.symptomsJson as Record<string, number> | null;
    if (symptoms) {
      Object.keys(symptoms).forEach(s => { symptomCounts[s] = (symptomCounts[s] || 0) + 1; });
    }
  });
  const topSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => `${name.replace(/_/g, ' ')} (${count}/7 days)`);

  // Correlations
  const helps = userCorrelations
    .filter(c => c.direction === 'negative')
    .slice(0, 4)
    .map(c => `${c.factorA?.replace(/_/g, ' ')} reduces ${c.factorB?.replace(/_/g, ' ')} by ${c.effectSizePct}%`);

  const hurts = userCorrelations
    .filter(c => c.direction === 'positive')
    .slice(0, 4)
    .map(c => `${c.factorA?.replace(/_/g, ' ')} increases ${c.factorB?.replace(/_/g, ' ')} by ${c.effectSizePct}%`);

  const medsList = userMeds.map(m => `${m.name}${m.dose ? ` (${m.dose})` : ''}`);

  const todayLog = recentLogs.find(l => l.date === today);
  const todaySymptoms = todayLog?.symptomsJson as Record<string, number> | null;

  return `
USER PROFILE:
- Name: ${profile?.name || 'User'}
- Stage: ${profile?.stage || 'perimenopause'}
- Age group: ${(profile as any)?.ageRange || 'unknown'}
- Tracking for: ${recentLogs.length} days

THIS WEEK (last 7 days):
- Average mood: ${avgMood.toFixed(1)}/5
- Average sleep: ${avgSleep.toFixed(1)} hours
- Top symptoms: ${topSymptoms.length > 0 ? topSymptoms.join(', ') : 'None logged'}
${todayLog ? `- Today: mood ${todayLog.mood}/5, sleep ${todayLog.sleepHours}h` : '- No check-in today yet'}
${todaySymptoms ? `- Today's symptoms: ${Object.keys(todaySymptoms).map(s => s.replace(/_/g, ' ')).join(', ')}` : ''}

MEDICATIONS & SUPPLEMENTS:
${medsList.length > 0 ? medsList.join(', ') : 'None tracked'}

PATTERNS (correlations from their data):
Helps: ${helps.length > 0 ? helps.join('; ') : 'Not enough data yet'}
Hurts: ${hurts.length > 0 ? hurts.join('; ') : 'Not enough data yet'}

RECENT NOTES:
${recentLogs.slice(0, 5).filter(l => l.notes).map(l => `[${l.date}] ${l.notes}`).join('\n') || 'None'}
`.trim();
}

const SYSTEM_PROMPT = `You are Pause — think of yourself as a really knowledgeable friend who happens to know everything about menopause. You have the user's actual health tracking data below.

VIBE: Like texting a friend who's also a women's health expert. Chill, warm, zero judgment. Use "you" not "one". Short sentences. Occasional emoji is fine (max 1-2 per response).

TONE EXAMPLES:
- "So looking at your data..." not "Based on analysis of your metrics..."
- "That's super common btw" not "This is a frequently reported symptom"
- "Your sleep has been rough lately — and honestly that alone could explain the brain fog" not "Sleep disruption has been correlated with cognitive impairment"

RULES:
- Keep it SHORT. 2-3 paragraphs max. No walls of text.
- Use **bold** for the key thing they should remember
- Use bullet points sparingly — max 3-4 items
- Reference THEIR actual data: "I can see from your logs that..."
- Always validate first, then explain, then suggest ONE thing to try
- Never diagnose or prescribe. Say "worth chatting with your doctor about" not clinical advice
- End with something encouraging or a gentle next step

KNOWLEDGE: You know the SWAN study, WHI reanalysis, current HRT guidelines, supplement evidence, gut-hormone connection, estrogen-brain axis. But explain it like you're telling a friend over coffee, not writing a paper.`;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }

    const userContext = await buildUserContext(userId);

    const result = await generateText({
      model: openai('gpt-4o-mini'),
      system: `${SYSTEM_PROMPT}\n\n--- USER'S HEALTH DATA ---\n${userContext}`,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      temperature: 0.7,
      maxOutputTokens: 800,
    });

    return NextResponse.json({
      message: result.text,
      usage: result.usage,
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response', detail: error.message },
      { status: 500 }
    );
  }
}
