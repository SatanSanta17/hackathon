import { pgEnum } from 'drizzle-orm/pg-core';

// Phase 1 enums
export const platformRoleEnum = pgEnum('platform_role', ['user', 'super_admin']);
export const orgRoleEnum = pgEnum('org_role', ['org_admin', 'member']);

// Phase 2 enums
export const hackathonStatusEnum = pgEnum('hackathon_status', [
  'draft',
  'published',
  'active',
  'judging',
  'completed',
  'archived',
]);

export const templateTypeEnum = pgEnum('template_type', [
  'idea_sprint',
  'build_and_ship',
  'innovation_pipeline',
  'open_challenge',
]);

export const visibilityEnum = pgEnum('visibility', [
  'public',
  'org_only',
  'invite_only',
]);

export const phaseTypeEnum = pgEnum('phase_type', [
  'registration',
  'submission',
  'screening',
  'judging',
  'results',
]);

export const phaseStatusEnum = pgEnum('phase_status', [
  'upcoming',
  'active',
  'completed',
]);

// Phase 3 enums
export const teamRoleEnum = pgEnum('team_role', ['lead', 'member']);

export const teamAdminStatusEnum = pgEnum('team_admin_status', [
  'pending_review',
  'approved',
  'rejected',
]);

export const joinRequestStatusEnum = pgEnum('join_request_status', [
  'pending',
  'accepted',
  'rejected',
]);
