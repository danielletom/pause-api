import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { content, programProgress, profiles } from "@/db/schema";
import { eq, and, isNotNull, asc } from "drizzle-orm";

// Week titles for The Pause Pod 8-week program
const WEEK_TITLES: Record<number, string> = {
  1: "Understanding Menopause",
  2: "Sleep & Night Sweats",
  3: "Hot Flashes & Temperature",
  4: "Mood & Emotional Health",
  5: "Nutrition & Weight",
  6: "Brain Fog & Memory",
  7: "Bones, Joints & Heart",
  8: "Thriving in Menopause",
};

const DAYS_PER_WEEK = 5;
const TOTAL_WEEKS = 8;
const MAX_DAYS = DAYS_PER_WEEK * TOTAL_WEEKS; // 40

/**
 * Calculate the user's true calendar day in the program.
 * Day 1 = the day they started, increments by 1 each calendar day.
 * Capped at MAX_DAYS (40).
 */
function getCalendarDay(programStartedAt: Date): number {
  const now = new Date();
  const start = new Date(programStartedAt);
  // Use UTC dates to avoid timezone drift
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceStart = Math.floor((today - startDay) / 86400000);
  return Math.min(Math.max(daysSinceStart + 1, 1), MAX_DAYS);
}

/**
 * GET /api/program/progress — return user's program progress
 *
 * Content locking is based on the user's true calendar day since enrollment,
 * not just which episodes they've completed. This prevents binge-completing
 * all lessons in one sitting — one new lesson unlocks per calendar day.
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

  // Calculate true calendar day and week
  const calendarDay = getCalendarDay(programStartedAt);
  const calendarWeek = Math.min(
    Math.ceil(calendarDay / DAYS_PER_WEEK),
    TOTAL_WEEKS
  );
  const dayInWeek = ((calendarDay - 1) % DAYS_PER_WEEK) + 1;

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

  // Determine current lesson: first episode not completed that is also unlocked
  // An episode is unlocked if its calendar position <= calendarDay
  let currentLesson: (typeof episodes)[number] | null = null;
  let nextLesson: (typeof episodes)[number] | null = null;

  for (let i = 0; i < episodes.length; i++) {
    const ep = episodes[i];
    const epTotalDay = ((ep.programWeek || 1) - 1) * DAYS_PER_WEEK + (ep.programDay || 1);

    if (!completedIds.has(String(ep.id)) && epTotalDay <= calendarDay) {
      currentLesson = ep;
      // Next lesson is the one after, if also unlocked or the next to unlock
      nextLesson = episodes[i + 1] || null;
      break;
    }
  }

  // If all unlocked episodes are done, point to the next one coming up
  if (!currentLesson) {
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
  }

  return NextResponse.json({
    // Calendar-based position (used for content locking)
    week: calendarWeek,
    day: dayInWeek,
    totalDay: calendarDay,
    // Completion stats
    totalDone,
    totalEpisodes: episodes.length,
    weekTitle: WEEK_TITLES[calendarWeek] || `Week ${calendarWeek}`,
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
          programWeek: currentLesson.programWeek,
          programDay: currentLesson.programDay,
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
 * Body: { lessonId: number, week: number }
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
