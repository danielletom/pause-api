import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { content } from "@/db/schema";
import { desc, eq, ilike, and, sql } from "drizzle-orm";

// Admin user IDs — restrict to app owner
const ADMIN_USER_IDS = [
  process.env.ADMIN_USER_ID, // Set in env
].filter(Boolean);

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  // Allow any authenticated user if no admin IDs are configured
  if (ADMIN_USER_IDS.length === 0) return userId;
  // In development, allow any authenticated user
  if (process.env.NODE_ENV === "development") return userId;
  if (ADMIN_USER_IDS.includes(userId)) return userId;
  return null;
}

// GET /api/admin/content — list all content with optional filters
export async function GET(request: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const contentType = searchParams.get("type");
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const programWeek = searchParams.get("week");

  const conditions = [];
  if (contentType) conditions.push(eq(content.contentType, contentType));
  if (status) conditions.push(eq(content.status, status));
  if (category) conditions.push(eq(content.category, category));
  if (programWeek) conditions.push(eq(content.programWeek, parseInt(programWeek)));
  if (search) conditions.push(ilike(content.title, `%${search}%`));

  const results = conditions.length > 0
    ? await db.select().from(content).where(and(...conditions)).orderBy(
        content.programWeek,
        content.programDay,
        desc(content.createdAt)
      )
    : await db.select().from(content).orderBy(
        content.programWeek,
        content.programDay,
        desc(content.createdAt)
      );

  return NextResponse.json(results);
}

// POST /api/admin/content — create new content
export async function POST(request: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Generate slug from title
  const slug = body.title
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const [newContent] = await db
    .insert(content)
    .values({
      title: body.title,
      slug,
      contentType: body.contentType || "article",
      format: body.format || "text",
      description: body.description,
      aiDescription: body.aiDescription,
      bodyMarkdown: body.bodyMarkdown,
      audioUrl: body.audioUrl,
      thumbnailUrl: body.thumbnailUrl,
      durationMinutes: body.durationMinutes ? parseInt(body.durationMinutes) : null,
      category: body.category,
      tags: body.tags || [],
      productionTool: body.productionTool,
      status: body.status || "draft",
      sortOrder: body.sortOrder ? parseInt(body.sortOrder) : 0,
      programId: body.programId || null,
      programWeek: body.programWeek ? parseInt(body.programWeek) : null,
      programDay: body.programDay ? parseInt(body.programDay) : null,
      programAction: body.programAction,
    })
    .returning();

  return NextResponse.json(newContent, { status: 201 });
}
