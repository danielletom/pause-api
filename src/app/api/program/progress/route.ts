import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { content, programProgress } from "@/db/schema";
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

/**
 * GET /api/program/progress — return user's program progress
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // Determine current position: first episode not completed
  // Episodes are ordered by week then day
  let currentWeek = 1;
  let currentDay = 1;
  let currentLesson = episodes[0] || null;
  let nextLesson = episodes[1] || null;

  for (let i = 0; i < episodes.length; i++) {
    const ep = episodes[i];
    if (!completedIds.has(String(ep.id))) {
      currentWeek = ep.programWeek!;
      currentDay = ep.programDay!;
      currentLesson = ep;
      nextLesson = episodes[i + 1] || null;
      break;
    }
    // If all are completed, stay on last episode
    if (i === episodes.length - 1) {
      currentWeek = ep.programWeek!;
      currentDay = ep.programDay!;
      currentLesson = ep;
      nextLesson = null;
    }
  }

  // Calculate total day across all weeks (1-based, 5 days per week)
  const totalDay = (currentWeek - 1) * 5 + currentDay;

  return NextResponse.json({
    week: currentWeek,
    day: currentDay,
    totalDay,
    totalDone,
    totalEpisodes: episodes.length,
    weekTitle: WEEK_TITLES[currentWeek] || `Week ${currentWeek}`,
    completedIds: Array.from(completedIds),
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
