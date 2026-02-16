import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { cycles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/period/cycles — list all cycles
export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allCycles = await db
    .select()
    .from(cycles)
    .where(eq(cycles.userId, userId))
    .orderBy(desc(cycles.startDate));

  return NextResponse.json(allCycles);
}
