/**
 * Typed string constants mirroring DB enum values.
 * These never diverge from the schema — they are the same string literals
 * the pgEnum columns store. Use these in service comparisons, query filters,
 * and anywhere you'd otherwise write a raw string like 'draft' or 'approved'.
 */

export const HACKATHON_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ACTIVE: 'active',
  JUDGING: 'judging',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;

export const PHASE_TYPE = {
  REGISTRATION: 'registration',
  SUBMISSION: 'submission',
  SCREENING: 'screening',
  JUDGING: 'judging',
  RESULTS: 'results',
} as const;

export const PHASE_STATUS = {
  UPCOMING: 'upcoming',
  ACTIVE: 'active',
  COMPLETED: 'completed',
} as const;

export const HACKATHON_VISIBILITY = {
  PUBLIC: 'public',
  ORG_ONLY: 'org_only',
  INVITE_ONLY: 'invite_only',
} as const;

export const TEMPLATE_TYPE = {
  IDEA_SPRINT: 'idea_sprint',
  BUILD_AND_SHIP: 'build_and_ship',
  INNOVATION_PIPELINE: 'innovation_pipeline',
  OPEN_CHALLENGE: 'open_challenge',
} as const;

export const TEAM_ADMIN_STATUS = {
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export const JOIN_REQUEST_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
} as const;

export const TEAM_MEMBER_ROLE = {
  LEAD: 'lead',
  MEMBER: 'member',
} as const;

export const ORG_ROLE = {
  ADMIN: 'org_admin',
  MEMBER: 'member',
} as const;

export const PLATFORM_ROLE = {
  USER: 'user',
  SUPER_ADMIN: 'super_admin',
} as const;

export const JOIN_ENTRY_POINT = {
  BROWSE: 'browse',
  LINK: 'link',
  PARTICIPANT_BROWSE: 'participant_browse',
} as const;
