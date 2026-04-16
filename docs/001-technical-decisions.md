# HackForge — Technical Decision Record (TDR)

**Document ID:** TDR-001  
**Date:** April 15, 2026  
**Author:** Burhanuddin C.  
**Status:** Approved  

---

## Context

HackForge is an enterprise hackathon management platform being built as a solo-developer project. The first customer is InMobi (internal hackathons). The north star is a global, multi-tenant SaaS product. All technical decisions below were made to optimize for three constraints: solo-developer velocity, zero development cost, and future enterprise portability.

---

## Decision 1: Architecture Pattern — Hybrid (Provider-Agnostic)

**Decision:** Build a hybrid architecture using Next.js API routes as the backend, with Supabase as the initial infrastructure provider behind abstraction interfaces.

**Alternatives Considered:**

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Supabase-Heavy (BaaS)** | Fastest to ship (~2 weeks). Near-zero backend code. Free tier covers V1. | Deep vendor lock-in (Auth, RLS, Edge Functions all Supabase-specific). Painful to migrate. Enterprise customers may reject. | Rejected — contradicts provider-agnostic requirement |
| **Hybrid (Chosen)** | Provider-agnostic. Full control over auth and business logic. Supabase swappable by changing connection string. | ~3-4 extra days vs BaaS approach. More code to write and maintain. | **Selected** |
| **Decoupled (Separate API server)** | Maximum portability. Clean separation of concerns. Industry standard. | Two deployments to manage. CORS handling. Slowest to ship. Overkill for solo dev V1. | Rejected — too slow for timeline |

**Key Principle:** Supabase is treated as an infrastructure provider (managed Postgres + object storage), NOT as a backend framework. All business logic lives in Next.js API routes. All database access goes through Drizzle ORM. All storage access goes through a `StorageProvider` interface. Swapping Supabase means changing connection strings and implementing a new StorageProvider — not rewriting the app.

---

## Decision 2: Tech Stack

### Frontend
| Choice | Technology | Reasoning |
|--------|-----------|-----------|
| **Framework** | Next.js 14+ (App Router) | Server components reduce client JS. API routes eliminate need for separate backend. App Router is the future of Next.js. Vercel deployment is zero-config. |
| **Styling** | Tailwind CSS | Utility-first, no design system dependency. Fast to prototype. Industry standard. |
| **UI Components** | shadcn/ui | Not a library — copy-paste components you own. No vendor dependency. Built on Radix primitives (accessible). Tailwind-native. |
| **Forms** | React Hook Form + Zod | Type-safe validation. Minimal re-renders. Zod schemas shared between frontend and API validation. |

### Backend
| Choice | Technology | Reasoning |
|--------|-----------|-----------|
| **API Layer** | Next.js API Routes / Server Actions | Co-located with frontend. No separate deployment. Serverless on Vercel (auto-scales). |
| **Auth** | NextAuth.js v5 (Auth.js) | Credentials provider for V1 (email/password). Extensible — add Google, GitHub, SAML later without rewriting auth. JWT session strategy for stateless scaling. |
| **ORM** | Drizzle ORM | Type-safe, SQL-native, lightweight (~7x smaller than Prisma). Schema defined in TypeScript. Generates standard SQL — fully portable across Postgres providers. No code generation step. |
| **Database** | PostgreSQL (via Supabase) | Relational model fits the domain perfectly (orgs → hackathons → phases → submissions → evaluations). Supabase free tier: 500MB, 2 projects. Accessed only through Drizzle — swappable to any Postgres. |
| **File Storage** | Supabase Storage (initially) | Free tier: 1GB. Behind a `StorageProvider` interface so it can be swapped to S3, Cloudflare R2, or any S3-compatible service. |
| **Email** | Resend + React Email | Free tier: 100 emails/day (sufficient for V1 dev + first hackathon). React Email lets you build templates as React components. Clean API. |
| **Background Jobs** | Vercel Cron + simple DB queue | V1 doesn't need a full job queue. Vercel Cron handles scheduled tasks (deadline reminders). Email sending is fire-and-forget via Resend API. |

### Infrastructure
| Choice | Technology | Reasoning |
|--------|-----------|-----------|
| **Hosting** | Vercel | Free tier during dev. Pro ($20/mo) at launch. Zero-config deployment from Git. Edge network for global performance. |
| **Database Hosting** | Supabase | Free tier: 500MB storage, unlimited API requests. Managed Postgres with connection pooling (PgBouncer). |
| **CDN** | Vercel Edge Network | Included with Vercel. Static assets and ISR pages served from edge. |
| **Monitoring** | Vercel Analytics + Sentry (free) | Vercel gives web vitals. Sentry catches errors with stack traces. Both have generous free tiers. |

### Development Cost Breakdown
| Service | Dev Phase | Production (Launch) |
|---------|-----------|-------------------|
| Vercel | $0 (Hobby) | $20/mo (Pro) |
| Supabase | $0 (Free) | $0-25/mo (Free → Pro if needed) |
| Resend | $0 (100 emails/day) | $20/mo (50K emails) |
| Domain | ~$12/year | ~$12/year |
| **Total** | **$0/month** | **$20-45/month** |

---

## Decision 3: ORM — Drizzle over Prisma

**Decision:** Use Drizzle ORM instead of Prisma.

**Reasoning:**

| Criteria | Drizzle | Prisma |
|----------|---------|--------|
| Bundle size | ~35KB | ~250KB+ (heavy for serverless) |
| Cold start (Vercel) | Fast | Slow (engine binary) |
| Query style | SQL-like (transparent) | Abstracted (sometimes surprising) |
| Schema definition | TypeScript files | Separate .prisma file + codegen |
| Migration workflow | `drizzle-kit generate` → review → apply | `prisma migrate dev` → auto-apply |
| Provider portability | Generates standard SQL | Prisma-specific migration format |
| Type safety | Full | Full |
| Ecosystem maturity | Growing (newer) | Mature (larger community) |

**The deciding factor:** Drizzle generates standard SQL that works identically across any Postgres provider. Prisma's migration engine creates Prisma-specific migration files that can cause issues when switching providers. Given our provider-agnostic requirement, Drizzle is the right choice.

---

## Decision 4: Auth — NextAuth.js over Supabase Auth

**Decision:** Use NextAuth.js v5 (Auth.js) for authentication instead of Supabase Auth.

**Reasoning:**
- **Provider-agnostic:** NextAuth stores sessions/users in our own Postgres tables (via Drizzle adapter). No dependency on Supabase's auth service.
- **Extensible:** Adding SSO/SAML in V2 means adding a provider config — not migrating auth systems.
- **Control:** We own the user table schema, password hashing strategy, and session management. Enterprise customers can audit the auth flow.
- **JWT strategy:** Stateless sessions that work across Vercel's serverless functions without shared session storage.

**Trade-off accepted:** ~1 extra day of setup vs Supabase Auth's zero-config approach.

---

## Decision 5: Development Approach — Vertical Slices

**Decision:** Build V1 in vertical slices (full feature end-to-end per phase) rather than horizontal layers (all DB → all API → all UI).

**Reasoning:**
- Solo developer needs demoable progress every 2-3 days to maintain momentum and get stakeholder feedback.
- If timeline slips, a vertical approach ensures you have a partially working product (e.g., auth + hackathon creation works, but judging isn't done yet). A horizontal approach would leave you with a complete DB schema but zero working UI.
- Easier to course-correct if early feedback reveals a wrong assumption.

---

## Decision 6: UI Component Strategy — shadcn/ui

**Decision:** Use shadcn/ui instead of a traditional component library (Material UI, Ant Design, Chakra).

**Reasoning:**
- **No vendor lock-in:** Components are copied into your project. You own them. No version upgrade headaches.
- **Tailwind-native:** No CSS-in-JS runtime. Consistent with the rest of the styling approach.
- **Accessible by default:** Built on Radix UI primitives (WAI-ARIA compliant).
- **Customizable:** Since you own the code, enterprise white-labeling in V2 is trivial.
- **No design dependency:** Components look professional out of the box. A solo dev without a designer can still ship polished UI.

---

## Explicitly Rejected Technologies

| Technology | Why Rejected |
|-----------|-------------|
| **Prisma** | Heavier bundle, slower cold starts on Vercel, less portable migration format |
| **Supabase Auth** | Vendor lock-in, contradicts provider-agnostic requirement |
| **Supabase RLS** | Business logic should live in application layer, not database policies |
| **Supabase Edge Functions** | Would split backend across two runtimes (Vercel + Supabase). Keep everything in Next.js API routes |
| **Express/Fastify (separate server)** | Adds deployment complexity for zero benefit at V1 scale |
| **MongoDB** | Hackathon domain is deeply relational (orgs → hackathons → phases → evaluations). Document DB is a poor fit |
| **Material UI / Ant Design** | Heavy, opinionated styling, difficult to customize for white-labeling |
| **tRPC** | Adds complexity without proportional benefit for a solo dev project |

---

## Open Technical Questions (To Be Resolved)

1. **Real-time features:** Do we need WebSocket/SSE for live leaderboard updates in V1, or is polling sufficient?
2. **File upload limits:** Supabase Storage free tier is 1GB. How many hackathons before we need to upgrade or add R2?
3. **Email deliverability:** Resend handles SPF/DKIM, but we need a custom sending domain for professional emails. Budget: ~$12/year for domain.
4. **Testing strategy:** What level of test coverage is acceptable for V1? (Recommendation: E2E tests for critical flows, skip unit tests initially.)

---

---

## Decision 7: Hackathon Lifecycle — Check-on-Access Only (No Cron Job for V1)

**Date:** April 17, 2026  
**Context:** Phase 2 Part 3 — Hackathon List + Management

**Decision:** Implement only check-on-access for automated status transitions in V1. Defer the daily Vercel Cron job to V2.

**How it works:** Every time a hackathon is loaded (via `getHackathonById`, `getHackathonBySlug`, or `getHackathonsByOrgId`), the service compares phase dates against the current time and updates statuses if transitions are due. The status is always correct when someone is looking at it.

**Why no cron:** With InMobi as the only V1 customer, every active hackathon will be regularly visited by admins or participants. The cron job would catch hackathons nobody visits — a scenario that barely exists at this scale. Adding a cron job introduces Vercel tier considerations and scheduled task management for near-zero benefit.

**Trade-off accepted:** If a hackathon is never visited after its phase dates pass, its status will remain stale in the database until someone loads it. This is acceptable for V1.

---

## Decision 8: Restricted Manual Transitions — Only Publish and Archive

**Date:** April 17, 2026  
**Context:** Phase 2 Part 3 — Hackathon List + Management

**Decision:** Only two status transitions can be triggered manually by an admin: draft→published and completed→archived. All middle-state transitions (published→active, active→judging, judging→completed) are date-driven and handled automatically by the check-on-access lifecycle engine.

**Reasoning:** If an admin wants to influence timing (e.g., start a hackathon early), they should edit the phase dates rather than force a status change. This prevents the status and dates from going out of sync. It's a simpler mental model: dates control lifecycle, admin controls publish/archive intent.

**Alternative considered:** Allowing manual transitions for all forward states (draft→published→active→judging→completed→archived). Rejected because it would let admins create a state where the hackathon status says "active" but the first phase hasn't started yet.

---

*This document is a living record. All significant technical decisions will be added here with date, context, and reasoning.*
