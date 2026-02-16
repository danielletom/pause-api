import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

// POST /api/period/settings/declare-menopause — mark user as post-menopausal
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [updated] = await db
    .update(profiles)
    .set({
      menopauseDeclaredAt: new Date(),
      periodTrackingEnabled: false,
      periodPredictions: false,
      periodReminders: false,
    })
    .where(eq(profiles.userId, userId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    menopauseDeclaredAt: updated.menopauseDeclaredAt,
    enabled: updated.periodTrackingEnabled,
  });
}
