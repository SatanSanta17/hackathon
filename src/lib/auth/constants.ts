export const TOKEN_TYPE = {
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
} as const;

export const AUTH_CONSTANTS = {
  /** bcrypt cost factor for password hashing */
  BCRYPT_COST: 12,

  /** Email verification token expiry in minutes */
  EMAIL_VERIFICATION_EXPIRY_MINUTES: 1440, // 24 hours

  /** Password reset token expiry in minutes */
  PASSWORD_RESET_EXPIRY_MINUTES: 60, // 1 hour

  /** Org invite expiry in days */
  ORG_INVITE_EXPIRY_DAYS: 7,
} as const;

/**
 * Human-readable expiry labels — derived from the constants above.
 * Used in email templates, UI messages, and error responses.
 * If you change the expiry durations, these update automatically.
 */
export const AUTH_EXPIRY_LABELS = {
  emailVerification: formatExpiry(AUTH_CONSTANTS.EMAIL_VERIFICATION_EXPIRY_MINUTES),
  passwordReset: formatExpiry(AUTH_CONSTANTS.PASSWORD_RESET_EXPIRY_MINUTES),
  orgInvite: `${AUTH_CONSTANTS.ORG_INVITE_EXPIRY_DAYS} day(s)`,
} as const;

function formatExpiry(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) return `${minutes / 1440} day(s)`;
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} hour(s)`;
  return `${minutes} minute(s)`;
}
