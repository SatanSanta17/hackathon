# TRD — Phase 3.5: Core Hardening

**Document ID:** TRD-009  
**Date:** April 18, 2026  
**Author:** Burhanuddin C.  
**Status:** Parts 1–7 Written — Parts 1–2 Audited & Complete + Convention Audit Complete  
**PRD Reference:** `docs/009-core-hardening/prd.md`  
**Architecture Reference:** `docs/004-architecture.md`  
**Conventions Reference:** `docs/003-coding-conventions.md`

---

## Codebase Discoveries (Pre-TRD Audit)

Before writing implementation specs, the existing auth and session code was audited against the PRD assumptions. Two PRD assumptions were already satisfied by prior implementation:

| PRD Assumption | Reality | Action |
|---|---|---|
| JWT contains `orgId` and `orgRole` (to be removed) | JWT already carries only `userId`, `email`, `name`, `platformRole`, `isEmailVerified` — confirmed in `src/lib/auth/types.ts` and `src/lib/auth/auth.ts` | No JWT cleanup needed |
| `requireOrgRole()` reads from JWT (to be refactored) | `requireOrgRole()` already calls `checkUserOrgRole()` from `org-service.ts` — a live DB lookup — confirmed in `src/lib/auth/require-org-role.ts` | No guard refactor needed |

Part 2 scope is therefore reduced to its one remaining gap: the email verification banner bug.

---

## Part 1: Rate Limiting on Auth Endpoints

**PRD Requirements Covered:** P1.R1 through P1.R9

---

### 1.1 Dependencies

**New packages:**

```
@upstash/ratelimit   # Sliding window rate limiting
@upstash/redis       # HTTP-based Redis client (no TCP server needed)
```

Install:
```bash
npm install @upstash/ratelimit @upstash/redis
```

**Why Upstash:** HTTP-based Redis client — no persistent connection, compatible with Vercel serverless. Free tier: 10K requests/day, sufficient for V1. No infrastructure to manage.

---

### 1.2 New File: `src/lib/rate-limit.ts`

This file owns all rate limiter instances and the shared helper. Instances are created at module scope so they are reused within a single serverless invocation (not recreated per request).

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const signupLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: 'rl:signup',
});

export const forgotPasswordLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '15 m'),
  prefix: 'rl:forgot',
});

export const resendVerificationLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '15 m'),
  prefix: 'rl:resend',
});

export const resetPasswordLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: 'rl:reset',
});

export const loginLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '15 m'),
  prefix: 'rl:login',
});

export async function rateLimit(
  identifier: string,
  limiter: Ratelimit,
): Promise<{ success: boolean; retryAfter?: number }> {
  const { success, reset } = await limiter.limit(identifier);
  if (!success) {
    return { success: false, retryAfter: Math.ceil((reset - Date.now()) / 1000) };
  }
  return { success: true };
}
```

**Design decisions:**
- `prefix` per limiter prevents key collisions in Redis when different limiters share identifiers (e.g., same email used for both login and forgot-password).
- `retryAfter` is derived from Upstash's `reset` timestamp (milliseconds to next window). Callers use it to set the `Retry-After` response header in seconds.
- The helper is intentionally thin — no HTTP logic. Each route handler owns the `429` response.

---

### 1.3 IP Extraction Helper

IP extraction is repeated across four route handlers. Add a co-located helper at the bottom of `rate-limit.ts`:

```typescript
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return '127.0.0.1';
}
```

**Design decision:** Take only the first IP from `x-forwarded-for`. Vercel sets this header to the actual client IP first, with any proxy IPs appended. The `127.0.0.1` fallback covers local development where no header is present.

---

### 1.4 Modified: `src/app/api/auth/signup/route.ts`

Rate limit check is the first operation — before body parsing or Zod validation. A request that exceeds the rate limit pays zero service cost.

```typescript
import { NextResponse } from 'next/server';

import { ERR } from '@/lib/constants/error-codes';
import { signUpSchema } from '@/lib/validations/auth';
import { signUp } from '@/lib/services/auth-service';
import { rateLimit, getClientIp, signupLimiter } from '@/lib/rate-limit';

export async function POST(request: Request) {
  console.log('[api/auth/signup] POST');

  const ip = getClientIp(request);
  const limit = await rateLimit(ip, signupLimiter);
  if (!limit.success) {
    console.log('[api/auth/signup] Rate limited:', ip);
    return NextResponse.json(
      { message: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfter ?? 60) },
      },
    );
  }

  try {
    const body = await request.json();

    const parsed = signUpSchema.safeParse(body);
    if (!parsed.success) {
      console.log('[api/auth/signup] Validation failed:', parsed.error.flatten());
      return NextResponse.json(
        { message: 'Invalid input', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await signUp(parsed.data);

    if (!result.success) {
      if (result.error === ERR.EMAIL_EXISTS) {
        return NextResponse.json(
          { message: 'An account with this email already exists.' },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { message: result.error ?? 'Something went wrong.' },
        { status: 500 },
      );
    }

    console.log('[api/auth/signup] Success');
    return NextResponse.json(
      { message: 'Account created. Check your email to verify.' },
      { status: 201 },
    );
  } catch (err) {
    console.error('[api/auth/signup] Unexpected error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
```

---

### 1.5 Modified: `src/app/api/auth/forgot-password/route.ts`

```typescript
import { NextResponse } from 'next/server';

import { forgotPasswordSchema } from '@/lib/validations/auth';
import { requestPasswordReset } from '@/lib/services/auth-service';
import { rateLimit, getClientIp, forgotPasswordLimiter } from '@/lib/rate-limit';

export async function POST(request: Request) {
  console.log('[api/auth/forgot-password] POST');

  const ip = getClientIp(request);
  const limit = await rateLimit(ip, forgotPasswordLimiter);
  if (!limit.success) {
    console.log('[api/auth/forgot-password] Rate limited:', ip);
    return NextResponse.json(
      { message: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfter ?? 60) },
      },
    );
  }

  try {
    const body = await request.json();

    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      console.log('[api/auth/forgot-password] Validation failed:', parsed.error.flatten());
      return NextResponse.json(
        { message: 'Invalid input', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    await requestPasswordReset({ email: parsed.data.email });

    console.log('[api/auth/forgot-password] Success');
    return NextResponse.json(
      { message: 'If an account exists, a reset link has been sent.' },
      { status: 200 },
    );
  } catch (err) {
    console.error('[api/auth/forgot-password] Unexpected error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
```

---

### 1.6 Modified: `src/app/api/auth/resend-verification/route.ts`

```typescript
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/auth';
import { ERR } from '@/lib/constants/error-codes';
import { resendVerificationEmail } from '@/lib/services/auth-service';
import { rateLimit, getClientIp, resendVerificationLimiter } from '@/lib/rate-limit';

export async function POST(request: Request) {
  console.log('[api/auth/resend-verification] POST');

  const ip = getClientIp(request);
  const limit = await rateLimit(ip, resendVerificationLimiter);
  if (!limit.success) {
    console.log('[api/auth/resend-verification] Rate limited:', ip);
    return NextResponse.json(
      { message: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfter ?? 60) },
      },
    );
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: 'Authentication required.' },
        { status: 401 },
      );
    }

    const result = await resendVerificationEmail({ userId: session.user.id });

    if (!result.success) {
      if (result.error === ERR.ALREADY_VERIFIED) {
        return NextResponse.json(
          { message: 'Email is already verified.' },
          { status: 400 },
        );
      }
      if (result.error === ERR.EMAIL_FAILED) {
        return NextResponse.json(
          { message: 'Failed to send verification email. Please try again.' },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { message: result.error ?? 'Something went wrong.' },
        { status: 500 },
      );
    }

    console.log('[api/auth/resend-verification] Success');
    return NextResponse.json(
      { message: 'Verification email sent.' },
      { status: 200 },
    );
  } catch (err) {
    console.error('[api/auth/resend-verification] Unexpected error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
```

---

### 1.7 Modified: `src/app/api/auth/reset-password/route.ts`

Rate limit is by **email** (parsed from the request body), not IP. A compromised IP could rotate addresses; the email is the actual target.

The body must be parsed before rate limiting in this case. If Zod validation fails (no email present), fall through to the normal 400 response — rate limiting only applies to structurally valid requests.

```typescript
import { NextResponse } from 'next/server';

import { ERR } from '@/lib/constants/error-codes';
import { resetPasswordSchema } from '@/lib/validations/auth';
import { resetPassword } from '@/lib/services/auth-service';
import { rateLimit, resetPasswordLimiter } from '@/lib/rate-limit';

export async function POST(request: Request) {
  console.log('[api/auth/reset-password] POST');

  try {
    const body = await request.json();

    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      console.log('[api/auth/reset-password] Validation failed:', parsed.error.flatten());
      return NextResponse.json(
        { message: 'Invalid input', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Rate limit by email — target-based, not IP-based
    const limit = await rateLimit(parsed.data.email.toLowerCase(), resetPasswordLimiter);
    if (!limit.success) {
      console.log('[api/auth/reset-password] Rate limited:', parsed.data.email);
      return NextResponse.json(
        { message: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfter ?? 60) },
        },
      );
    }

    const result = await resetPassword({
      token: parsed.data.token,
      newPassword: parsed.data.password,
    });

    if (!result.success) {
      if (result.error === ERR.INVALID_TOKEN) {
        return NextResponse.json(
          { message: 'Invalid or expired reset link.' },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { message: result.error ?? 'Something went wrong.' },
        { status: 500 },
      );
    }

    console.log('[api/auth/reset-password] Success');
    return NextResponse.json(
      { message: 'Password reset successfully.' },
      { status: 200 },
    );
  } catch (err) {
    console.error('[api/auth/reset-password] Unexpected error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
```

**Design decision:** `resetPasswordSchema` carries `token` and `password` — no email field (the token flow doesn't require it). Rate limit is therefore by IP, consistent with the other routes. This still blocks automated token-stuffing attacks from a single origin.

---

### 1.8 Modified: `src/lib/auth/auth.ts`

Rate limit credentials login by submitted email. The `authorize` function receives the raw `Request` as its second parameter in NextAuth v5.

```typescript
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { loginSchema } from '@/lib/validations/auth';
import { rateLimit, loginLimiter } from '@/lib/rate-limit';
import './types';

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

        // Rate limit by email — prevents brute force against a specific account
        const limit = await rateLimit(email.toLowerCase(), loginLimiter);
        if (!limit.success) {
          console.log('[auth] Login rate limited:', email);
          // Return null; NextAuth surfaces a generic "Invalid credentials" error.
          // We deliberately do not distinguish rate limit from wrong password —
          // revealing this difference would help an attacker know they have a valid email.
          return null;
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
      if (user) {
        token.userId = user.id;
        token.email = user.email;
        token.name = user.name;
        token.platformRole = user.platformRole;
        token.isEmailVerified = user.isEmailVerified;
      }

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
```

**Design decision:** Login rate limit returns `null` rather than throwing a named error. This is intentional: distinguishing "too many attempts" from "wrong password" in the UI tells an attacker they have found a valid email address. A generic "Invalid credentials" message on both paths is the correct security posture.

---

### 1.9 Environment Variables

Add to `.env.example`:

```
# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Add both variables to the Environment Variables table in `docs/004-architecture.md`.

---

### 1.10 Increment Plan

| # | Work | Verify |
|---|------|--------|
| 1 | Install packages, create `src/lib/rate-limit.ts` | `npx tsc --noEmit` passes |
| 2 | Apply to signup + forgot-password routes | Manual: 6 rapid POSTs to signup → 6th returns 429 with `Retry-After` |
| 3 | Apply to resend-verification + reset-password routes | Manual: 4 rapid POSTs to reset-password → 4th returns 429 |
| 4 | Apply to auth.ts login | Manual: 11 login attempts with wrong password → 11th attempt is blocked |
| 5 | Add env vars to `.env.example` + architecture doc | Docs match implementation |

---

## Part 2: Email Verification Banner Fix

**PRD Requirements Covered:** P2.R1 through P2.R8 (scoped down — see discovery note above)

---

### 2.1 Root Cause

The `VerificationBanner` reads `session.user.isEmailVerified` from the `useSession()` hook. The `SessionProvider` (in `(dashboard)/layout.tsx`) is initialized without an explicit `session` prop, so it fetches the session client-side on mount via `/api/auth/session`.

The bug occurs in this specific scenario:

1. User is on the dashboard — `SessionProvider` is mounted, session is cached with `isEmailVerified: false`, banner is visible.
2. User opens the verification email link — either in the same tab (navigating away from dashboard) or in a new tab.
3. **Same-tab path:** The user verifies and clicks "Go to dashboard" (`<Link href="/dashboard">`). Next.js performs client-side navigation. Because this is a route-group change (`(auth)` → `(dashboard)`), the `SessionProvider` unmounts and remounts. On remount it fetches `/api/auth/session`, the JWT callback's DB check fires and returns `isEmailVerified: true`. Banner disappears. ✅ *This path already works.*
4. **New-tab path (the bug):** The user verifies in a new tab. Returns to the original dashboard tab. The already-mounted `SessionProvider` has the old cached session. NextAuth v5's `SessionProvider` does not refetch on window focus by default with the current no-props initialization. The banner persists indefinitely. ❌

---

### 2.2 Fix: Two Changes

**Change 1 — `SessionProvider`: enable `refetchOnWindowFocus`.**

`src/components/providers/session-provider.tsx`:

```typescript
'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider refetchOnWindowFocus>
      {children}
    </NextAuthSessionProvider>
  );
}
```

When the user returns to a dashboard tab after verifying in another tab, the next window focus triggers a session refetch. The JWT callback's DB check fires, returns `isEmailVerified: true`, and the banner disappears.

**Change 2 — `verify-email` page: hard redirect on success.**

`src/app/(auth)/verify-email/page.tsx` — replace the `<Link href="/dashboard">` with a hard redirect button:

```tsx
{state === 'success' && (
  <>
    <CheckCircle className="mx-auto size-10 text-primary" />
    <div className="space-y-1">
      <h2 className="text-lg font-heading font-semibold text-foreground">
        Email verified!
      </h2>
      <p className="text-sm text-muted-foreground">
        Your email has been verified successfully.
      </p>
    </div>
    <button
      onClick={() => { window.location.href = '/dashboard'; }}
      className="text-sm text-primary underline-offset-4 hover:underline"
    >
      Go to dashboard
    </button>
  </>
)}
```

`window.location.href` forces a full browser navigation (not Next.js client-side routing). This triggers a real HTTP request to `/dashboard`, which runs the Next.js middleware. The middleware calls `auth()`, the JWT callback fires, the DB check confirms `isEmailVerified: true`, and the middleware writes the updated JWT to the session cookie. The dashboard loads with a fresh, correct session from the start.

**Why both changes:** Change 1 covers the new-tab verification scenario. Change 2 ensures the same-tab path also gets a guaranteed fresh session, not one that relies on the JWT callback having run recently.

---

### 2.3 Files Changed

| File | Change |
|------|--------|
| `src/components/providers/session-provider.tsx` | Add `refetchOnWindowFocus` prop |
| `src/app/(auth)/verify-email/page.tsx` | Replace `<Link>` with hard-redirect button |

---

## Part 3: Platform Landing Page + Org-less Flow

**PRD Requirements Covered:** P3.R1 through P3.R7

---

### 3.1 Dependencies

No new packages. Uses existing: `next/image`, Drizzle, StorageProvider, `src/lib/services/hackathon-service.ts`.

---

### 3.2 New Component: `src/components/platform-nav.tsx`

Top nav for the platform-level pages (root `/` only). Uses `auth()` server-side to detect login state. Separate from the dashboard's `top-bar.tsx` — different context and different visual language.

```typescript
// Server Component
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { Button } from '@/components/ui/button';

export async function PlatformNav() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-heading text-xl font-bold text-foreground">
          HackForge
        </Link>
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
```

---

### 3.3 New Service Function: `getPublicHackathons`

Add to `src/lib/services/hackathon-service.ts`:

```typescript
export type PublicHackathonFilter = 'all' | 'open' | 'active' | 'upcoming';

export interface PublicHackathon {
  id: string;
  title: string;
  slug: string;
  status: string;
  coverImageUrl: string | null;
  orgName: string;
  orgSlug: string;
  registrationEndDate: Date | null;
}

export async function getPublicHackathons(
  filter: PublicHackathonFilter = 'all',
): Promise<PublicHackathon[]> {
  console.log('[hackathon-service] getPublicHackathons:', { filter });

  const statusFilter: string[] = filter === 'all'
    ? ['published', 'active']
    : filter === 'open' ? ['published']
    : filter === 'active' ? ['active']
    : ['published']; // 'upcoming' also maps to published

  const rows = await db
    .select({
      id: hackathons.id,
      title: hackathons.title,
      slug: hackathons.slug,
      status: hackathons.status,
      coverImageKey: hackathons.coverImageKey,
      orgName: organizations.name,
      orgSlug: organizations.slug,
    })
    .from(hackathons)
    .innerJoin(organizations, eq(hackathons.orgId, organizations.id))
    .where(
      and(
        inArray(hackathons.status, statusFilter),
        eq(hackathons.visibility, 'public'),
        isNull(hackathons.deletedAt),
        isNull(organizations.deletedAt),
      ),
    )
    .orderBy(desc(hackathons.createdAt));

  const storage = getStorageProvider();

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      coverImageUrl: row.coverImageKey
        ? await storage.getSignedUrl(row.coverImageKey)
        : null,
      orgName: row.orgName,
      orgSlug: row.orgSlug,
      registrationEndDate: null, // Phase 3.5 scope: no phases join yet
    })),
  );
}
```

---

### 3.4 Root Page: `src/app/page.tsx`

Replace the temporary page entirely. Server Component — fetches data server-side.

Structure:
- `<PlatformNav />` (server component)
- Hero section: tagline + two CTAs
- Filter bar + hackathon grid (client component for filter state, server-fetched data passed as prop)
- Footer

A co-located `_components/hackathon-grid.tsx` client component owns the filter state and renders cards from the server-fetched list.

---

### 3.5 Org-less Dashboard Fix: `src/app/(dashboard)/dashboard/page.tsx`

Read the current page, then update the branch that handles "no org memberships" to show a useful state instead of forcing org creation.

The updated no-membership branch renders:
- "Your Hackathons" section (their registrations, same data as My Hackathons)
- "Get Started" card: "Create an Organization" link + "You can also join via an invite link from an org admin."

No redirect. No wall.

---

### 3.6 Org-less Sidebar

In `src/app/(dashboard)/_components/app-sidebar.tsx`, the sidebar nav items are already conditionally rendered based on org membership. Ensure the no-membership state shows only:
- My Hackathons (`/dashboard/[orgSlug]/my-hackathons` is org-scoped, so for org-less users: a direct link to their registrations list on the dashboard page)
- Account Settings (`/dashboard/account` — to be built in Part 4)

---

### 3.7 Files Changed

| File | Change |
|------|--------|
| `src/app/page.tsx` | Replace placeholder with full platform homepage |
| `src/components/platform-nav.tsx` | New component |
| `src/app/page/_components/hackathon-grid.tsx` | New client component for filter + cards |
| `src/lib/services/hackathon-service.ts` | Add `getPublicHackathons()` |
| `src/app/(dashboard)/dashboard/page.tsx` | Fix org-less redirect → useful state |
| `src/app/(dashboard)/_components/app-sidebar.tsx` | Ensure org-less sidebar shows minimal nav |

---

## Part 4: User Profile + Account Settings

**PRD Requirements Covered:** P4.R1 through P4.R8

---

### 4.1 Dependencies

No new packages. Uses existing StorageProvider for avatar upload.

---

### 4.2 New API Routes

**`PATCH /api/user/profile`** — `src/app/api/user/profile/route.ts`

Accepts `{ name?: string; avatarUrl?: string; removeAvatar?: boolean }`. Auth required. Updates `users.name` and/or `users.avatar_url`. On `removeAvatar: true`: deletes storage object via `StorageProvider.delete(key)`, sets `avatar_url = null`.

**`POST /api/user/change-password`** — `src/app/api/user/change-password/route.ts`

Accepts `{ currentPassword: string; newPassword: string }`. Auth required. Fetches user by `userId` from session. `bcrypt.compare(currentPassword, user.passwordHash)` — returns 400 with generic message if wrong. `bcrypt.hash(newPassword, 12)` → updates `users.password_hash`. Returns 200 on success.

---

### 4.3 New Zod Schemas

Add to `src/lib/validations/auth.ts`:

```typescript
export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  avatarUrl: z.string().url().optional(),
  removeAvatar: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});
```

---

### 4.4 Page: `src/app/(dashboard)/dashboard/account/page.tsx`

Server Component. Fetches current user data via `auth()` + a `getUserById(userId)` call (add to `auth-service.ts` or read directly). Passes data as props to client sub-components in `_components/`.

Sub-components:
- `personal-info-form.tsx` — name field + avatar upload/removal
- `change-password-form.tsx` — current + new + confirm password
- `org-memberships-list.tsx` — read-only list of orgs with role + dashboard link

---

### 4.5 Top Bar Update

In `src/app/(dashboard)/_components/top-bar.tsx`, add "Account Settings" link to the user dropdown menu pointing to `/dashboard/account`. Insert above "Sign Out".

---

### 4.6 Files Changed

| File | Change |
|------|--------|
| `src/app/(dashboard)/dashboard/account/page.tsx` | New page |
| `src/app/(dashboard)/dashboard/account/_components/personal-info-form.tsx` | New |
| `src/app/(dashboard)/dashboard/account/_components/change-password-form.tsx` | New |
| `src/app/(dashboard)/dashboard/account/_components/org-memberships-list.tsx` | New |
| `src/app/api/user/profile/route.ts` | New route |
| `src/app/api/user/change-password/route.ts` | New route |
| `src/lib/validations/auth.ts` | Add `updateProfileSchema`, `changePasswordSchema` |
| `src/app/(dashboard)/_components/top-bar.tsx` | Add "Account Settings" menu item |

---

## Part 5: Pagination Architecture

**PRD Requirements Covered:** P5.R1 through P5.R11

---

### 5.1 New File: `src/lib/db-utils.ts`

```typescript
export interface PaginatedResult<T> {
  rows: T[];
  totalCount: number;
}

export function paginationParams(page: number, pageSize: number) {
  return {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}
```

**Design decision:** Rather than a generic `paginate<T>()` wrapper that takes a Drizzle query, expose `paginationParams()` — a plain object with `limit` and `offset`. Each service function applies these to its own query chain. Drizzle's query builder doesn't compose well as a generic type parameter, so a thin helper is safer and more readable than a heavyweight wrapper.

---

### 5.2 New Component: `src/components/pagination-controls.tsx`

```typescript
'use client';

interface PaginationControlsProps {
  totalCount: number;
  page: number;
  pageSize: number;
  basePath: string; // The current URL path, used to build page URLs
}
```

Uses `useRouter()` + `useSearchParams()` to replace `?page=N` in the URL without losing other params. Renders: "Showing X–Y of Z results" label, Previous and Next buttons with disabled states at boundaries.

---

### 5.3 URL Search Params Pattern

All list pages read `page`, `q`, and filter params from `searchParams` (Next.js server component prop). Client filter components update params via `useRouter().replace(newUrl, { scroll: false })` wrapped in `startTransition`. This pattern is consistent across all 6 paginated views.

---

### 5.4 Service Function Signature Convention

All paginated service functions add these optional params:

```typescript
interface PaginationOptions {
  q?: string;
  page?: number;
  pageSize?: number;
}
```

Return type: `Promise<{ rows: T[]; totalCount: number }>`.

Existing callers that don't pass pagination params receive page 1 with the context default — backward compatible.

---

### 5.5 Files Changed

| File | Change |
|------|--------|
| `src/lib/db-utils.ts` | New — `paginationParams()` helper |
| `src/components/pagination-controls.tsx` | New shared component |
| `src/lib/services/registration-service.ts` | Add pagination to `getRegistrationsByHackathon`, `getDiscoverableParticipants` |
| `src/lib/services/team-service.ts` | Add pagination to `getTeamsByHackathon`, `getAllTeams` |
| `src/lib/services/org-service.ts` | Add pagination to `getOrgMembers` |
| `src/lib/services/hackathon-service.ts` | Add pagination to `getHackathonsByOrgId` |
| `src/app/(public)/hackathons/[slug]/participants/page.tsx` | Server-side search + pagination |
| `src/app/(public)/hackathons/[slug]/participants/_components/participants-browse-client.tsx` | Remove useMemo search |
| `src/app/(public)/hackathons/[slug]/teams/page.tsx` | Server-side search + pagination |
| `src/app/(public)/hackathons/[slug]/teams/_components/team-browse-client.tsx` | Remove useMemo search |
| `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/[hackathonId]/participants/page.tsx` | Server-side search + pagination |
| `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/[hackathonId]/teams/page.tsx` | Server-side search + pagination |
| `src/app/(dashboard)/dashboard/[orgSlug]/members/page.tsx` | Server-side search + pagination |
| `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/page.tsx` | Server-side search + pagination |

---

## Part 6: Design Token System

**PRD Requirements Covered:** P6.R1 through P6.R7

---

### 6.1 Token Layer Structure in `globals.css`

Tokens are organized into four explicit layers in `globals.css`:

```
Layer 1 — Primitive palette      :root { --color-neutral-50 ... --color-brand-900 }
Layer 2 — Semantic aliases        :root { --color-background: var(--color-neutral-50) ... }
Layer 3 — Competitive overrides   .theme-competitive { --color-background: #0a0a0f ... }
Layer 4 — Typography + spacing    @layer base { body, headings, ... }
```

Components reference **Layer 2 semantic tokens only** — never primitives, never hardcoded hex.

---

### 6.2 Tailwind Config Alignment

`tailwind.config.ts` extends `colors`, `borderRadius`, and `fontSize` to reference the CSS custom properties:

```typescript
theme: {
  extend: {
    colors: {
      brand: {
        50: 'var(--color-brand-50)',
        // ... through 900
      },
      background: 'var(--color-background)',
      surface: 'var(--color-surface)',
      border: 'var(--color-border)',
      // semantic text colors
      'text-primary': 'var(--color-text-primary)',
      'text-secondary': 'var(--color-text-secondary)',
      'text-muted': 'var(--color-text-muted)',
    },
    borderRadius: {
      sm: 'var(--radius-sm)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      xl: 'var(--radius-xl)',
    },
  },
}
```

---

### 6.3 Component Audit Scope

Grep targets:
- `text-\[#` — hardcoded hex text color
- `bg-\[#` — hardcoded hex background
- `text-\[\d` — arbitrary font size (e.g., `text-[13px]`)
- `p-\[` / `m-\[` / `gap-\[` — arbitrary spacing

Each hit is replaced with the nearest token. Hits that don't map to an existing token get a new token added to the scale before replacement.

---

### 6.4 Files Changed

| File | Change |
|------|--------|
| `src/app/globals.css` | Full restructure into token layers |
| `tailwind.config.ts` | Extend with token references |
| `docs/003-coding-conventions.md` | Add "Design Token Reference" section |
| All component files with hardcoded values | Audit replacements |

---

## Part 7: Org Settings CRUD

**PRD Requirements Covered:** P7.R1 through P7.R7

---

### 7.1 New API Route: `PATCH /api/orgs/[orgId]`

`src/app/api/orgs/[orgId]/route.ts` — already has child routes; add a PATCH handler to the existing `route.ts` at this path (or create it if only children exist).

Accepts `{ name?: string; logoUrl?: string; removeLogo?: boolean }`. Validated with `updateOrgSchema`. Requires `org_admin` via `requireOrgRole`. Calls `updateOrg()` from `org-service.ts`.

---

### 7.2 New Service Function: `updateOrg`

Add to `src/lib/services/org-service.ts`:

```typescript
export async function updateOrg(
  orgId: string,
  data: { name?: string; logoUrl?: string; removeLogo?: boolean },
): Promise<Organization> {
  console.log('[org-service] updateOrg:', { orgId, ...data });

  if (data.removeLogo) {
    // Fetch current logo key, delete from storage, clear column
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { logoUrl: true },
    });
    if (org?.logoUrl) {
      const storage = getStorageProvider();
      await storage.delete(org.logoUrl); // logoUrl stores the key
    }
  }

  const [updated] = await db
    .update(organizations)
    .set({
      ...(data.name && { name: data.name }),
      ...(data.logoUrl && { logoUrl: data.logoUrl }),
      ...(data.removeLogo && { logoUrl: null }),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId))
    .returning();

  return updated;
}
```

---

### 7.3 New Zod Schema

Add to `src/lib/validations/org.ts`:

```typescript
export const updateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logoUrl: z.string().url().optional(),
  removeLogo: z.boolean().optional(),
});
```

---

### 7.4 Page: `src/app/(dashboard)/dashboard/[orgSlug]/settings/page.tsx`

Replace placeholder. Server Component — fetches org data. Two sections:
- `<general-settings-form />` — name + logo
- Danger Zone card (informational, no delete action)

Logo upload uses the existing `POST /api/upload/image` signed URL flow, same as cover images and avatars.

---

### 7.5 Files Changed

| File | Change |
|------|--------|
| `src/app/(dashboard)/dashboard/[orgSlug]/settings/page.tsx` | Replace placeholder |
| `src/app/(dashboard)/dashboard/[orgSlug]/settings/_components/general-settings-form.tsx` | New |
| `src/app/api/orgs/[orgId]/route.ts` | Add PATCH handler |
| `src/lib/services/org-service.ts` | Add `updateOrg()` |
| `src/lib/validations/org.ts` | Add `updateOrgSchema` |

---

## Implementation Order

Parts are independent and can be built in sequence. The recommended order preserves early security wins and logical scaffolding:

```
Part 1 (Rate Limiting)  →  Part 2 (Banner Fix)  →  Part 6 (Design Tokens)
→  Part 3 (Platform Landing)  →  Part 4 (Account Settings)
→  Part 7 (Org Settings)  →  Part 5 (Pagination)
```

Rationale: Rate limiting and the banner fix are low-risk, high-value security and correctness wins. Design tokens before new UI (Parts 3, 4, 7) ensures new pages use the token system from the start rather than being audited after. Pagination last because it touches the most existing files and benefits from the other parts being stable first.

---

*This TRD covers all 7 parts of PRD-009. Parts are implemented one at a time. After the last part: run the full end-of-PRD audit, update `docs/004-architecture.md`, update `CHANGELOG.md`, and run `npx tsc --noEmit`.*
