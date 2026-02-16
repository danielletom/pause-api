import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { content, contentPipeline } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

// Admin user IDs — restrict to app owner
const ADMIN_USER_IDS = [process.env.ADMIN_USER_ID].filter(Boolean);

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  if (ADMIN_USER_IDS.length === 0) return userId;
  if (process.env.NODE_ENV === "development") return userId;
  if (ADMIN_USER_IDS.includes(userId)) return userId;
  return null;
}

// GET /api/admin/pipeline — pipeline dashboard data
export async function GET(request: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "overview";
  const contentId = searchParams.get("contentId");

  // Single item detail
  if (contentId) {
    const id = parseInt(contentId);
    const [item] = await db.select().from(content).where(eq(content.id, id)).limit(1);
    const stages = await db
      .select()
      .from(contentPipeline)
      .where(eq(contentPipeline.contentId, id));
    return NextResponse.json({ item, stages });
  }

  // Overview — aggregate stats
  if (view === "overview") {
    // Content counts by type and status
    const contentCounts = await db
      .select({
        contentType: content.contentType,
        status: content.status,
        count: sql<number>`count(*)::int`,
      })
      .from(content)
      .groupBy(content.contentType, content.status);

    // Pipeline stage progress
    const pipelineCounts = await db
      .select({
        stage: contentPipeline.stage,
        status: contentPipeline.status,
        count: sql<number>`count(*)::int`,
      })
      .from(contentPipeline)
      .groupBy(contentPipeline.stage, contentPipeline.status);

    // Recent pipeline activity
    const recentActivity = await db
      .select({
        id: contentPipeline.id,
        contentId: contentPipeline.contentId,
        stage: contentPipeline.stage,
        status: contentPipeline.status,
        tool: contentPipeline.tool,
        errorMessage: contentPipeline.errorMessage,
        completedAt: contentPipeline.completedAt,
        createdAt: contentPipeline.createdAt,
      })
      .from(contentPipeline)
      .orderBy(desc(contentPipeline.createdAt))
      .limit(20);

    // Total content
    const [totals] = await db
      .select({
        total: sql<number>`count(*)::int`,
        draft: sql<number>`count(*) filter (where ${content.status} = 'draft')::int`,
        ready: sql<number>`count(*) filter (where ${content.status} = 'ready')::int`,
        published: sql<number>`count(*) filter (where ${content.status} = 'published')::int`,
        withAudio: sql<number>`count(*) filter (where ${content.audioUrl} is not null)::int`,
        withBody: sql<number>`count(*) filter (where ${content.bodyMarkdown} is not null)::int`,
      })
      .from(content);

    return NextResponse.json({
      totals,
      contentCounts,
      pipelineCounts,
      recentActivity,
    });
  }

  // Items view — list all content with pipeline status
  if (view === "items") {
    const typeFilter = searchParams.get("type");
    const statusFilter = searchParams.get("status");
    const weekFilter = searchParams.get("week");

    const conditions = [];
    if (typeFilter) conditions.push(eq(content.contentType, typeFilter));
    if (statusFilter) conditions.push(eq(content.status, statusFilter));
    if (weekFilter) conditions.push(eq(content.programWeek, parseInt(weekFilter)));

    const items = await db
      .select()
      .from(content)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(content.programWeek, content.programDay, content.id);

    // Get pipeline status for all items in one query
    const allPipeline = await db.select().from(contentPipeline);

    // Group pipeline records by contentId
    const pipelineByContent = new Map<number, typeof allPipeline>();
    for (const record of allPipeline) {
      const existing = pipelineByContent.get(record.contentId) || [];
      existing.push(record);
      pipelineByContent.set(record.contentId, existing);
    }

    const itemsWithPipeline = items.map((item) => ({
      ...item,
      pipeline: pipelineByContent.get(item.id) || [],
    }));

    return NextResponse.json(itemsWithPipeline);
  }

  return NextResponse.json({ error: "Invalid view" }, { status: 400 });
}

// POST /api/admin/pipeline — trigger a pipeline stage
export async function POST(request: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { action, contentId, contentIds, stage } = body;

  // We can't directly call the pipeline scripts from the API route
  // (they run as CLI tools with different env). Instead, we create
  // "pending" pipeline records that the CLI can pick up, or we
  // return instructions for the user to run via CLI/MCP.

  if (action === "queue") {
    // Queue a single item for a stage
    const stages = stage
      ? [stage]
      : ["research", "writing", "audio", "production", "publishing"];

    for (const s of stages) {
      await db.insert(contentPipeline).values({
        contentId,
        stage: s,
        status: "pending",
        tool: null,
        createdAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      message: `Queued ${stages.length} stage(s) for content #${contentId}`,
      cli: `npx tsx --env-file=.env.local scripts/pipeline/index.ts run --id ${contentId}`,
    });
  }

  if (action === "queue-batch") {
    // Queue multiple items
    const ids = contentIds || [];
    const stages = stage
      ? [stage]
      : ["research", "writing", "audio", "production", "publishing"];

    for (const id of ids) {
      for (const s of stages) {
        await db.insert(contentPipeline).values({
          contentId: id,
          stage: s,
          status: "pending",
          tool: null,
          createdAt: new Date(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Queued ${stages.length} stage(s) for ${ids.length} items`,
    });
  }

  if (action === "reset") {
    // Reset pipeline for an item (delete all pipeline records)
    await db
      .delete(contentPipeline)
      .where(eq(contentPipeline.contentId, contentId));

    return NextResponse.json({
      success: true,
      message: `Reset pipeline for content #${contentId}`,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
