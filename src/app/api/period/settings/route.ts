import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/period/settings — return period tracking settings
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  });

  if (!profile) {
    return NextResponse.json({
      enabled: false,
      enabledAt: null,
      homeWidget: true,
      predictions: true,
      reminders: true,
      crossInsights: true,
      promptDismissedAt: null,
      menopauseDeclaredAt: null,
    });
  }

  return NextResponse.json({
    enabled: profile.periodTrackingEnabled ?? false,
    enabledAt: profile.periodEnabledAt,
    homeWidget: profile.periodHomeWidget ?? true,
    predictions: profile.periodPredictions ?? true,
    reminders: profile.periodReminders ?? true,
    crossInsights: profile.periodCrossInsights ?? true,
    promptDismissedAt: profile.periodPromptDismissedAt,
    menopauseDeclaredAt: profile.menopauseDeclaredAt,
  });
}

// PATCH /api/period/settings — update period tracking settings
export async function PATCH(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if (body.enabled !== undefined) {
    updateData.periodTrackingEnabled = body.enabled;
    if (body.enabled) {
      updateData.periodEnabledAt = new Date();
    }
  }
  if (body.homeWidget !== undefined) updateData.periodHomeWidget = body.homeWidget;
  if (body.predictions !== undefined) updateData.periodPredictions = body.predictions;
  if (body.reminders !== undefined) updateData.periodReminders = body.reminders;
  if (body.crossInsights !== undefined) updateData.periodCrossInsights = body.crossInsights;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  const [updated] = await db
    .update(profiles)
    .set(updateData)
    .where(eq(profiles.userId, userId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    enabled: updated.periodTrackingEnabled,
    enabledAt: updated.periodEnabledAt,
    homeWidget: updated.periodHomeWidget,
    predictions: updated.periodPredictions,
    reminders: updated.periodReminders,
    crossInsights: updated.periodCrossInsights,
  });
}
