import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

// POST /api/period/settings/dismiss-prompt — dismiss the period tracking prompt
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [updated] = await db
    .update(profiles)
    .set({ periodPromptDismissedAt: new Date() })
    .where(eq(profiles.userId, userId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ promptDismissedAt: updated.periodPromptDismissedAt });
}
