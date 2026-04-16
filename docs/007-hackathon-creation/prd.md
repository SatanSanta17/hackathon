# PRD — Phase 2: Hackathon Creation + Landing Page

**Document ID:** PRD-007  
**Date:** April 16, 2026  
**Author:** Burhanuddin C.  
**Status:** Draft — Awaiting Approval  
**References:** `docs/002-v1-development-phases.md`, `docs/004-architecture.md`, `docs/006-foundation-auth/prd.md`

---

## Purpose

Phase 2 gives HackForge its core identity — the ability to create, configure, and publish hackathons. An org admin selects a template, walks through a multi-step wizard to fill in details (tracks, timeline, prizes, rules), and publishes the hackathon. Once published, a polished public landing page goes live at `/hackathons/[slug]` — the page participants share, bookmark, and register from.

This phase also introduces the StorageProvider interface (pulled forward from Phase 4) to support cover image uploads, and a database-driven template system that seeds 4 hackathon formats but is designed to support custom templates in future versions.

By the end of Phase 2, HackForge transforms from an org management tool into a hackathon platform.

---

## Key Decisions (Agreed Pre-PRD)

These decisions were discussed and locked before writing this PRD:

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **StorageProvider pulled forward to Phase 2** | Cover image upload is part of hackathon creation. Building the interface now means Phase 4 (submissions) reuses it without rework. |
| 2 | **Tiptap for rich text editing** | Rules and FAQs need WYSIWYG editing. Non-technical admins creating hackathons shouldn't need to know markdown. |
| 3 | **Database-driven templates** | Templates stored as DB records (not hardcoded). Increases maintainability and supports custom templates in future versions. Seeded with 4 defaults on first run. |
| 4 | **Global slug namespace** (`/hackathons/[slug]`) | Clean, shareable URLs. Slugs are globally unique across all orgs. On collision, the system auto-appends a numeric suffix with a note to the admin. |
| 5 | **Auto-save draft to DB per wizard step** | Hackathon record created at step 1 in `draft` status. Each step transition saves to DB. Users can close the browser and resume later. Abandoned drafts are left for manual cleanup in V1. |
| 6 | **Single filterable hackathon list** | Hackathon management page is a single list with search bar, status filter, and date filter. No tabs. Wizard lives at `/create` sub-route. |
| 7 | **Hybrid auto lifecycle transitions** | Check-on-access (instant correctness on page load) + daily Vercel Cron (safety net for unvisited hackathons). Manual transition only for draft → published. |
| 8 | **Client-side cover image cropping** | 16:9 crop enforced before upload. Client-side canvas processing, no server-side image work. Ensures consistent landing page hero images. |
| 9 | **Last-write-wins concurrent editing** | Multiple admins can edit simultaneously. No locking. Stale-data warning shown but doesn't block saves. Real-time sync deferred to V2. |
| 10 | **Social sharing on landing page** | URL-based share buttons (Copy Link, X, LinkedIn, WhatsApp) in the hero section. No third-party SDKs. |

---

## User Stories

1. **As an org admin**, I want to create a hackathon by choosing a template so that I get a pre-configured phase structure without manual setup.
2. **As an org admin**, I want to walk through a step-by-step wizard so that I can configure every aspect of my hackathon (info, tracks, timeline, teams, prizes, rules) without feeling overwhelmed.
3. **As an org admin**, I want my wizard progress saved automatically so that I can close the browser and resume later without losing work.
4. **As an org admin**, I want to upload a cover image for my hackathon so that the landing page has a strong visual identity.
5. **As an org admin**, I want to write rules and FAQs with a rich text editor so that I can format content with headings, lists, and links without knowing markdown.
6. **As an org admin**, I want to save my hackathon as a draft and publish it when ready so that I can iterate on the content before it goes live.
7. **As an org admin**, I want to edit a hackathon's settings after creation so that I can fix mistakes or update details.
8. **As an org admin**, I want to see all my organization's hackathons in a filterable list so that I can quickly find and manage them.
9. **As an org admin**, I want to archive a completed hackathon so that it no longer appears in the active list but its data is preserved.
10. **As a visitor (no login required)**, I want to view a hackathon's public landing page so that I can learn about the event, see tracks, prizes, timeline, and rules before deciding to register.
11. **As a visitor**, I want the landing page to have proper SEO meta tags and Open Graph data so that sharing the link on Slack, LinkedIn, or Twitter shows a rich preview.
12. **As an org member**, I want to view hackathons in my org's list so that I can see what's happening, even if I can't create or edit them.

---

## Parts

Phase 2 is divided into 4 parts. Each part is a self-contained, shippable unit.

---

### Part 1: Database Schema + StorageProvider + Template System

**What:** Define all Phase 2 database tables and enums, build the StorageProvider interface with a Supabase adapter for file uploads, and implement the database-driven hackathon template system with 4 seeded templates.

**Requirements:**

| ID | Requirement |
|----|-------------|
| P1.R1 | Define the following Postgres enums in the enums file: `hackathon_status` (draft, published, active, judging, completed, archived), `template_type` (idea_sprint, build_and_ship, innovation_pipeline, open_challenge), `visibility` (public, org_only, invite_only), `phase_type` (registration, submission, screening, judging, results), `phase_status` (upcoming, active, completed) |
| P1.R2 | Define the `hackathons` table: id (uuid PK), org_id (FK → organizations.id, NOT NULL), title (text, NOT NULL), slug (text, UNIQUE, NOT NULL), description (text, nullable), cover_image_key (text, nullable — StorageProvider key), status (hackathon_status, NOT NULL, default 'draft'), template_type (template_type, NOT NULL), visibility (visibility, NOT NULL, default 'public'), team_min_size (integer, default 1), team_max_size (integer, default 5), allow_individual (boolean, default true), rules_html (text, nullable — Tiptap HTML output), faqs_html (text, nullable — Tiptap HTML output), created_by (FK → users.id, NOT NULL), created_at, updated_at, deleted_at (nullable) |
| P1.R3 | Define the `phases` table: id (uuid PK), hackathon_id (FK → hackathons.id, NOT NULL), name (text, NOT NULL), type (phase_type, NOT NULL), order (integer, NOT NULL), start_date (timestamptz, nullable), end_date (timestamptz, nullable), config (jsonb, nullable — phase-specific settings), status (phase_status, NOT NULL, default 'upcoming'), created_at, updated_at |
| P1.R4 | Define the `tracks` table: id (uuid PK), hackathon_id (FK → hackathons.id, NOT NULL), name (text, NOT NULL), description (text, nullable), resources_url (text, nullable), order (integer, NOT NULL, default 0), created_at, updated_at |
| P1.R5 | Define the `prizes` table: id (uuid PK), hackathon_id (FK → hackathons.id, NOT NULL), name (text, NOT NULL), description (text, nullable), rank (integer, NOT NULL), image_key (text, nullable — StorageProvider key), created_at, updated_at |
| P1.R6 | Define the `hackathon_templates` table: id (uuid PK), name (text, NOT NULL), slug (text, UNIQUE, NOT NULL), description (text, NOT NULL), template_type (template_type, NOT NULL, UNIQUE), default_phases (jsonb, NOT NULL — array of {name, type, order, config}), icon (text, nullable — icon identifier for UI), is_active (boolean, default true), created_at |
| P1.R7 | Generate and run the Drizzle migration for all new tables and enums |
| P1.R8 | Define the `StorageProvider` interface in `lib/storage/types.ts`: `upload(file, path) → {url, key}`, `getSignedUrl(key, expiresIn?) → url`, `delete(key) → void`, `list(prefix) → StorageObject[]` |
| P1.R9 | Implement `SupabaseStorageProvider` in `lib/storage/adapters/supabase-adapter.ts` that implements the StorageProvider interface using Supabase Storage. Include file type validation (images only for Phase 2: PNG, JPG, WEBP, max 5MB) and error handling. |
| P1.R10 | Create a `getStorageProvider()` factory in `lib/storage/index.ts` that returns the configured provider (Supabase for now, swappable later) |
| P1.R11 | Write a seed script or migration that inserts the 4 default templates into `hackathon_templates`: **Idea Sprint** (Registration → Idea Submission → Screening → Winners), **Build & Ship** (Registration → Team Formation → Building → Submission → Judging → Winners), **Innovation Pipeline** (Registration → Idea Submission → Screening → Prototype → Demo Day → Final Judging → Winners), **Open Challenge** (Registration → Submission → Community Voting → Expert Judging → Winners). Each template includes a description explaining when to use it, and a `default_phases` JSON array defining the phase sequence with types and default config. |
| P1.R12 | Create a `hackathon-service.ts` in `lib/services/` with foundational methods: `createHackathon()`, `getHackathonBySlug()`, `getHackathonsByOrgId()`, `updateHackathon()`, `getTemplates()`. All queries scoped to org_id where applicable. |
| P1.R13 | Implement slug generation for hackathons: auto-generate from title, enforce global uniqueness. On collision, auto-append a numeric suffix (e.g., `innovation-2026-2`) and notify the admin with a message: "A hackathon with this slug already exists. We've modified yours to [new-slug]. You can edit it manually." |
| P1.R14 | Create Zod validation schemas for hackathon creation and update operations in `lib/validations/hackathon.ts` |

**Acceptance Criteria:**

- [ ] All 5 new enums exist in the database after migration
- [ ] All 5 new tables (`hackathons`, `phases`, `tracks`, `prizes`, `hackathon_templates`) exist with correct columns and constraints
- [ ] Hackathon slugs are globally unique (enforced at DB level)
- [ ] StorageProvider interface is defined with all 4 methods
- [ ] SupabaseStorageProvider successfully uploads an image and returns a key + URL
- [ ] File type validation rejects non-image files and files over 5MB
- [ ] `getStorageProvider()` factory returns a working provider instance
- [ ] 4 default templates are seeded in the `hackathon_templates` table
- [ ] Each template has a correct `default_phases` JSON structure
- [ ] `hackathon-service.ts` methods work for CRUD operations
- [ ] Slug collision appends a numeric suffix and the original slug remains taken
- [ ] Zod schemas validate hackathon input correctly (reject invalid data, accept valid data)

---

### Part 2: Hackathon Creation Wizard

**What:** Build the 8-step multi-step creation wizard that org admins use to configure and publish a hackathon. Each step auto-saves to the database. The wizard is accessible at `/dashboard/[orgSlug]/hackathons/create`.

**Requirements:**

| ID | Requirement |
|----|-------------|
| P2.R1 | Build the wizard shell: a persistent step indicator (sidebar or top bar) showing all 8 steps with current/completed/upcoming states. Navigation allows clicking back to completed steps. Forward navigation requires the current step to be valid. |
| P2.R2 | **Step 1 — Choose Template:** Display the 4 templates (from `hackathon_templates` table) as selectable cards with name, description, and icon. Selecting a template creates a new hackathon record in `draft` status with the template's default phases cloned into the `phases` table. This is the point where the DB record is created. |
| P2.R3 | **Step 2 — Basic Info:** Title (required), description (textarea, optional), cover image upload (drag-and-drop + click, uses StorageProvider, optional) with a **client-side image cropper** (16:9 aspect ratio enforced for cover images). After file selection, a crop modal opens where the admin adjusts the crop region. The cropped image is generated as a canvas blob on the client and uploaded via StorageProvider — no server-side image processing. Slug is auto-generated from title, shown as a preview (`hackforge.com/hackathons/[slug]`), and editable. If the slug collides, auto-append suffix with an inline message. |
| P2.R4 | **Step 3 — Tracks/Themes:** Add one or more tracks. Each track has a name (required), description (optional), and resources URL (optional). Tracks can be reordered via drag-and-drop or up/down buttons. At least one track is required. Admin can add, edit, and remove tracks. |
| P2.R5 | **Step 4 — Timeline:** Display the phases inherited from the template (name, type). Admin sets start_date and end_date for each phase using date-time pickers. Phases are displayed in order. Validation: no overlapping dates, end_date must be after start_date, phases should be in chronological order. Admin can rename phases but cannot add/remove/reorder them (template-defined structure). |
| P2.R6 | **Step 5 — Team Rules:** Configure team_min_size (default from template or 1), team_max_size (default from template or 5), allow_individual (toggle, default true), visibility (dropdown: public, org_only, invite_only — only `public` functional in V1, others shown as "coming soon" with disabled state). |
| P2.R7 | **Step 6 — Prizes:** Add prizes with name (required), description (optional), rank (auto-assigned based on order, editable), and image upload (optional, uses StorageProvider). Prizes can be reordered. Common presets available: "1st Place", "2nd Place", "3rd Place", "Best Innovation", "People's Choice". Prizes are optional — a hackathon can have zero prizes. |
| P2.R8 | **Step 7 — Rules & FAQs:** Two Tiptap rich text editors — one for "Rules" and one for "FAQs". Both optional. HTML output stored in `hackathons.rules_html` and `hackathons.faqs_html`. Editor supports: headings (H2, H3), bold, italic, bullet lists, numbered lists, links. |
| P2.R9 | **Step 8 — Review:** Read-only summary of all configured details across all steps. Each section has an "Edit" link that navigates back to the relevant step. Two action buttons: "Save as Draft" (saves current state, returns to hackathon list) and "Publish" (sets status to `published`, redirects to the public landing page). Publish requires: title, at least one track, and all phase dates set. |
| P2.R10 | **Auto-save:** On every step transition (clicking Next or navigating to another step), the current step's data is saved to the database. Show a subtle "Saving..." → "Saved" indicator. If save fails, show an error toast and prevent navigation. |
| P2.R15 | **Mid-step Save Draft button:** A persistent "Save Draft" button is visible in the wizard footer on every step (alongside Back/Next). Clicking it saves the current step's form data to the database without navigating away. Uses the same save logic as auto-save. After saving, shows a confirmation toast ("Draft saved"). This allows admins to save progress mid-step without needing to advance to the next step. |
| P2.R11 | **Resume draft:** When navigating to `/hackathons/create` and the admin has an existing draft hackathon (created but not published), offer to resume it or start fresh. If resuming, load the draft data and navigate to the furthest completed step. |
| P2.R12 | **Permissions:** Only `org_admin` can access the creation wizard. `member` role sees the hackathon list but cannot create. Requires verified email. |
| P2.R13 | Build API routes for the wizard: `POST /api/hackathons` (create draft from template), `PATCH /api/hackathons/[hackathonId]` (update hackathon fields), `POST /api/hackathons/[hackathonId]/tracks` (add track), `PATCH /api/hackathons/[hackathonId]/tracks/[trackId]` (edit track), `DELETE /api/hackathons/[hackathonId]/tracks/[trackId]` (remove track), `PATCH /api/hackathons/[hackathonId]/phases/[phaseId]` (update phase dates/name), `POST /api/hackathons/[hackathonId]/prizes` (add prize), `PATCH /api/hackathons/[hackathonId]/prizes/[prizeId]` (edit prize), `DELETE /api/hackathons/[hackathonId]/prizes/[prizeId]` (remove prize), `POST /api/hackathons/[hackathonId]/publish` (publish hackathon), `POST /api/upload/image` (upload image via StorageProvider). |
| P2.R14 | All API routes verify org membership, org_admin role, and hackathon ownership (hackathon.org_id matches the authenticated user's org). |
| P2.R16 | **Last-write-wins concurrent editing:** Multiple org admins can open and edit the same hackathon simultaneously. No locking or conflict resolution — the last save overwrites previous changes. When loading the wizard for an existing hackathon, if `updated_at` changes after the initial load (detected on save), show a non-blocking warning: "This hackathon was recently edited. Your changes will overwrite the latest version." This is an informational notice, not a blocker — the admin can proceed. |

**Acceptance Criteria:**

- [ ] Wizard renders with 8 steps and a step indicator showing progress
- [ ] Step 1 displays 4 template cards from the database; selecting one creates a draft hackathon
- [ ] Step 2 allows setting title, description, cover image upload, and slug editing
- [ ] Slug collision auto-appends suffix with an inline notification message
- [ ] Cover image upload opens a crop modal with 16:9 aspect ratio; cropped image uploads successfully and displays a preview
- [ ] Step 3 allows adding, editing, removing, and reordering tracks
- [ ] Step 4 displays template phases with date pickers; validates chronological order
- [ ] Step 5 configures team size, individual toggle, and visibility
- [ ] Step 6 allows adding, editing, removing, and reordering prizes with optional image upload
- [ ] Step 7 provides two Tiptap editors for rules and FAQs with formatting support
- [ ] Step 8 shows a complete review with edit links back to each step
- [ ] "Save as Draft" saves and returns to hackathon list
- [ ] "Publish" validates required fields, sets status to published, and redirects to landing page
- [ ] Auto-save triggers on every step transition with a visual indicator
- [ ] "Save Draft" button on every step saves current data without advancing; shows confirmation toast
- [ ] Save failure shows an error toast and blocks navigation
- [ ] Resuming a draft loads all previously saved data and navigates to the correct step
- [ ] Non-org_admin users cannot access the wizard (redirected or shown forbidden state)
- [ ] Unverified users cannot access the wizard
- [ ] All API routes enforce org membership and role checks
- [ ] Two admins can edit the same hackathon; last save wins without errors
- [ ] Stale-data warning displays when the hackathon was modified after the wizard loaded

---

### Part 3: Hackathon List + Management

**What:** Build the hackathon management page at `/dashboard/[orgSlug]/hackathons` — a filterable, searchable list of all hackathons in the org. Includes lifecycle management (draft → published → active → judging → completed → archived).

**Requirements:**

| ID | Requirement |
|----|-------------|
| P3.R1 | Replace the existing placeholder at `/dashboard/[orgSlug]/hackathons/page.tsx` with the hackathon list view. Display hackathons as cards or rows showing: title, status badge, template type, cover image thumbnail (or placeholder), dates (registration start → end), participant count (placeholder "0" for now), and created date. |
| P3.R2 | **Search bar:** Filter hackathons by title (client-side filter for V1, since hackathon counts per org will be small). |
| P3.R3 | **Status filter:** Dropdown or pill selector to filter by status: All, Draft, Published, Active, Judging, Completed, Archived. Default: All (excluding archived — archived shown only when explicitly filtered). |
| P3.R4 | **Date filter:** Filter by date range (hackathons whose phases overlap with the selected range). Simple implementation: "Created after" and "Created before" date pickers. |
| P3.R5 | **"Create Hackathon" button:** Prominent CTA that navigates to `/dashboard/[orgSlug]/hackathons/create`. Only visible to `org_admin`. |
| P3.R6 | **Hackathon actions:** Each hackathon card/row has a context menu (three-dot menu or action buttons) with: Edit (opens wizard with existing data), View Landing Page (opens public URL in new tab), Publish (if draft), Archive (if completed), Delete Draft (if draft — soft delete). Actions are role-gated to `org_admin`. |
| P3.R7 | **Lifecycle transitions:** Enforce valid status transitions: draft → published, published → active, active → judging, judging → completed, completed → archived. Invalid transitions are prevented in the UI and API. Admin can manually trigger any valid forward transition via a button. |
| P3.R13 | **Automated status transitions (hybrid approach):** Two mechanisms work together: **(a) Check-on-access** — every time a hackathon is loaded (landing page, admin dashboard, API call), the service compares the current date against phase dates and updates the hackathon/phase status if a transition is due (e.g., if the last phase's `end_date` has passed and status is `active`, transition to `judging`; if judging phase `end_date` has passed, transition to `completed`). Phase-level: when a phase's `end_date` passes, its `phase_status` flips from `active` to `completed` and the next phase becomes `active`. This ensures the status is always correct when someone is looking at it. **(b) Daily cron job** — a Vercel Cron function runs once daily as a safety net, querying all hackathons with stale statuses (phase dates have passed but status not yet updated) and applying the correct transitions. This catches hackathons nobody has visited. The `draft → published` transition is always manual (intentional admin action). |
| P3.R8 | **Hackathon settings/edit page:** When clicking "Edit" on an existing hackathon, open the wizard pre-filled with the existing data. All steps are accessible. Changes auto-save on step transition (same behavior as creation). Published hackathons can still be edited (title, description, tracks, prizes, rules — but template and phase structure cannot change after publish). |
| P3.R9 | **Empty state:** When no hackathons exist, show a friendly empty state with illustration/icon and a "Create your first hackathon" CTA. |
| P3.R10 | **Loading state:** Skeleton cards/rows while hackathon list is loading. |
| P3.R11 | **Permissions:** `org_admin` sees all actions. `member` can view the list and view landing pages but cannot create, edit, publish, archive, or delete. |
| P3.R12 | Update the org dashboard (`/dashboard/[orgSlug]`) stat cards to show real hackathon counts: total hackathons, active hackathons, draft hackathons. Replace the Phase 1 placeholder values. |

**Acceptance Criteria:**

- [ ] Hackathon list page displays all org hackathons with relevant info
- [ ] Search bar filters hackathons by title in real-time
- [ ] Status filter shows only hackathons matching the selected status
- [ ] Archived hackathons are hidden by default, shown when filter is set to "Archived"
- [ ] Date filter narrows results by creation date range
- [ ] "Create Hackathon" button is visible only to org_admin
- [ ] Context menu actions work: Edit, View Landing Page, Publish, Archive, Delete Draft
- [ ] Lifecycle transitions follow the valid sequence; invalid transitions are blocked
- [ ] Editing a published hackathon pre-fills the wizard; template/phase structure is locked
- [ ] Empty state renders when no hackathons exist
- [ ] Loading skeletons display while data is fetching
- [ ] `member` role can view but not modify hackathons
- [ ] Org dashboard stat cards show real hackathon counts
- [ ] Hackathon status auto-updates on page load when phase dates have passed
- [ ] Phase statuses transition correctly (active → completed, next phase → active) based on dates
- [ ] Daily cron job catches stale statuses for unvisited hackathons
- [ ] Manual transitions (draft → published) are unaffected by automation

---

### Part 4: Public Hackathon Landing Page

**What:** Build the public-facing hackathon landing page at `/hackathons/[slug]`. This page is accessible without login, uses the competitive/gaming design aesthetic (dark theme, bold typography, Space Grotesk headings), and serves as the primary entry point for participants.

**Requirements:**

| ID | Requirement |
|----|-------------|
| P4.R1 | Route: `/hackathons/[slug]` under the `(public)` route group. No authentication required. Only hackathons with status `published`, `active`, `judging`, or `completed` are viewable. `draft` and `archived` return 404. |
| P4.R2 | **Hero section:** Full-width section with cover image (or a generated gradient/pattern if no image), hackathon title (large, Space Grotesk), organizer name (org name), status badge, and key dates (registration opens/closes). A prominent "Register Now" CTA button (links to registration — placeholder/disabled for Phase 2, functional in Phase 3). If hackathon is in `completed` status, show "View Results" instead. |
| P4.R3 | **About section:** Hackathon description rendered as styled text. Clean typography with good line height and max-width for readability. |
| P4.R4 | **Tracks/Themes section:** Display all tracks as cards with name, description, and resources link (if provided). If only one track exists, display it as an inline section rather than cards. |
| P4.R5 | **Timeline section:** Visual phase timeline showing all phases in chronological order. Each phase shows: name, type icon, start date, end date, and status (upcoming/active/completed). The current active phase is highlighted. Use a vertical timeline layout on mobile, horizontal on desktop. |
| P4.R6 | **Prizes section:** Display prizes in order of rank. Each prize shows name, description, rank badge (1st, 2nd, 3rd with gold/silver/bronze styling), and image (if uploaded). Skip this section entirely if no prizes are configured. |
| P4.R7 | **Rules section:** Render `rules_html` from the hackathon record. Skip this section if rules are empty. |
| P4.R8 | **FAQs section:** Render `faqs_html` in a collapsible accordion format. Each top-level heading (H2) becomes a collapsible section. Skip this section if FAQs are empty. |
| P4.R9 | **Sticky navigation:** A sticky top bar or floating nav that shows section links (About, Tracks, Timeline, Prizes, Rules, FAQs) for quick scrolling. Only show links for sections that exist. |
| P4.R10 | **SEO and Open Graph:** Set page title (`[Hackathon Title] | HackForge`), meta description (first 160 chars of description), Open Graph tags (title, description, image — cover image or HackForge default), Twitter card tags. Use Next.js `generateMetadata()`. |
| P4.R11 | **Responsive design:** The landing page must be fully responsive. Mobile-first approach for this page. Test breakpoints: mobile (375px), tablet (768px), desktop (1280px). |
| P4.R12 | **Competitive design aesthetic (design-token-driven):** This page uses the participant-facing design tokens established in Phase 1's `globals.css` — dark background, bold accent colors, Space Grotesk for headings, high visual energy. **No hardcoded colors, font sizes, or spacing values in component files.** All visual styling is driven by CSS custom properties. If the existing token set is insufficient (e.g., gradient tokens, gold/silver/bronze accent variants for prizes, timeline-specific colors), new tokens are added to the design token system in `globals.css` — not inlined in components. This ensures every future landing page automatically inherits the same visual system. |
| P4.R13 | **Footer:** Minimal footer with "Powered by HackForge" branding and a link to the HackForge homepage. |
| P4.R14 | **404 handling:** If the slug doesn't match any published/active/judging/completed hackathon, show a styled 404 page: "Hackathon not found" with a link back to the HackForge homepage. |
| P4.R15 | **Social sharing buttons:** A row of share buttons in the hero section (near the CTA or below the title): Copy Link (clipboard API with "Copied!" feedback), Share on X/Twitter (`https://twitter.com/intent/tweet?url=...&text=...`), Share on LinkedIn (`https://www.linkedin.com/sharing/share-offsite/?url=...`), Share on WhatsApp (`https://wa.me/?text=...`). These are URL-based — no third-party SDKs or API integrations needed. Buttons use icons (no text labels) on mobile, icons + labels on desktop. |

**Acceptance Criteria:**

- [ ] Landing page is accessible at `/hackathons/[slug]` without authentication
- [ ] Draft and archived hackathons return 404
- [ ] Hero section displays cover image (or fallback), title, org name, dates, and CTA
- [ ] Register button is present but disabled/placeholder (functional in Phase 3)
- [ ] About section renders the description with clean typography
- [ ] Tracks section shows all tracks as cards (or inline if only one)
- [ ] Timeline section displays phases chronologically with active phase highlighted
- [ ] Prizes section renders prizes with rank styling; section hidden if no prizes
- [ ] Rules section renders rich text HTML; section hidden if empty
- [ ] FAQs section renders as collapsible accordion; section hidden if empty
- [ ] Sticky navigation shows links only for existing sections
- [ ] Open Graph tags render correctly (test with a link preview tool)
- [ ] Page is fully responsive at 375px, 768px, and 1280px breakpoints
- [ ] Page uses the competitive design aesthetic (dark theme, Space Grotesk headings, bold accents)
- [ ] Footer shows "Powered by HackForge"
- [ ] Social sharing buttons render in the hero section (Copy Link, X, LinkedIn, WhatsApp)
- [ ] "Copy Link" copies the URL to clipboard with feedback
- [ ] Share buttons open the correct platform share URL in a new tab
- [ ] Invalid slugs show a styled 404 page

---

## Backlog (Deferred from Phase 2)

These items were discussed and explicitly deferred:

| Item | Reason | Target |
|------|--------|--------|
| `org_only` and `invite_only` visibility enforcement | Requires participant-level org membership checks not yet built | V2 |
| Custom templates (admin creates their own) | V1 ships with 4 fixed templates; custom template builder is V2 | V2 |
| Hackathon cloning (duplicate an existing hackathon) | Useful but not critical for first launch | V2 |
| Landing page theme customization (colors, fonts per hackathon) | All hackathons use the default HackForge competitive theme | V2 |
| Abandoned draft cleanup (auto-delete stale drafts) | Admin manually deletes unwanted drafts in V1 | V2 |
| Real-time collaborative editing (live cursors, conflict resolution) | Last-write-wins is sufficient for V1; real-time sync is V2 | V2 |

---

## Phase 2 Deliverable

> An org admin logs in → navigates to Hackathons → clicks "Create Hackathon" → selects "Build & Ship" template → fills in title "InMobi Innovation Week 2026", description, uploads a cover image → adds 3 tracks (AI/ML, Sustainability, Developer Experience) → sets phase dates → configures team size (2-5 members) → adds prizes (1st, 2nd, 3rd + Best Innovation) → writes rules and FAQs with formatted text → reviews everything → clicks "Publish" → a polished, dark-themed landing page goes live at `/hackathons/inmobi-innovation-week-2026` with hero image, tracks, timeline, prizes, rules, and FAQs. The admin can find and edit this hackathon from the filterable list. Sharing the URL on Slack shows a rich preview with the cover image and description.

---

## Role & Permission Summary (Phase 2)

| Action | org_admin | member | Unauthenticated |
|--------|-----------|--------|-----------------|
| View hackathon list | Yes | Yes (read-only) | No |
| Create hackathon | Yes | No | No |
| Edit hackathon | Yes | No | No |
| Publish/Archive hackathon | Yes | No | No |
| Delete draft hackathon | Yes | No | No |
| View public landing page | Yes | Yes | Yes |

---

## Storage Configuration (Phase 2)

| Setting | Value |
|---------|-------|
| Allowed file types | PNG, JPG, JPEG, WEBP |
| Max file size | 5 MB |
| Storage path pattern | `hackathons/[hackathonId]/cover.[ext]` for cover images, `hackathons/[hackathonId]/prizes/[prizeId].[ext]` for prize images |
| Provider | Supabase Storage (via StorageProvider interface) |
| New env variables | `SUPABASE_STORAGE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (already in `.env.example` from Phase 1) |

---

*This PRD covers Phase 2 only. Technical implementation details will be specified in the TRD (`docs/007-hackathon-creation/trd.md`) after this PRD is approved.*
