import crypto from 'crypto';
import { eq, and, isNull, gt } from 'drizzle-orm';

import { db } from '@/db';
import { verificationTokens } from '@/db/schema';

/**
 * Generate a secure random token, store its SHA-256 hash in DB.
 * Returns the raw token (to be sent via email URL).
 */
export async function createToken(params: {
  userId: string;
  type: 'email_verification' | 'password_reset';
  expiresInMinutes: number;
}): Promise<string> {
  console.log('[token-service] Creating token:', { userId: params.userId, type: params.type });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = hashToken(rawToken);

  const expiresAt = new Date(Date.now() + params.expiresInMinutes * 60 * 1000);

  await db.insert(verificationTokens).values({
    userId: params.userId,
    token: hashedToken,
    type: params.type,
    expiresAt,
  });

  console.log('[token-service] Token created successfully:', { userId: params.userId, type: params.type });
  return rawToken;
}

/**
 * Validate a raw token against stored hashes in DB.
 * Checks: hash match, correct type, not expired, not already used.
 */
export async function validateToken(params: {
  rawToken: string;
  type: 'email_verification' | 'password_reset';
}): Promise<{ valid: boolean; userId?: string; tokenId?: string }> {
  console.log('[token-service] Validating token:', { type: params.type });

  const hashedToken = hashToken(params.rawToken);

  const tokenRecord = await db.query.verificationTokens.findFirst({
    where: and(
      eq(verificationTokens.token, hashedToken),
      eq(verificationTokens.type, params.type),
      isNull(verificationTokens.usedAt),
      gt(verificationTokens.expiresAt, new Date()),
    ),
  });

  if (!tokenRecord) {
    console.log('[token-service] Token invalid or expired');
    return { valid: false };
  }

  console.log('[token-service] Token valid:', { userId: tokenRecord.userId, tokenId: tokenRecord.id });
  return {
    valid: true,
    userId: tokenRecord.userId,
    tokenId: tokenRecord.id,
  };
}

/**
 * Mark a token as used (sets usedAt timestamp).
 */
export async function markTokenUsed(tokenId: string): Promise<void> {
  console.log('[token-service] Marking token as used:', { tokenId });

  await db
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(verificationTokens.id, tokenId));
}

/**
 * Invalidate all unused tokens for a user+type by marking them as used.
 * Called before creating a new token to prevent stale tokens from being valid.
 */
export async function invalidateTokens(params: {
  userId: string;
  type: 'email_verification' | 'password_reset';
}): Promise<void> {
  console.log('[token-service] Invalidating tokens:', { userId: params.userId, type: params.type });

  await db
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(verificationTokens.userId, params.userId),
        eq(verificationTokens.type, params.type),
        isNull(verificationTokens.usedAt),
      ),
    );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * SHA-256 hash a raw token string.
 * Used for storage and comparison — not bcrypt, because tokens are
 * high-entropy random strings where dictionary attacks don't apply.
 */
function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
