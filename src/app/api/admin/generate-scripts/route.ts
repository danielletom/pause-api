/**
 * API endpoint to run the pipeline writer stage for meditation & affirmation content.
 * Uses Claude via Vercel AI Gateway to generate scripts with timing/breathing cues.
 *
 * POST /api/admin/generate-scripts
 * Auth: CRON_SECRET bearer token
 * Body: { ids?: number[], type?: "meditation" | "affirmation", limit?: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { content } from "@/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";

export const maxDuration = 300; // 5 min timeout for batch generation

// ── Auth ──────────────────────────────────────────────────────────────────────

function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

// ── Prompts (from pipeline/02-writer.ts) ──────────────────────────────────────

const BASE_PROMPT = `You are a content writer for Pause, a menopause wellness app for women aged 42-55.
Your audience is overwhelmed, under-informed, and getting conflicting advice. She is smart but not a medical professional.

TONE: Warm, encouraging, evidence-based, jargon-free. Never clinical or condescending. Never "woo" or mystical.
STYLE: Practical and actionable. "Just tell me what to do" energy.`;

function getMeditationPrompt(duration: number): string {
  return `${BASE_PROMPT}

FORMAT: Guided meditation script for audio recording.
NARRATOR: Calm, slow-paced, soothing female voice.

SCRIPT RULES:
- Include timing cues: [PAUSE 3s], [PAUSE 5s], [PAUSE 10s]
- Include music cues: [MUSIC: soft ambient], [MUSIC: nature sounds], [MUSIC: gentle fade out]
- Include breathing cues: [BREATHE IN... 4 counts], [BREATHE OUT... 6 counts]
- Very slow pacing — lots of pauses between sentences
- Never use clinical language — use imagery and metaphor
- End with a gentle return to awareness
- Target ${duration} minutes at ~100 words/minute (accounting for pauses)
- Write the FULL script, not a summary or outline`;
}

function getAffirmationPrompt(duration: number): string {
  return `${BASE_PROMPT}

FORMAT: Positive affirmation sequence for audio recording.
NARRATOR: Confident, warm, empowering female voice.

SCRIPT RULES:
- Use "I am..." and "I choose..." and "I allow..." statements
- Include [PAUSE 2s] between each affirmation
- Include [PAUSE 5s] between thematic sections
- Include [BREATHE IN... 4 counts], [BREATHE OUT... 6 counts] between sections
- Group affirmations into 3-4 thematic clusters
- End with a powerful closing statement
- Target ${duration} minutes at ~80 words/minute
- Write the FULL script, not a summary or outline`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!checkAuth(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { ids, type, limit = 4 } = body as {
    ids?: number[];
    type?: string;
    limit?: number;
  };

  // Fetch target items
  let items;
  if (ids && ids.length > 0) {
    items = await db
      .select()
      .from(content)
      .where(inArray(content.id, ids));
  } else if (type) {
    items = await db
      .select()
      .from(content)
      .where(eq(content.contentType, type));
  } else {
    // Default: all meditations and affirmations without bodyMarkdown
    items = await db
      .select()
      .from(content)
      .where(
        and(
          inArray(content.contentType, ["meditation", "affirmation"]),
          isNull(content.audioUrl)
        )
      );
  }

  // Limit batch size
  const batch = items.slice(0, limit);

  const results: { id: number; title: string; status: string; wordCount?: number; estimatedMinutes?: number }[] = [];

  for (const item of batch) {
    try {
      const duration = item.durationMinutes || (item.contentType === "affirmation" ? 5 : 10);
      const systemPrompt =
        item.contentType === "meditation"
          ? getMeditationPrompt(duration)
          : getAffirmationPrompt(duration);

      const userPrompt = `Write content for: "${item.title}"

Description: ${item.description || "No description provided."}
Category: ${item.category || "General"}
Target duration: ${duration} minutes`;

      const { text } = await generateText({
        model: gateway("anthropic/claude-sonnet-4-20250514"),
        maxOutputTokens: Math.max(4096, duration * 150),
        system: systemPrompt,
        prompt: userPrompt,
      });

      const script = text.trim();
      const wordCount = script.split(/\s+/).length;
      const wpm = item.contentType === "meditation" ? 100 : 80;
      const estimatedMinutes = Math.round(wordCount / wpm);

      // Save script as bodyMarkdown (also serves as the TTS input)
      await db
        .update(content)
        .set({ bodyMarkdown: script, updatedAt: new Date() })
        .where(eq(content.id, item.id));

      results.push({
        id: item.id,
        title: item.title,
        status: "generated",
        wordCount,
        estimatedMinutes,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.push({
        id: item.id,
        title: item.title,
        status: `error: ${msg.slice(0, 100)}`,
      });
    }
  }

  return NextResponse.json({
    generated: results.filter((r) => r.status === "generated").length,
    errors: results.filter((r) => r.status.startsWith("error")).length,
    total: items.length,
    batchSize: batch.length,
    results,
  });
}
