import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { contentEngagement, content } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/content/[id]/engage — track user engagement with content
 *
 * Body:
 * {
 *   action: 'listen' | 'read' | 'complete' | 'bookmark',
 *   progressPercent?: number (0-100),
 *   durationSeconds?: number,
 *   rating?: number (1-5)
 * }
 *
 * Upserts an engagement record (one per user/content/action combo)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const contentId = parseInt(id);
  if (isNaN(contentId)) {
    return NextResponse.json({ error: 'Invalid content ID' }, { status: 400 });
  }

  const body = await request.json();
  const {
    action,
    progressPercent = 0,
    durationSeconds = null,
    rating = null,
  } = body;

  // Validate action
  if (!action || !['listen', 'read', 'complete', 'bookmark'].includes(action)) {
    return NextResponse.json(
      { error: 'Invalid action. Must be: listen, read, complete, or bookmark' },
      { status: 400 }
    );
  }

  // Verify content exists
  const contentItem = await db.query.content.findFirst({
    where: eq(content.id, contentId),
  });

  if (!contentItem) {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 });
  }

  // Check if engagement record exists
  const existing = await db.query.contentEngagement.findFirst({
    where: and(
      eq(contentEngagement.userId, userId),
      eq(contentEngagement.contentId, contentId),
      eq(contentEngagement.action, action)
    ),
  });

  let engagement;
  if (existing) {
    // Update existing engagement
    engagement = await db
      .update(contentEngagement)
      .set({
        progressPercent,
        durationSeconds,
        rating,
      })
      .where(eq(contentEngagement.id, existing.id))
      .returning();
  } else {
    // Insert new engagement
    engagement = await db
      .insert(contentEngagement)
      .values({
        userId,
        contentId,
        action,
        progressPercent,
        durationSeconds,
        rating,
      })
      .returning();
  }

  return NextResponse.json(engagement[0], { status: existing ? 200 : 201 });
}
