import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { content, contentEngagement } from "@/db/schema";
import { sql, desc, eq } from "drizzle-orm";

const ADMIN_USER_IDS = [process.env.ADMIN_USER_ID].filter(Boolean);

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  // Allow any authenticated user if no admin IDs are configured
  if (ADMIN_USER_IDS.length === 0) return userId;
  if (process.env.NODE_ENV === "development") return userId;
  if (ADMIN_USER_IDS.includes(userId)) return userId;
  return null;
}

// GET /api/admin/stats — content engagement statistics
export async function GET(request: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Total content counts by type
  const typeCounts = await db
    .select({
      contentType: content.contentType,
      count: sql<number>`count(*)::int`,
      published: sql<number>`count(*) filter (where ${content.status} = 'published')::int`,
    })
    .from(content)
    .groupBy(content.contentType);

  // Total engagement counts
  const engagementStats = await db
    .select({
      action: contentEngagement.action,
      count: sql<number>`count(*)::int`,
      uniqueUsers: sql<number>`count(distinct ${contentEngagement.userId})::int`,
    })
    .from(contentEngagement)
    .groupBy(contentEngagement.action);

  // Top content by listens/reads
  const topContent = await db
    .select({
      id: content.id,
      title: content.title,
      contentType: content.contentType,
      listensCount: content.listensCount,
      readsCount: content.readsCount,
    })
    .from(content)
    .orderBy(desc(sql`coalesce(${content.listensCount}, 0) + coalesce(${content.readsCount}, 0)`))
    .limit(10);

  // Program completion overview
  const programStats = await db
    .select({
      week: content.programWeek,
      total: sql<number>`count(*)::int`,
      published: sql<number>`count(*) filter (where ${content.status} = 'published')::int`,
      withAudio: sql<number>`count(*) filter (where ${content.audioUrl} is not null)::int`,
    })
    .from(content)
    .where(sql`${content.programWeek} is not null`)
    .groupBy(content.programWeek)
    .orderBy(content.programWeek);

  return NextResponse.json({
    typeCounts,
    engagementStats,
    topContent,
    programStats,
    totals: {
      totalContent: typeCounts.reduce((sum, t) => sum + t.count, 0),
      totalPublished: typeCounts.reduce((sum, t) => sum + t.published, 0),
    },
  });
}
