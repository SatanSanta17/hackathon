import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { loginSchema } from '@/lib/validations/auth';
import { rateLimit, loginLimiter } from '@/lib/rate-limit';
import './types'; // NextAuth module augmentation

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        console.log('[auth] Login attempt');

        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          console.log('[auth] Invalid credentials format');
          return null;
        }

        const { email, password } = parsed.data;

        // Rate limit by email — deliberately returns null (not a named error) to
        // avoid leaking whether an email is registered on the platform.
        try {
          const limit = await rateLimit(email.toLowerCase(), loginLimiter);
          if (!limit.success) {
            console.log('[auth] Login rate limited:', email);
            return null;
          }
        } catch (rateLimitErr) {
          console.error('[auth] Rate limit check failed, failing open:', rateLimitErr);
        }

        const user = await db.query.users.findFirst({
          where: eq(users.email, email.toLowerCase()),
        });

        if (!user || user.deletedAt) {
          console.log('[auth] User not found or soft-deleted');
          return null;
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) {
          console.log('[auth] Invalid password');
          return null;
        }

        console.log('[auth] Login successful:', { userId: user.id });

        // Return user object — this is passed to jwt callback
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          platformRole: user.platformRole,
          isEmailVerified: user.emailVerified,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, user object is populated
      if (user) {
        token.userId = user.id;
        token.email = user.email;
        token.name = user.name;
        token.platformRole = user.platformRole;
        token.isEmailVerified = user.isEmailVerified;
      }

      // Refresh verification status from DB if not yet verified
      // This ensures the banner disappears after email verification
      if (!token.isEmailVerified && token.userId) {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, token.userId as string),
          columns: { emailVerified: true },
        });
        if (dbUser?.emailVerified) {
          token.isEmailVerified = true;
        }
      }

      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.platformRole = token.platformRole as string;
      session.user.isEmailVerified = token.isEmailVerified as boolean;
      return session;
    },
  },
});
