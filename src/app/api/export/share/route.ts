import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { reportShares } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

// ── Types ───────────────────────────────────────────────────────────────────

interface ShareReportRequest {
  reportData: Record<string, unknown>;
  recipientEmail?: string;
  recipientName?: string;
  expiresInDays?: number;
}

interface ShareReportResponse {
  success: boolean;
  token: string;
  shareUrl: string;
  expiresAt?: string;
  message: string;
}

// ── Route Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: ShareReportRequest = await request.json();

    if (!body.reportData) {
      return NextResponse.json(
        { error: 'reportData is required' },
        { status: 400 }
      );
    }

    // Generate a unique, cryptographically secure token
    const token = crypto.randomBytes(32).toString('hex');

    // Calculate expiration date (default 30 days)
    const expiresInDays = body.expiresInDays || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Store share record in database
    const shareRecord = await db
      .insert(reportShares)
      .values({
        userId,
        token,
        reportData: body.reportData,
        recipientEmail: body.recipientEmail || null,
        recipientName: body.recipientName || null,
        expiresAt,
      })
      .returning();

    if (!shareRecord || shareRecord.length === 0) {
      return NextResponse.json(
        { error: 'Failed to create share record' },
        { status: 500 }
      );
    }

    // Build the share URL — in production, this should be your iOS app deep link or web URL
    // For now, we'll construct a standard share URL format
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || 'https://app.pause.health';
    const shareUrl = `${baseUrl}/share/${token}`;

    const response: ShareReportResponse = {
      success: true,
      token,
      shareUrl,
      expiresAt: expiresAt.toISOString(),
      message: `Report share link created. It will expire on ${expiresAt.toLocaleDateString()}.`,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[export/share] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create share link' },
      { status: 500 }
    );
  }
}

// ── GET /api/export/share/:token ────────────────────────────────────────────
// Retrieve a shared report without authentication (just the token)
// Note: This is implemented as a separate handler — in practice, you might want
// to use dynamic route segments like /api/export/share/[token]/route.ts

export async function GET(request: NextRequest) {
  try {
    // Extract token from query params
    // e.g., GET /api/export/share?token=xxx
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Share token is required' },
        { status: 400 }
      );
    }

    // Find the share record
    const shareRecords = await db
      .select()
      .from(reportShares)
      .where(eq(reportShares.token, token))
      .limit(1);

    if (shareRecords.length === 0) {
      return NextResponse.json(
        { error: 'Share not found or has expired' },
        { status: 404 }
      );
    }

    const share = shareRecords[0];

    // Check if share has expired
    if (share.expiresAt && new Date() > new Date(share.expiresAt)) {
      return NextResponse.json(
        { error: 'Share link has expired' },
        { status: 403 }
      );
    }

    // Update access count and last accessed time
    await db
      .update(reportShares)
      .set({
        accessCount: (share.accessCount || 0) + 1,
        lastAccessedAt: new Date(),
      })
      .where(eq(reportShares.id, share.id));

    // Return the report data
    return NextResponse.json({
      report: share.reportData,
      sharedBy: {
        email: share.recipientEmail,
        name: share.recipientName,
      },
      accessCount: (share.accessCount || 0) + 1,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
    });
  } catch (error) {
    console.error('[export/share] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve shared report' },
      { status: 500 }
    );
  }
}
