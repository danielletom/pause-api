/**
 * Database helpers for the pipeline.
 * Direct DB access (matching seed-content.ts pattern).
 */

import { db } from "../../../src/db";
import { content, contentPipeline } from "../../../src/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type {
  ContentItem,
  ContentType,
  PipelineStage,
  PipelineStatus,
  PipelineRecord,
} from "../types";

/**
 * Get a single content item by ID.
 */
export async function getContentItem(id: number): Promise<ContentItem | null> {
  const rows = await db.select().from(content).where(eq(content.id, id)).limit(1);
  return (rows[0] as ContentItem) || null;
}

/**
 * Get all content items, optionally filtered.
 */
export async function getContentItems(filters?: {
  type?: ContentType;
  week?: number;
  status?: string;
}): Promise<ContentItem[]> {
  let query = db.select().from(content);

  if (filters?.type) {
    query = query.where(eq(content.contentType, filters.type)) as typeof query;
  }
  if (filters?.week) {
    query = query.where(eq(content.programWeek, filters.week)) as typeof query;
  }
  if (filters?.status) {
    query = query.where(eq(content.status, filters.status)) as typeof query;
  }

  return (await query) as ContentItem[];
}

/**
 * Update a content item.
 */
export async function updateContent(
  id: number,
  data: Partial<{
    bodyMarkdown: string;
    audioUrl: string;
    aiDescription: string;
    status: string;
  }>
): Promise<void> {
  await db
    .update(content)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(content.id, id));
}

/**
 * Get pipeline status for a content item.
 */
export async function getPipelineStatus(contentId: number): Promise<PipelineRecord[]> {
  return (await db
    .select()
    .from(contentPipeline)
    .where(eq(contentPipeline.contentId, contentId))) as PipelineRecord[];
}

/**
 * Get pipeline status for a specific stage.
 */
export async function getStageStatus(
  contentId: number,
  stage: PipelineStage
): Promise<PipelineRecord | null> {
  const rows = await db
    .select()
    .from(contentPipeline)
    .where(
      and(
        eq(contentPipeline.contentId, contentId),
        eq(contentPipeline.stage, stage)
      )
    )
    .limit(1);
  return (rows[0] as PipelineRecord) || null;
}

/**
 * Create or update a pipeline stage record.
 */
export async function upsertPipelineStage(
  contentId: number,
  stage: PipelineStage,
  data: {
    status: PipelineStatus;
    tool?: string;
    outputPath?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const existing = await getStageStatus(contentId, stage);

  if (existing) {
    await db
      .update(contentPipeline)
      .set({
        ...data,
        startedAt: data.status === "in_progress" ? new Date() : existing.startedAt,
        completedAt: data.status === "completed" ? new Date() : null,
      })
      .where(eq(contentPipeline.id, existing.id));
  } else {
    await db.insert(contentPipeline).values({
      contentId,
      stage,
      status: data.status,
      tool: data.tool || null,
      outputPath: data.outputPath || null,
      errorMessage: data.errorMessage || null,
      metadata: data.metadata || null,
      startedAt: data.status === "in_progress" ? new Date() : null,
    });
  }
}

/**
 * Get summary stats for all content pipeline.
 */
export async function getPipelineSummary(): Promise<
  { stage: string; status: string; count: number }[]
> {
  const rows = await db
    .select({
      stage: contentPipeline.stage,
      status: contentPipeline.status,
      count: sql<number>`count(*)::int`,
    })
    .from(contentPipeline)
    .groupBy(contentPipeline.stage, contentPipeline.status);
  return rows;
}
