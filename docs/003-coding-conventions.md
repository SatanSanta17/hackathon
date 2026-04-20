# HackForge — Coding Conventions

**Document ID:** CONV-003  
**Date:** April 15, 2026  
**Status:** Active  
**Update Frequency:** Rarely (stable rules)

---

## SOLID & Clean Code Principles

These principles apply to every change across both frontend and API routes.

- **Single Responsibility (S).** Each file, component, and function does one thing. If a component handles both UI rendering and data fetching, split them. If an API route does validation and persistence, separate the concerns.
- **Open/Closed (O).** Extend behavior without modifying existing code. Use props, composition, and factory patterns instead of editing working code to add new behavior.
- **Liskov Substitution (L).** All implementations of an interface must be interchangeable. Every shared component works with its default props alone. Every StorageProvider implementation is swappable without changing consuming code.
- **Interface Segregation (I).** Don't force consumers to depend on things they don't use. Keep component prop interfaces minimal. Keep utility functions focused.
- **Dependency Inversion (D).** High-level modules should not depend on low-level details. Components consume props, not global state. API routes call service functions, not raw database queries. Services use the Drizzle client, never raw SQL strings.

### Additional Practices

- **DRY — Extract shared patterns.** If the same UI pattern or logic appears in two or more places, extract it. Don't duplicate code across files.
- **Delete dead code immediately.** Unused files, imports, and components are never left "just in case."
- **Naming reflects purpose.** Names describe what something does, not how it's implemented.
- **Composition over inheritance.** Build complex components by composing simple ones.
- **Fail explicitly.** Errors are caught, logged, and surfaced — never silently swallowed.
- **Log everything that matters.** Every API route and service function logs: entry with input context, exit with outcome, and errors with full stack traces.

---

## Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| Files | kebab-case | `hackathon-form.tsx`, `submission-service.ts` |
| Directories | kebab-case | `_components/`, `lib/services/` |
| Components | PascalCase | `HackathonForm`, `JudgeScoreCard` |
| Props interfaces | PascalCase + Props | `HackathonFormProps`, `TeamCardProps` |
| Event handlers | handle + Action | `handleSubmit`, `handleScoreChange` |
| Custom hooks | use + Name | `useAuth`, `useHackathon`, `useTeam` |
| Constants | UPPER_SNAKE_CASE | `MAX_FILE_SIZE`, `TEAM_MIN_SIZE` |
| Zod schemas | camelCase + Schema | `hackathonSchema`, `submissionSchema` |
| API routes | kebab-case REST | `/api/hackathons`, `/api/hackathons/[id]/submissions` |
| DB tables | snake_case plural | `hackathons`, `teams`, `evaluations` |
| DB columns | snake_case | `org_id`, `cover_image_url`, `created_at` |
| Env vars | UPPER_SNAKE_CASE | `DATABASE_URL`, `NEXTAUTH_SECRET`, `RESEND_API_KEY` |

### Exports

- **Named exports only.** Use `export function Component()` — not `export default`. Exception: Next.js page and layout components use `export default` as required by the framework.
- **Types exported alongside code.** `export interface`, `export type` in the same file as the component or function that uses them.

### Import Order

1. React and Next.js: `import { useState } from 'react'`, `import Link from 'next/link'`
2. Third-party libraries: `import { z } from 'zod'`, `import { useForm } from 'react-hook-form'`
3. Internal utilities: `import { cn } from '@/lib/utils'`
4. Internal components: `import { Button } from '@/components/ui/button'`
5. Internal services/hooks: `import { useAuth } from '@/lib/hooks/use-auth'`
6. Types (if separate): `import type { Hackathon } from '@/lib/types'`

Blank line between each group.

---

## Frontend — Next.js Conventions

### Component Architecture

- **Page routes are thin.** Page files set up the shell (layout, metadata) and compose from smaller components. No business logic in page files.
- **Co-locate private components with their route.** Route-specific components live in a `_components/` directory next to their page file and are never imported outside that route.
- **Shared components are extracted once reused.** If a component is used across two or more routes, extract it into `components/`. Single-route components stay co-located.
- **UI primitives are untouchable.** shadcn/ui components are never modified with business logic. Extend via composition, not modification.
- **Default to Server Components.** Every component is a React Server Component unless it needs client-side interactivity (`useState`, `useEffect`, event handlers, browser APIs). Only add `'use client'` when the component genuinely requires it. Push the client boundary as deep as possible.
- **Metadata is co-located with routes.** Every page exports a `metadata` object or `generateMetadata` function for SEO. Never hardcode `<title>` or `<meta>` tags in components.
- **Use `next/image` for all images.** Never use raw `<img>` tags.
- **Use `next/link` for all internal navigation.** Never use `<a>` tags for internal routes. Never use `window.location` for client-side navigation — use `useRouter()` from `next/navigation`.
- **Environment variables follow the `NEXT_PUBLIC_` convention.** Client-accessible env vars must be prefixed with `NEXT_PUBLIC_`. Server-only secrets must never be prefixed. Never expose API keys or secrets to the client bundle.

### TypeScript Patterns

- **Strict mode is enabled.** No `any` types unless absolutely unavoidable and documented with a comment explaining why.
- **Props use interfaces, not types.** Define `interface ComponentProps { ... }` above the component. Always include `className?: string` for composability.
- **Zod for validation, infer for types.** Forms use `z.object()` schemas with `type FormFields = z.infer<typeof schema>`. Never duplicate types manually when Zod can infer them. Import the inferred type from the validation file — never redefine it locally in a component.
- **Discriminated unions for state machines.** Use `type HackathonStatus = 'draft' | 'published' | 'active' | 'judging' | 'completed'` — never booleans for multi-state flows.
- **Error narrowing.** Always use `err instanceof Error ? err.message : 'Something went wrong'` in catch blocks. Never assume `err` is an Error.
- **Prefer `satisfies` over `as`.** Use `const config = { ... } satisfies Config` for type-safe object literals. Reserve `as` for genuinely narrowing an unknown type, never to silence errors.
- **Database types come from Drizzle schema.** Use `typeof hackathons.$inferSelect` and `typeof hackathons.$inferInsert` for type inference. Never manually define types that duplicate the database schema.

### State Management

- **React hooks only.** No Redux, Zustand, or external state libraries. `useState` for component state, `useRef` for mutable values, `useCallback` for stable function references.
- **Custom hooks in `lib/hooks/`.** Prefix with `use-` (file) and `use` (function). Return objects, not arrays. Include cleanup in `useEffect` return.
- **Forms use react-hook-form + zod.** Always: `useForm<T>({ resolver: zodResolver(schema), defaultValues: {...} })`. Never manage form state manually.
- **No global state.** Components receive data via props. Context is used only for cross-cutting concerns (auth, theme). Never use context as a general state store.
- **Derive state, don't sync it.** If a value can be computed from existing state or props, compute it inline or with `useMemo`. Never use `useEffect` to sync one state variable to another.

### Styling Rules

- **Tailwind CSS with a clean, professional design.** White background, neutral greys, single brand accent colour. Polished enough for paying enterprise customers.
- **Use `cn()` for conditional classes.** Never concatenate class strings manually. Always use `cn()` (clsx + tailwind-merge) that handles Tailwind class conflicts.
- **Desktop-first, mobile-responsive.** Primary experience is desktop. All pages must be fully responsive and usable on mobile.
- **Consistent spacing and sizing.** Use Tailwind's spacing scale consistently. Don't mix arbitrary pixel values with Tailwind units.
- **Theme tokens are defined globally.** All shared colours, font sizes, border radii, shadows, and brand tokens must be defined in `globals.css` using CSS custom properties or Tailwind's `@layer` directives. Components reference these global tokens. If a value appears in more than one component, it belongs in the global stylesheet.
- **No arbitrary Tailwind values for defined tokens.** Never use `text-[10px]`, `bg-[#abc]`, or any other arbitrary bracket value when a design token already covers that value. Add a new token to `globals.css` first, then use its utility class.

### Design Token Reference

The project uses **Tailwind v4 CSS-based configuration** — there is no `tailwind.config.ts`. All tokens are defined in `src/app/globals.css` across four layers:

| Layer | Selector | Purpose |
|-------|----------|---------|
| Layer 1 | `@theme inline` | Maps Tailwind utility names (e.g. `bg-background`) to CSS variables |
| Layer 2 | `:root` | Admin/dashboard theme — light base, neutral greys |
| Layer 2a | `.dark` | Dark-mode overrides for the admin theme |
| Layer 3 | `.theme-competitive` | Participant-facing theme — dark base, neon accents |
| Layer 4 | `@layer base` | Global element resets using token utilities |

**Token categories and their Tailwind utility prefixes:**

| Token group | CSS variable prefix | Tailwind prefix |
|-------------|---------------------|-----------------|
| Colours | `--background`, `--foreground`, `--primary`, … | `bg-*`, `text-*`, `border-*` |
| Prize ranks | `--prize-gold`, `--prize-silver`, `--prize-bronze` | `bg-prize-gold`, `text-prize-gold-foreground`, … |
| Hero gradient | `--hero-gradient-from/via/to` | `from-hero-gradient-from`, … |
| Timeline states | `--timeline-active/completed/upcoming/connector` | `bg-timeline-active`, … |
| Section divider | `--section-divider` | `bg-section-divider` |
| Custom text sizes | `--text-2xs` (10 px) | `text-2xs` |

**Rules:**
1. Never add a token to `@theme inline` alone — pair it with a definition in `:root` (and `.theme-competitive` if it has a competitive variant).
2. Admin-theme tokens (`:root`) apply inside all `theme-competitive` pages too unless overridden — always check both themes when adding a token that is theme-sensitive.
3. The `text-2xs` utility (10 px) is the only custom text size. Use it for compact badge labels instead of `text-[10px]`.

---

## API Routes (Next.js Route Handlers)

- **All sensitive operations are server-side only.** Database writes, email sending, and any secret-dependent logic lives in `app/api/` route handlers or Server Actions.
- **Route handlers validate input with Zod.** Every POST/PUT handler parses the request body with a Zod schema. Invalid input returns 400 with a descriptive error.
- **Route handlers don't contain business logic.** They validate input, call service functions from `lib/services/`, and format responses. Extract business logic to services.
- **HTTP status codes are explicit.** 400 = bad input, 401 = unauthenticated, 403 = forbidden, 404 = not found, 409 = conflict, 500 = server error. Always include a JSON body with a `message` field.
- **Service functions live in `lib/services/`.** Each domain gets a service file (e.g., `hackathon-service.ts`, `submission-service.ts`, `evaluation-service.ts`). Services handle data access (Drizzle queries), business logic, and external API calls. Services never import from `next/server` — they are framework-agnostic.

---

## Database Conventions (Drizzle + PostgreSQL)

- **Drizzle is the only way to talk to the database.** No raw SQL strings. No Supabase client for data access. All queries go through Drizzle's query builder or relational queries.
- **Schema is defined in TypeScript.** All table definitions live in `src/db/schema/`. Each domain gets its own schema file (e.g., `hackathons.ts`, `teams.ts`, `evaluations.ts`). A barrel `index.ts` re-exports everything.
- **Migrations are generated, never hand-written.** Run `drizzle-kit generate` to create migrations from schema changes. Review the generated SQL before applying. Run `drizzle-kit migrate` to apply.
- **Every table has standard columns.** `id` (UUID, primary key, default random), `created_at` (timestamp with timezone, default now), `updated_at` (timestamp with timezone, default now).
- **Soft deletes for domain entities.** Use `deleted_at` column (nullable timestamp). Queries filter `WHERE deleted_at IS NULL` unless explicitly recovering. Hard deletes only for transient data (expired tokens, temporary records).
- **Multi-tenant by default.** Every domain table has an `org_id` foreign key. No query should ever fetch data without scoping to the current org (enforced at the service layer).
- **Timestamps are UTC.** All timestamp columns use `timestamptz`. No timezone conversion at the database level.
- **UUIDs as primary keys.** Use `uuid('id').primaryKey().defaultRandom()` on every table. No auto-increment.
- **Enums as Postgres enums.** Use `pgEnum` for status fields, role fields, and other bounded sets. Define enums in `src/db/schema/enums.ts`.
- **Indexes on foreign keys and frequently filtered columns.** Add explicit indexes on `org_id`, `hackathon_id`, `user_id`, `status`, and any column used in WHERE clauses or JOINs.

---

## Authentication Conventions (NextAuth.js)

- **NextAuth.js v5 handles all auth.** No custom auth implementation. Use the Credentials provider for V1 (email/password). JWT session strategy.
- **Auth config lives in `src/lib/auth/`.** Single `auth.ts` file with providers, callbacks, and adapter config. Drizzle adapter connects auth to our Postgres tables.
- **Session data is minimal.** JWT contains: `userId`, `email`, `name`, `orgId`, `role`. No sensitive data in the token.
- **Middleware protects all `/dashboard` routes.** Next.js middleware checks for a valid session. Unauthenticated users are redirected to `/login`.
- **API routes verify sessions explicitly.** Every API route that requires auth calls `auth()` at the top and returns 401 if no session. Never assume a request is authenticated.
- **Role checks are explicit.** After verifying the session, check `session.user.role` against the required role. Return 403 for insufficient permissions.
- **Password hashing uses bcrypt.** Cost factor 12. Never store plaintext passwords. Never log passwords or tokens.

---

## File Storage Conventions

- **All file access goes through the `StorageProvider` interface.** The interface defines: `upload()`, `getSignedUrl()`, `delete()`, `list()`. The active implementation is injected via a factory function.
- **`SupabaseStorageProvider` is the V1 implementation.** Swappable to `S3StorageProvider`, `R2StorageProvider`, etc. by changing the factory config.
- **File uploads go directly from the client to storage.** Use signed upload URLs. Files never pass through the API route (avoids serverless function timeout and memory limits).
- **Validate files on both client and server.** Client: check type and size before upload. Server: verify the uploaded file metadata before saving the reference to the database.
- **File references in the database store the storage key, not the full URL.** URLs are generated on-demand via `getSignedUrl()`. This makes provider migration trivial.

---

## Constants Patterns

### Error Codes
All error code strings are defined in `src/lib/constants/error-codes.ts` as the `ERR` object. Services `throw new Error(ERR.SOME_CODE)` and API routes catch them and map to HTTP responses. Never write raw string literals like `throw new Error('TEAM_NOT_FOUND')` — always use an `ERR.*` constant on both the throw and catch sides.

### Enum Mirrors
TypeScript-typed mirrors of DB enum values live in `src/lib/constants/enums.ts`. Use these in all service comparisons, query filters, and UI conditionals. Never write raw string literals like `team.adminStatus === 'pending_review'` — always use the constant (`TEAM_ADMIN_STATUS.PENDING_REVIEW`).

---

## Error Handling Patterns

1. **API routes** return appropriate HTTP status codes with `{ message: string }` JSON bodies. They catch errors from services and translate them to HTTP responses. Status codes: 400 = bad input, 401 = unauthenticated, 403 = forbidden, 404 = not found, 409 = conflict/already-exists, 410 = gone/expired, 500 = server error.
2. **Service functions** throw `new Error(ERR.CODE)` using constants from `src/lib/constants/error-codes.ts`. They never import HTTP-specific constructs.
3. **Client-side error handling** uses toast notifications for transient errors (save failed, API timeout) and inline error states for persistent issues (form validation, empty states).
4. **Auth errors are handled globally.** If any API call returns 401, redirect to login. Preserve the return URL so the user lands back where they were after re-authentication.
5. **Never expose raw errors to users.** Wrap failures in user-friendly messages. Log the raw error server-side with full context.

---

## Service Logging Patterns

- **Module-level `APP_URL` constant.** Every service that builds email links declares `const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''` at module scope with a `console.warn` if unset. Never inline `process.env.NEXT_PUBLIC_APP_URL ?? ''` at call sites.
- **Entry logs for all service functions.** Every exported service function logs `console.log('[service-name] functionName:', { key params })` as the first statement. Read-only functions are included.
- **Email catch blocks must log.** Email sends are wrapped in `try/catch` so failures cannot roll back committed DB state. The catch block must `console.error('[service-name] functionName: email send failed:', err)` — empty catch blocks are forbidden.
- **Early returns inside try blocks must log.** If a function returns early inside a try block (e.g., missing row post-update), use `console.warn` with context before returning.

---

*This document defines how we write code. It does not define what we build (see PRDs) or how we organize work (see `005-development-workflow.md`).*
