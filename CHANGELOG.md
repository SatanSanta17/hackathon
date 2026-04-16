# HackForge — Changelog

All notable changes to this project will be documented in this file.

---

## [Unreleased]

### Phase 1, Part 3: Org Management + App Shell + Admin Panel (April 16, 2026)

#### Added
- Organization service layer: create org, slug uniqueness, membership management, invite flow with SHA-256 token hashing
- Org validation schemas: createOrg, inviteMember, changeMemberRole, removeMember (Zod)
- Org invite email template with role label, expiry text, and CTA button
- API routes: org CRUD (`/api/orgs`), member management (`/api/orgs/[orgId]/members/*`), invite acceptance (`/api/invite/accept`)
- Authorization guards: `requireOrgRole()` (org-level) and `requireSuperAdmin()` (platform-level)
- Admin service: `listOrganizations()` with member count, `listUsers()` for platform overview
- Admin API routes: `/api/admin/orgs`, `/api/admin/users` (super_admin only)
- Dashboard layout: `SessionProvider` + `SidebarProvider` + `VerificationBanner` wrapper
- App sidebar with org-scoped navigation (Dashboard, Hackathons, Members, Settings)
- Top bar with org switcher dropdown, user avatar menu, and mobile sidebar trigger
- Org-scoped layout: server-side org validation, membership check, data fetching for sidebar/topbar
- Dashboard page: org picker (multi-org), auto-redirect (single org), welcome screen (zero orgs)
- Create organization page with auto-slug generation from name
- Members page: table with role badges, invite dialog, change role dialog, remove member confirmation
- Org dashboard page with stat cards (placeholder values for Phase 2)
- Admin panel: tabbed view (Organizations + Users) with data tables, empty states
- Invite acceptance page: handles logged-in/logged-out/unverified states with appropriate flows
- Loading skeletons for dashboard, members, admin, and org picker pages
- Placeholder pages for hackathons (Phase 2) and settings (future)
- `slugify()` utility function
- shadcn/ui components: avatar, badge, dialog, dropdown-menu, select, separator, sheet, sidebar, skeleton, table, tabs, tooltip

### Phase 1, Part 2: Authentication System (April 16, 2026)

#### Added
- NextAuth.js v5 integration with Credentials provider and JWT session strategy
- Auth service: signup with bcrypt hashing, email verification, password reset
- Token service: SHA-256 hashed token generation for email verification and password reset
- Provider-agnostic email service: `EmailService` interface → `ResendEmailAdapter` → `getEmailService()` factory
- Email templates: verification email, password reset email (inline HTML with shared layout helpers)
- Auth validation schemas: signup, login, forgotPassword, resetPassword (Zod)
- Centralized auth constants: token expiry times, password requirements, `AUTH_EXPIRY_LABELS`
- Custom form components: `FormField<T>`, `FormPasswordField<T>`, `FormMessage` (wrapping react-hook-form + shadcn)
- Auth pages: login, signup, check-email, verify-email, forgot-password, reset-password
- Auth API routes: signup, verify-email, resend-verification, forgot-password, reset-password
- Verification banner component for unverified users across dashboard
- Auth layout with centered card design
- NextAuth middleware protecting `/dashboard/*` routes
- Custom JWT/session callbacks extending session with `id`, `platformRole`, `isEmailVerified`
- Second database migration for `platform_role` column on users table

### Phase 1, Part 1: Project Scaffolding + Database Schema (April 16, 2026)

#### Added
- Dual-tone design system: admin mode (light, professional) and competitive mode (dark, neon accents) via CSS custom properties in `globals.css`
- Typography system: Geist Sans (admin) + Space Grotesk (competitive headings) loaded via `next/font/google`
- Drizzle ORM setup with postgres.js driver, connected to Supabase Postgres
- Database schema: `users`, `organizations`, `org_memberships`, `org_invites`, `verification_tokens` tables
- Postgres enums: `platform_role` (user, super_admin), `org_role` (org_admin, member)
- Type inference exports for all schema tables (User, NewUser, Organization, etc.)
- Initial database migration applied
- Sonner toast provider integrated in root layout
- Form validation dependencies: react-hook-form, @hookform/resolvers, zod
- `.env.example` with all required environment variables documented
- Project folder structure with empty directories for future parts
- Phase 1 PRD and TRD Part 1 documentation

#### Changed
- Updated `page.tsx` from Next.js boilerplate to HackForge placeholder using design tokens
- Updated `layout.tsx` with HackForge metadata, font variables, and Toaster provider
- Updated architecture doc (004) folder structure to reflect actual codebase

### Documentation (Pre-Phase 1)
- Created Master PRD (v1.0) covering full product vision, 12 sections, competitive analysis, monetization strategy
- Created Technical Decision Record (TDR-001): architecture, tech stack, ORM, auth, deployment decisions
- Created V1 Development Plan: 6 phases, 20 dev-days, vertical slice approach
- Created Coding Conventions (CONV-003): SOLID principles, naming, TypeScript, Next.js, Drizzle, NextAuth patterns
- Created Architecture document (ARCH-004): system overview, folder structure, data model, env vars
- Created Development Workflow (WKFL-005): PRD/TRD process, quality gates, git workflow
- Created CLAUDE.md session bootstrap
- Created Project Context (CTX-000)
