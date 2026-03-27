import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { medications } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const medId = parseInt(params.id);
  if (isNaN(medId)) {
    return NextResponse.json({ error: 'Invalid medication ID' }, { status: 400 });
  }

  // Soft delete: set active to false
  const deletedMed = await db
    .update(medications)
    .set({ active: false })
    .where(and(eq(medications.id, medId), eq(medications.userId, userId)))
    .returning();

  if (deletedMed.length === 0) {
    return NextResponse.json({ error: 'Medication not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, medication: deletedMed[0] });
}
