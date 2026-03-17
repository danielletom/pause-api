import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const adminSecret = request.headers.get('x-admin-secret');
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Create waitlist table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT,
        product TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    return NextResponse.json({ ok: true, message: 'Waitlist table created' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
