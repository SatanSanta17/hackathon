import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { hackathons, phases } from '@/db/schema';
import type { Hackathon, Phase } from '@/db/schema';
import { HACKATHON_STATUS, PHASE_STATUS, PHASE_TYPE } from '@/lib/constants/enums';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of a status resolution check */
export interface StatusResolution {
  hackathonChanged: boolean;
  newHackathonStatus?: Hackathon['status'];
  phaseChanges: Array<{ phaseId: string; newStatus: Phase['status'] }>;
}

// ---------------------------------------------------------------------------
// Core: Resolve hackathon + phase statuses based on current time
// ---------------------------------------------------------------------------

/**
 * Compares a hackathon's phase dates against the current time and determines
 * if any status transitions are due. Does NOT write to the database — returns
 * what needs to change so the caller can decide when to persist.
 *
 * Rules:
 * 1. Phase-level:
 *    - If now >= phase.start_date AND now < phase.end_date AND phase is 'upcoming' → 'active'.
 *    - If now >= phase.end_date AND phase is 'upcoming' → 'completed' (missed entirely).
 *    - If now >= phase.end_date AND phase is 'active' → 'completed'.
 * 2. Hackathon-level:
 *    - 'published' → 'active': when the first phase's start_date has passed.
 *    - 'active' → 'judging': when a judging phase exists and its start_date has passed.
 *    - 'judging' → 'completed': when the last phase's end_date has passed.
 * 3. 'draft' → 'published' is NEVER automatic (manual admin action only).
 * 4. 'completed' → 'archived' is NEVER automatic (manual admin action only).
 */
export function resolveStatuses(
  hackathon: Hackathon,
  hackathonPhases: Phase[],
  now: Date = new Date(),
): StatusResolution {
  const result: StatusResolution = {
    hackathonChanged: false,
    phaseChanges: [],
  };

  // Skip statuses that don't auto-transition
  if (
    hackathon.status === HACKATHON_STATUS.DRAFT ||
    hackathon.status === HACKATHON_STATUS.COMPLETED ||
    hackathon.status === HACKATHON_STATUS.ARCHIVED
  ) {
    return result;
  }

  // Sort phases by order for reliable processing
  const sortedPhases = [...hackathonPhases].sort((a, b) => a.order - b.order);

  // --- Phase-level transitions ---
  for (const phase of sortedPhases) {
    if (!phase.startDate || !phase.endDate) continue;

    const start = new Date(phase.startDate);
    const end = new Date(phase.endDate);

    if (phase.status === PHASE_STATUS.UPCOMING && now >= start && now < end) {
      result.phaseChanges.push({ phaseId: phase.id, newStatus: PHASE_STATUS.ACTIVE });
    } else if (phase.status === PHASE_STATUS.UPCOMING && now >= end) {
      // Phase was missed entirely (start and end both passed while 'upcoming')
      result.phaseChanges.push({ phaseId: phase.id, newStatus: PHASE_STATUS.COMPLETED });
    } else if (phase.status === PHASE_STATUS.ACTIVE && now >= end) {
      result.phaseChanges.push({ phaseId: phase.id, newStatus: PHASE_STATUS.COMPLETED });
    }
  }

  // --- Hackathon-level transitions ---
  // Apply phase changes in-memory to evaluate hackathon status
  const effectivePhases = sortedPhases.map((p) => {
    const change = result.phaseChanges.find((c) => c.phaseId === p.id);
    return change ? { ...p, status: change.newStatus } : p;
  });

  const firstPhase = effectivePhases[0];
  const lastPhase = effectivePhases[effectivePhases.length - 1];

  if (hackathon.status === HACKATHON_STATUS.PUBLISHED && firstPhase?.startDate) {
    // published → active: first phase has started
    if (now >= new Date(firstPhase.startDate)) {
      result.hackathonChanged = true;
      result.newHackathonStatus = HACKATHON_STATUS.ACTIVE;
    }
  } else if (hackathon.status === HACKATHON_STATUS.ACTIVE) {
    // active → judging: look for a judging phase whose start_date has passed
    const judgingPhase = effectivePhases.find((p) => p.type === PHASE_TYPE.JUDGING);
    if (judgingPhase?.startDate && now >= new Date(judgingPhase.startDate)) {
      result.hackathonChanged = true;
      result.newHackathonStatus = HACKATHON_STATUS.JUDGING;
    }
  } else if (hackathon.status === HACKATHON_STATUS.JUDGING && lastPhase?.endDate) {
    // judging → completed: last phase has ended
    if (now >= new Date(lastPhase.endDate)) {
      result.hackathonChanged = true;
      result.newHackathonStatus = HACKATHON_STATUS.COMPLETED;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Apply: Persist resolved status changes to the database
// ---------------------------------------------------------------------------

/**
 * Runs resolveStatuses() and writes any changes to the database.
 * Returns the (possibly updated) hackathon status and whether phases changed.
 *
 * Call this from getHackathonBySlug, getHackathonById, and
 * getHackathonsByOrgId before returning results.
 */
export async function applyStatusResolution(
  hackathon: Hackathon,
  hackathonPhases: Phase[],
): Promise<{ hackathonStatus: Hackathon['status']; phasesChanged: boolean }> {
  const resolution = resolveStatuses(hackathon, hackathonPhases);

  let phasesChanged = false;

  // Apply phase changes
  if (resolution.phaseChanges.length > 0) {
    phasesChanged = true;
    for (const change of resolution.phaseChanges) {
      await db
        .update(phases)
        .set({ status: change.newStatus, updatedAt: new Date() })
        .where(eq(phases.id, change.phaseId));
    }
    console.log('[hackathon-lifecycle] Phase statuses updated:', resolution.phaseChanges);
  }

  // Apply hackathon status change
  if (resolution.hackathonChanged && resolution.newHackathonStatus) {
    await db
      .update(hackathons)
      .set({ status: resolution.newHackathonStatus, updatedAt: new Date() })
      .where(eq(hackathons.id, hackathon.id));

    console.log('[hackathon-lifecycle] Hackathon status updated:', {
      id: hackathon.id,
      from: hackathon.status,
      to: resolution.newHackathonStatus,
    });

    return { hackathonStatus: resolution.newHackathonStatus, phasesChanged };
  }

  return { hackathonStatus: hackathon.status, phasesChanged };
}
