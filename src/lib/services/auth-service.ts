import bcrypt from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';

import { AUTH_CONSTANTS, TOKEN_TYPE } from '@/lib/auth/constants';
import { ERR } from '@/lib/constants/error-codes';
import { getEmailService } from '@/lib/email';
import { verificationEmail, passwordResetEmail } from '@/lib/email/templates';

import { createToken, validateToken, markTokenUsed, invalidateTokens } from './token-service';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

/**
 * Register a new user account.
 * 1. Check if email already exists
 * 2. Hash password
 * 3. Insert user record
 * 4. Create email verification token
 * 5. Send verification email
 */
export async function signUp(params: {
  name: string;
  email: string;
  password: string;
}): Promise<{ success: boolean; error?: string }> {
  const email = params.email.toLowerCase();
  console.log('[auth-service] signUp:', { email });

  try {
    // 1. Check for existing user
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      console.log('[auth-service] signUp failed: email already exists');
      return { success: false, error: ERR.EMAIL_EXISTS };
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(params.password, AUTH_CONSTANTS.BCRYPT_COST);

    // 3. Insert user
    const [newUser] = await db
      .insert(users)
      .values({
        name: params.name,
        email,
        passwordHash,
      })
      .returning({ id: users.id, name: users.name });

    // 4. Create verification token
    const rawToken = await createToken({
      userId: newUser.id,
      type: TOKEN_TYPE.EMAIL_VERIFICATION,
      expiresInMinutes: AUTH_CONSTANTS.EMAIL_VERIFICATION_EXPIRY_MINUTES,
    });

    // 5. Send verification email
    const verifyUrl = `${APP_URL}/verify-email?token=${rawToken}`;
    const template = verificationEmail({ name: newUser.name, verifyUrl });
    const emailResult = await getEmailService().send({ to: email, ...template });

    if (!emailResult.success) {
      console.error('[auth-service] signUp: verification email failed:', emailResult.error);
      // User is created but email failed — they can resend later
    }

    console.log('[auth-service] signUp successful:', { userId: newUser.id });
    return { success: true };
  } catch (err) {
    console.error('[auth-service] signUp error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Something went wrong',
    };
  }
}

/**
 * Verify a user's email address using a token from the verification email.
 * 1. Validate token
 * 2. Set emailVerified = true
 * 3. Mark token as used
 */
export async function verifyEmail(params: {
  token: string;
}): Promise<{ success: boolean; error?: string }> {
  console.log('[auth-service] verifyEmail');

  try {
    const result = await validateToken({
      rawToken: params.token,
      type: TOKEN_TYPE.EMAIL_VERIFICATION,
    });

    if (!result.valid || !result.userId || !result.tokenId) {
      console.log('[auth-service] verifyEmail: invalid or expired token');
      return { success: false, error: ERR.INVALID_TOKEN };
    }

    // Set emailVerified = true
    await db
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, result.userId));

    // Mark token as used
    await markTokenUsed(result.tokenId);

    console.log('[auth-service] verifyEmail successful:', { userId: result.userId });
    return { success: true };
  } catch (err) {
    console.error('[auth-service] verifyEmail error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Something went wrong',
    };
  }
}

/**
 * Request a password reset email.
 * Always returns success to prevent email enumeration.
 */
export async function requestPasswordReset(params: {
  email: string;
}): Promise<{ success: boolean }> {
  const email = params.email.toLowerCase();
  console.log('[auth-service] requestPasswordReset:', { email });

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user || user.deletedAt) {
      // Don't reveal whether the email exists
      console.log('[auth-service] requestPasswordReset: user not found (returning success)');
      return { success: true };
    }

    // Invalidate old reset tokens
    await invalidateTokens({ userId: user.id, type: TOKEN_TYPE.PASSWORD_RESET });

    // Create new token
    const rawToken = await createToken({
      userId: user.id,
      type: TOKEN_TYPE.PASSWORD_RESET,
      expiresInMinutes: AUTH_CONSTANTS.PASSWORD_RESET_EXPIRY_MINUTES,
    });

    // Send reset email
    const resetUrl = `${APP_URL}/reset-password?token=${rawToken}`;
    const template = passwordResetEmail({ name: user.name, resetUrl });
    const emailResult = await getEmailService().send({ to: email, ...template });

    if (!emailResult.success) {
      console.error('[auth-service] requestPasswordReset: email failed:', emailResult.error);
    }

    console.log('[auth-service] requestPasswordReset successful:', { userId: user.id });
    return { success: true };
  } catch (err) {
    console.error('[auth-service] requestPasswordReset error:', err);
    // Still return success to prevent enumeration
    return { success: true };
  }
}

/**
 * Reset a user's password using a token from the reset email.
 * 1. Validate token
 * 2. Hash new password
 * 3. Update user record
 * 4. Mark token as used
 * 5. Invalidate all other reset tokens
 */
export async function resetPassword(params: {
  token: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  console.log('[auth-service] resetPassword');

  try {
    const result = await validateToken({
      rawToken: params.token,
      type: TOKEN_TYPE.PASSWORD_RESET,
    });

    if (!result.valid || !result.userId || !result.tokenId) {
      console.log('[auth-service] resetPassword: invalid or expired token');
      return { success: false, error: ERR.INVALID_TOKEN };
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(params.newPassword, AUTH_CONSTANTS.BCRYPT_COST);

    // Update user
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, result.userId));

    // Mark token as used
    await markTokenUsed(result.tokenId);

    // Invalidate all other reset tokens for this user
    await invalidateTokens({ userId: result.userId, type: TOKEN_TYPE.PASSWORD_RESET });

    console.log('[auth-service] resetPassword successful:', { userId: result.userId });
    return { success: true };
  } catch (err) {
    console.error('[auth-service] resetPassword error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Something went wrong',
    };
  }
}

/**
 * Resend the email verification email for an authenticated user.
 * 1. Find user by ID
 * 2. Check not already verified
 * 3. Invalidate old tokens
 * 4. Create new token and send email
 */
export async function resendVerificationEmail(params: {
  userId: string;
}): Promise<{ success: boolean; error?: string }> {
  console.log('[auth-service] resendVerificationEmail:', { userId: params.userId });

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, params.userId),
    });

    if (!user) {
      console.log('[auth-service] resendVerificationEmail: user not found');
      return { success: false, error: ERR.USER_NOT_FOUND };
    }

    if (user.emailVerified) {
      console.log('[auth-service] resendVerificationEmail: already verified');
      return { success: false, error: ERR.ALREADY_VERIFIED };
    }

    // Invalidate old verification tokens
    await invalidateTokens({ userId: user.id, type: TOKEN_TYPE.EMAIL_VERIFICATION });

    // Create new token
    const rawToken = await createToken({
      userId: user.id,
      type: TOKEN_TYPE.EMAIL_VERIFICATION,
      expiresInMinutes: AUTH_CONSTANTS.EMAIL_VERIFICATION_EXPIRY_MINUTES,
    });

    // Send email
    const verifyUrl = `${APP_URL}/verify-email?token=${rawToken}`;
    const template = verificationEmail({ name: user.name, verifyUrl });
    const emailResult = await getEmailService().send({ to: user.email, ...template });

    if (!emailResult.success) {
      console.error('[auth-service] resendVerificationEmail: email failed:', emailResult.error);
      return { success: false, error: ERR.EMAIL_FAILED };
    }

    console.log('[auth-service] resendVerificationEmail successful:', { userId: user.id });
    return { success: true };
  } catch (err) {
    console.error('[auth-service] resendVerificationEmail error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Something went wrong',
    };
  }
}

// ---------------------------------------------------------------------------
// Get User by ID
// ---------------------------------------------------------------------------

export async function getUserById(userId: string) {
  console.log('[auth-service] getUserById:', { userId });
  return db.query.users.findFirst({
    where: and(eq(users.id, userId), isNull(users.deletedAt)),
  }) ?? null;
}
