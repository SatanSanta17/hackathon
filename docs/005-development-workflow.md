# HackForge — Development Workflow

**Document ID:** WKFL-005  
**Date:** April 15, 2026  
**Status:** Active  
**Update Frequency:** Rarely (stable process)

---

## Development Process

Every feature follows this sequence. No step is skipped.

1. **Understand the purpose** — why does this matter to the user?
2. **Write the PRD** in `docs/<number>-<feature-name>/prd.md`
3. **Get explicit approval** on the PRD
4. **Write the TRD** in `docs/<number>-<feature-name>/trd.md` — never before PRD approval
5. **Implement** one part at a time in small, pushable increments
6. **Verify** before every push (see Quality Gates below)
7. **Update** `docs/004-architecture.md` and `CHANGELOG.md` after each part completes

**Trivial fixes** (typos, CSS tweaks, one-line bugs) may skip the PRD/TRD but still require explicit approval before any code is changed. Never change code silently.

---

## Document Structure

- **Master PRD** (`docs/master-prd/prd.md`) defines full product scope across numbered sections — this is the HackForge_Master_PRD_v1.0.docx we already created.
- **Section PRDs** live in `docs/<number>-<name>/prd.md` with co-located `trd.md`.
- **PRD contains:** purpose, user story, requirements per part (P1.R1, P1.R2...), acceptance criteria (checkboxes per part), and a backlog section. No technical details — those go in the TRD.
- **TRD mirrors PRD parts** — same part numbers, same boundaries. Each part includes: database models, API endpoints, frontend pages/components, files changed, and implementation increments. The TRD answers "how" for everything the PRD says "what."
- **Write TRD parts one at a time, but reference the entire PRD.** Each TRD part must account for forward compatibility — data structures and interfaces should carry the shape that later parts will need, even if unused until then.
- **Parts break into increments.** An increment is a self-contained, verifiable unit of work. A PR is the smallest pushable unit of code.

---

## Quality Gates

### Before Every Push

1. **Code quality** — read every modified file for syntax errors, unused imports, broken references
2. **PRD compliance** — confirm implementation covers each requirement
3. **No regressions** — trace existing flows through modified files
4. **Documentation consistency** — `docs/004-architecture.md` matches the code

### End-of-Part Audit

Run after the last increment of every TRD part:

1. **SRP violations** — each file, component, and function does one thing
2. **DRY violations** — shared patterns extracted, no duplication
3. **Design token adherence** — no hardcoded colours, sizes, or spacing; use Tailwind tokens or CSS custom properties
4. **Logging** — all API routes and services log entry, exit, and errors
5. **Dead code** — no unused imports, variables, or files remain
6. **Convention compliance** — naming, exports, import order, TypeScript strictness (see `003-coding-conventions.md`)
7. **Multi-tenant scoping** — every query is scoped to `org_id`; no data leaks between orgs

This audit produces **fixes**, not a report.

### After Each TRD Part Completes

1. Update `docs/004-architecture.md` if file structure, routes, services, tables, or env vars changed
2. Update `CHANGELOG.md` with what the part delivered
3. Verify all file references in documentation still exist
4. Test the flows affected by the part
5. If modifying the database schema, regenerate Drizzle migrations and verify they apply cleanly

### End-of-PRD Audit

Run after the final part of every PRD completes:

1. Run the full end-of-part audit checklist across **all files** touched by the PRD
2. Verify `docs/004-architecture.md` file map is complete and accurate — every file, directory, route, and doc folder that exists in the codebase must be reflected
3. Verify `CHANGELOG.md` has entries for every completed part
4. Run `npx tsc --noEmit` for a final type check
5. This audit produces **fixes and documentation updates**, not a report

### Critical Rule

`docs/004-architecture.md` reflects what **exists** in the codebase — never pre-fill with planned-but-unbuilt structures.

---

## Increment Workflow (Day-to-Day)

```
1. Pick the next task from the current phase in 002-v1-development-phases.md
2. Read relevant existing files (don't assume from memory)
3. Implement the change
4. Self-review: re-read every file you modified
5. Run type check: npx tsc --noEmit
6. Test the affected flow manually
7. Commit with a descriptive message
8. Mark the task as done in your tracking
9. If this was the last task in a part → run end-of-part audit
```

---

## Commit Message Convention

```
<type>(<scope>): <short description>

<optional body with context>
```

**Types:** `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `test`

**Scope:** The module or feature area (e.g., `auth`, `hackathon`, `judging`, `submission`, `ui`)

**Examples:**
```
feat(auth): add email/password signup with Zod validation
feat(hackathon): implement creation wizard with 4 templates
fix(submission): enforce deadline lockout on form submit
refactor(services): extract judging logic into evaluation-service
docs(architecture): update file map after Phase 2 completion
chore(deps): update drizzle-orm to 0.35.x
```

---

## Git Workflow

- **Main branch:** `main` — always deployable
- **Feature branches:** `phase-{N}/{feature-name}` (e.g., `phase-1/auth`, `phase-2/hackathon-wizard`)
- **Commit frequently.** Small, focused commits. Each commit should be independently understandable.
- **No force pushes to main.**
- **Merge strategy:** Squash merge feature branches into main for a clean history.

---

## Daily Standup Template

Use this for personal accountability (even as a solo dev):

```
Date: ____
Yesterday: What I completed
Today: What I'm building
Blockers: Anything stopping me
Mood: 🟢 On track | 🟡 Slight delay | 🔴 Behind
```

---

*This document defines how we organize work. It does not define how we write code (see `003-coding-conventions.md`) or what we build (see PRDs).*
