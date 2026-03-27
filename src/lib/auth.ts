import { SignJWT, jwtVerify } from 'jose';
import { headers } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.CRON_SECRET || 'pause-dev-secret-change-me'
);

// Drop-in replacement for Clerk's auth()
// Returns { userId } by verifying the JWT from the Authorization header
export async function auth(): Promise<{ userId: string | null }> {
  try {
    const headersList = await headers();
    const authorization = headersList.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return { userId: null };
    }

    const token = authorization.slice(7);
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { userId: (payload.sub as string) || null };
  } catch {
    return { userId: null };
  }
}

// Generate a JWT for a user
export async function signToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('90d')
    .sign(JWT_SECRET);
}

// Verify an Apple identity token (validates with Apple's public keys)
export async function verifyAppleToken(identityToken: string): Promise<{
  sub: string;
  email?: string;
}> {
  // Fetch Apple's public keys
  const response = await fetch('https://appleid.apple.com/auth/keys');
  const { keys } = await response.json();

  // Try each key to verify
  for (const key of keys) {
    try {
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        key,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );

      const { payload } = await jwtVerify(identityToken, publicKey, {
        issuer: 'https://appleid.apple.com',
      });

      return {
        sub: payload.sub as string,
        email: payload.email as string | undefined,
      };
    } catch {
      continue;
    }
  }

  throw new Error('Invalid Apple identity token');
}
