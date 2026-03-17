import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { content, programProgress, profiles } from "@/db/schema";
import { eq, and, isNotNull, asc } from "drizzle-orm";

// Phase titles for The Pause Pod 14-day program
const PHASE_TITLES: Record<number, string> = {
  1: "Understand",
  2: "Track & Sleep",
  3: "Symptoms",
  4: "Body & Fuel",
  5: "Your Plan",
};

// Which absolute days belong to each phase
const PHASE_DAYS: Record<number, number[]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
  5: [13, 14],
};

const TOTAL_PHASES = 5;
const TOTAL_PROGRAM_DAYS = 14;

/**
 * Calculate the user's true calendar day in the program.
 * Day 1 = the day they started, increments by 1 each calendar day.
 * Capped at TOTAL_PROGRAM_DAYS (14).
 */
function getCalendarDay(programStartedAt: Date): number {
  const now = new Date();
  const start = new Date(programStartedAt);
  // Use UTC dates to avoid timezone drift
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceStart = Math.floor((today - startDay) / 86400000);
  return Math.min(Math.max(daysSinceStart + 1, 1), TOTAL_PROGRAM_DAYS);
}

/**
 * Get the phase number (1-5) for a given absolute program day (1-14).
 */
function getPhaseForDay(day: number): number {
  for (const [phase, days] of Object.entries(PHASE_DAYS)) {
    if (days.includes(day)) return Number(phase);
  }
  return TOTAL_PHASES; // fallback to last phase
}

/**
 * GET /api/program/progress — return user's program progress
 *
 * 14-day program with 5 phases. Content locking is based on the user's
 * true calendar day since enrollment — one new lesson unlocks per calendar day.
 * Sequential progression: the "current" episode is always the first uncompleted
 * one in order, even if later episodes are unlocked.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get user's profile for programStartedAt
  const [profile] = await db
    .select({ programStartedAt: profiles.programStartedAt })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  // Auto-enroll on first access to program
  let programStartedAt = profile?.programStartedAt;
  if (!programStartedAt) {
    programStartedAt = new Date();
    if (profile) {
      await db
        .update(profiles)
        .set({ programStartedAt })
        .where(eq(profiles.userId, userId));
    }
  }

  // Calculate true calendar day and phase
  const calendarDay = getCalendarDay(programStartedAt);
  const currentPhase = getPhaseForDay(calendarDay);

  // Get all program episodes (content with programWeek set)
  const episodes = await db
    .select({
      id: content.id,
      title: content.title,
      description: content.description,
      contentType: content.contentType,
      format: content.format,
      audioUrl: content.audioUrl,
      durationMinutes: content.durationMinutes,
      category: content.category,
      programWeek: content.programWeek,
      programDay: content.programDay,
      programAction: content.programAction,
    })
    .from(content)
    .where(
      and(eq(content.status, "published"), isNotNull(content.programWeek))
    )
    .orderBy(asc(content.programWeek), asc(content.programDay));

  // Get user's completed lessons
  const progress = await db
    .select()
    .from(programProgress)
    .where(
      and(
        eq(programProgress.userId, userId),
        eq(programProgress.completed, true)
      )
    );

  const completedIds = new Set(progress.map((p) => p.lessonId));
  const totalDone = completedIds.size;

  // Determine current lesson using sequential progression:
  // - Episodes unlock based on calendar day (programDay <= calendarDay)
  // - But the "current" episode is always the first uncompleted one in order
  // - We never skip ahead: if user misses Day 2, they still see Day 2 as current
  //   even when Day 3+ are unlocked
  let currentLesson: (typeof episodes)[number] | null = null;
  let nextLesson: (typeof episodes)[number] | null = null;

  // First uncompleted episode in sequential order = the one we suggest
  for (let i = 0; i < episodes.length; i++) {
    const ep = episodes[i];
    if (!completedIds.has(String(ep.id))) {
      currentLesson = ep;
      nextLesson = episodes[i + 1] || null;
      break;
    }
  }

  // If truly all done, use last episode
  if (!currentLesson && episodes.length > 0) {
    currentLesson = episodes[episodes.length - 1];
    nextLesson = null;
  }

  return NextResponse.json({
    // Calendar-based position (used for content locking)
    phase: currentPhase,
    week: currentPhase, // backward compat — maps to phase number
    totalDay: calendarDay,
    // Completion stats
    totalDone,
    totalEpisodes: episodes.length,
    phaseTitle: PHASE_TITLES[currentPhase] || `Phase ${currentPhase}`,
    weekTitle: `Phase ${currentPhase}: ${PHASE_TITLES[currentPhase] || ""}`, // backward compat
    completedIds: Array.from(completedIds),
    programStartedAt: programStartedAt.toISOString(),
    currentLesson: currentLesson
      ? {
          id: currentLesson.id,
          title: currentLesson.title,
          description: currentLesson.description,
          durationMinutes: currentLesson.durationMinutes,
          audioUrl: currentLesson.audioUrl,
          programAction: currentLesson.programAction,
          programWeek: currentLesson.programWeek, // phase number
          programDay: currentLesson.programDay,   // absolute day 1-14
        }
      : null,
    nextLesson: nextLesson
      ? {
          id: nextLesson.id,
          title: nextLesson.title,
          durationMinutes: nextLesson.durationMinutes,
        }
      : null,
    episodes,
  });
}

/**
 * POST /api/program/progress — mark a lesson as completed
 * Body: { lessonId: number, week: number } (week = phase number for backward compat)
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { lessonId, week } = body;

  if (!lessonId || !week) {
    return NextResponse.json(
      { error: "lessonId and week are required" },
      { status: 400 }
    );
  }

  // Ensure programStartedAt is set (in case POST comes before GET)
  const [profile] = await db
    .select({ programStartedAt: profiles.programStartedAt })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (profile && !profile.programStartedAt) {
    await db
      .update(profiles)
      .set({ programStartedAt: new Date() })
      .where(eq(profiles.userId, userId));
  }

  // Check if already completed
  const existing = await db
    .select()
    .from(programProgress)
    .where(
      and(
        eq(programProgress.userId, userId),
        eq(programProgress.lessonId, String(lessonId))
      )
    )
    .limit(1);

  if (existing.length > 0 && existing[0].completed) {
    return NextResponse.json({ message: "Already completed" });
  }

  if (existing.length > 0) {
    // Update existing record
    await db
      .update(programProgress)
      .set({ completed: true, completedAt: new Date() })
      .where(eq(programProgress.id, existing[0].id));
  } else {
    // Insert new record
    await db.insert(programProgress).values({
      userId,
      week,
      lessonId: String(lessonId),
      completed: true,
      completedAt: new Date(),
    });
  }

  return NextResponse.json({ success: true });
}
