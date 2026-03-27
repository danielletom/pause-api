import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.CRON_SECRET || 'pause-dev-secret-change-me'
);

const PUBLIC_PATHS = [
  '/api/health',
  '/api/cron/',
  '/api/webhooks/',
  '/api/content',
  '/api/admin/',
  '/api/auth/',
  '/audio/',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes pass through
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Check for Bearer token
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authorization.slice(7);

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp3|mp4|wav|ogg)).*)',
    '/(api|trpc)(.*)',
  ],
};
