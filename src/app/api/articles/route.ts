import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { articles } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  const results = category
    ? await db.query.articles.findMany({
        where: eq(articles.category, category),
        orderBy: [desc(articles.createdAt)],
      })
    : await db.query.articles.findMany({
        orderBy: [desc(articles.createdAt)],
      });

  return NextResponse.json(results);
}
