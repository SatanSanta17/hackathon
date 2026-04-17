/**
 * All error code strings thrown or returned by service functions.
 * API routes catch these and map them to HTTP responses.
 * Use these constants on both the throw side and the catch side to avoid typos.
 */
export const ERR = {
  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  ALREADY_VERIFIED: 'ALREADY_VERIFIED',
  EMAIL_FAILED: 'EMAIL_FAILED',

  // ---------------------------------------------------------------------------
  // Org
  // ---------------------------------------------------------------------------
  SLUG_TAKEN: 'SLUG_TAKEN',
  ALREADY_MEMBER: 'ALREADY_MEMBER',
  INVITE_PENDING: 'INVITE_PENDING',
  ORG_NOT_FOUND: 'ORG_NOT_FOUND',
  MEMBERSHIP_NOT_FOUND: 'MEMBERSHIP_NOT_FOUND',
  LAST_ADMIN: 'LAST_ADMIN',

  // ---------------------------------------------------------------------------
  // Hackathon
  // ---------------------------------------------------------------------------
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  HACKATHON_NOT_FOUND: 'HACKATHON_NOT_FOUND',
  ONLY_DRAFTS_CAN_BE_PUBLISHED: 'ONLY_DRAFTS_CAN_BE_PUBLISHED',
  TITLE_REQUIRED: 'TITLE_REQUIRED',
  AT_LEAST_ONE_TRACK_REQUIRED: 'AT_LEAST_ONE_TRACK_REQUIRED',
  ALL_PHASE_DATES_REQUIRED: 'ALL_PHASE_DATES_REQUIRED',
  ONLY_DRAFTS_CAN_BE_DELETED: 'ONLY_DRAFTS_CAN_BE_DELETED',

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------
  ALREADY_REGISTERED: 'ALREADY_REGISTERED',
  REGISTRATION_NOT_FOUND: 'REGISTRATION_NOT_FOUND',

  // ---------------------------------------------------------------------------
  // Team
  // ---------------------------------------------------------------------------
  TEAM_NOT_FOUND: 'TEAM_NOT_FOUND',
  ALREADY_IN_TEAM: 'ALREADY_IN_TEAM',
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',
  INVITE_CODE_GENERATION_FAILED: 'INVITE_CODE_GENERATION_FAILED',
  JOIN_REQUEST_ALREADY_PENDING: 'JOIN_REQUEST_ALREADY_PENDING',
  REQUEST_NOT_FOUND: 'REQUEST_NOT_FOUND',
  REQUEST_ALREADY_RESOLVED: 'REQUEST_ALREADY_RESOLVED',
  TEAM_FULL: 'TEAM_FULL',
  INVITE_NOT_FOUND: 'INVITE_NOT_FOUND',
  INVITE_ALREADY_USED: 'INVITE_ALREADY_USED',
  INVITE_EXPIRED: 'INVITE_EXPIRED',
  INVITE_EMAIL_MISMATCH: 'INVITE_EMAIL_MISMATCH',

  // ---------------------------------------------------------------------------
  // Team-up
  // ---------------------------------------------------------------------------
  FROM_USER_NOT_REGISTERED: 'FROM_USER_NOT_REGISTERED',
  TO_USER_NOT_REGISTERED: 'TO_USER_NOT_REGISTERED',
  FROM_USER_ALREADY_IN_TEAM: 'FROM_USER_ALREADY_IN_TEAM',
  TO_USER_ALREADY_IN_TEAM: 'TO_USER_ALREADY_IN_TEAM',
  TEAM_UP_REQUEST_ALREADY_PENDING: 'TEAM_UP_REQUEST_ALREADY_PENDING',
} as const;
