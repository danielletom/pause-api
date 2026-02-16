import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { content } from "@/db/schema";
import { eq } from "drizzle-orm";

const ADMIN_USER_IDS = [process.env.ADMIN_USER_ID].filter(Boolean);

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  if (process.env.NODE_ENV === "development") return userId;
  if (ADMIN_USER_IDS.includes(userId)) return userId;
  return null;
}

// GET /api/admin/content/[id] — get single content item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await requireAdmin();
  if (!adminId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [item] = await db
    .select()
    .from(content)
    .where(eq(content.id, parseInt(id)));

  if (!item)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(item);
}

// PUT /api/admin/content/[id] — update content
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await requireAdmin();
  if (!adminId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const updateData: Record<string, any> = { updatedAt: new Date() };

  // Only update fields that are provided
  if (body.title !== undefined) {
    updateData.title = body.title;
    updateData.slug = body.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
  if (body.contentType !== undefined) updateData.contentType = body.contentType;
  if (body.format !== undefined) updateData.format = body.format;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.aiDescription !== undefined) updateData.aiDescription = body.aiDescription;
  if (body.bodyMarkdown !== undefined) updateData.bodyMarkdown = body.bodyMarkdown;
  if (body.audioUrl !== undefined) updateData.audioUrl = body.audioUrl;
  if (body.thumbnailUrl !== undefined) updateData.thumbnailUrl = body.thumbnailUrl;
  if (body.durationMinutes !== undefined)
    updateData.durationMinutes = body.durationMinutes ? parseInt(body.durationMinutes) : null;
  if (body.category !== undefined) updateData.category = body.category;
  if (body.tags !== undefined) updateData.tags = body.tags;
  if (body.productionTool !== undefined) updateData.productionTool = body.productionTool;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.sortOrder !== undefined) updateData.sortOrder = parseInt(body.sortOrder);
  if (body.programWeek !== undefined)
    updateData.programWeek = body.programWeek ? parseInt(body.programWeek) : null;
  if (body.programDay !== undefined)
    updateData.programDay = body.programDay ? parseInt(body.programDay) : null;
  if (body.programAction !== undefined) updateData.programAction = body.programAction;

  const [updated] = await db
    .update(content)
    .set(updateData)
    .where(eq(content.id, parseInt(id)))
    .returning();

  if (!updated)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(updated);
}

// DELETE /api/admin/content/[id] — delete content
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await requireAdmin();
  if (!adminId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [deleted] = await db
    .delete(content)
    .where(eq(content.id, parseInt(id)))
    .returning();

  if (!deleted)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
