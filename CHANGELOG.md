# HackForge — Changelog

All notable changes to this project will be documented in this file.

---

## [Unreleased]

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
