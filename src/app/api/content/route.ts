import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { content } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * GET /api/content — list published content
 * Query params: type (podcast|lesson|meditation|affirmation|article|guide), category
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const category = searchParams.get("category");
  const id = searchParams.get("id");

  // Single item by ID
  if (id) {
    const item = await db
      .select()
      .from(content)
      .where(eq(content.id, parseInt(id)))
      .limit(1);

    if (!item.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(item[0]);
  }

  // Build conditions
  const conditions = [eq(content.status, "published")];
  if (type) conditions.push(eq(content.contentType, type));
  if (category) conditions.push(eq(content.category, category));

  const items = await db
    .select({
      id: content.id,
      title: content.title,
      slug: content.slug,
      contentType: content.contentType,
      format: content.format,
      description: content.description,
      audioUrl: content.audioUrl,
      thumbnailUrl: content.thumbnailUrl,
      durationMinutes: content.durationMinutes,
      category: content.category,
      tags: content.tags,
      sortOrder: content.sortOrder,
    })
    .from(content)
    .where(and(...conditions))
    .orderBy(content.sortOrder);

  return NextResponse.json(items);
}
