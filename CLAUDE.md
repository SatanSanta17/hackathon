# HackForge — Session Bootstrap

## First Steps Every Session

1. Read `docs/004-architecture.md` before making any changes — it contains the current system design, file map, data model, and folder structure.
2. Read `docs/003-coding-conventions.md` if writing or reviewing code — it contains naming rules, TypeScript patterns, component architecture, and styling rules.
3. Read `docs/005-development-workflow.md` if starting a new feature — it contains the PRD → TRD → Implement → Verify pipeline and quality gates.
4. Read `docs/002-v1-development-phases.md` if starting or continuing a development phase — it contains the 20-day build plan with daily task checklists, effort estimates, and deliverables per phase.
5. If modifying any file, read it first — don't assume from memory.
6. If modifying a page or component, read its co-located components and relevant service files first.
7. Always ask for plan confirmation before coding.
8. Never create a document without being asked for it explicitly.

## Project Quick Context

- **Product:** HackForge — enterprise hackathon management platform
- **Owner:** Burhanuddin C.
- **First Customer:** InMobi (internal hackathons)
- **North Star:** Global multi-tenant SaaS
- **Stage:** V1 MVP (20 dev-days)

## Tech Stack (Quick Reference)

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+ (App Router) on Vercel |
| Styling | Tailwind CSS + shadcn/ui |
| Auth | NextAuth.js v5 (credentials → extensible to SSO) |
| ORM | Drizzle ORM (type-safe, SQL-native) |
| Database | PostgreSQL via Supabase (accessed only through Drizzle) |
| File Storage | Supabase Storage (behind StorageProvider interface) |
| Email | Resend + React Email |
| Deployment | Vercel |

## Key Architectural Principles

- **Provider-agnostic.** Supabase is an infrastructure provider, not a framework. All DB access through Drizzle. All storage through StorageProvider interface. Swappable by changing connection strings.
- **API-layer authorization.** No Supabase RLS. Auth checks live in Next.js middleware and API route handlers.
- **Multi-tenant from day 1.** Every entity has an `org_id`. Even with one org, the data model supports isolation.
- **Soft deletes.** Domain entities use `deleted_at` timestamps. Never hard-delete user data.
- **UUIDs everywhere.** No auto-increment IDs. Prevents enumeration and simplifies multi-tenancy.

## Documentation Map

| Document | Purpose | Update Frequency |
|----------|---------|-----------------|
| `docs/000-project-context.md` | Vision, scope, stakeholders | Rarely |
| `docs/001-technical-decisions.md` | Decision log (append-only) | Per decision |
| `docs/002-v1-development-phases.md` | V1 build plan with daily tasks | Per phase |
| `docs/003-coding-conventions.md` | Code style, naming, patterns | Rarely |
| `docs/004-architecture.md` | File map, data model, system design | Every phase |
| `docs/005-development-workflow.md` | PRD/TRD process, quality gates | Rarely |
| `CHANGELOG.md` | What shipped, when | Every increment |
