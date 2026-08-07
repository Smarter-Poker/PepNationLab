/**
 * PASSWORD POLICY — the single source of truth.
 *
 * Rule: a user-chosen password is AT LEAST 8 characters. There is no
 * "exactly" rule and no 12-character rule. The 128 upper bound only guards
 * against absurd inputs (and matches the storefront register schema); any
 * normal password a user wants is fine. Admin-provisioned temporary
 * passwords are generated at 8 characters, which satisfies the same minimum.
 *
 * WHY THIS FILE EXISTS — the bug it prevents from returning: three surfaces
 * once carried three different hardcoded rules. The forced first-login page
 * (/account/change-password) demanded "At Least 12 Characters" while the API
 * it submits to (/api/auth/change-password) rejected anything that was not
 * EXACTLY 8 — so a new agent with a temporary password could not change it at
 * all: the page refused short passwords, then the API refused the long ones
 * the page had demanded. /signup and /reset-password enforced "exactly 8" as
 * well, while /account/security said "at least 8". Re-declaring the literal
 * in each file is precisely what let them drift apart.
 *
 * EVERY password surface (client form + API route) must import from here.
 * Do not write a numeric password-length literal anywhere else.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/** Input placeholder / helper copy shown next to password fields. */
export const PASSWORD_RULE_TEXT = 'At Least 8 Characters';

/** Error shown when a candidate password is shorter than the minimum. */
export const PASSWORD_TOO_SHORT_ERROR = 'Password Must Be At Least 8 Characters.';

/** Error shown when a candidate password exceeds the sanity cap. */
export const PASSWORD_TOO_LONG_ERROR = `Password Must Be At Most ${MAX_PASSWORD_LENGTH} Characters.`;

/**
 * Validate a candidate password against the policy.
 * Returns an error message string, or null when the password is acceptable.
 * Accepts `unknown` so API routes can pass unparsed JSON values safely.
 */
export function validatePassword(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.length < MIN_PASSWORD_LENGTH) {
    return PASSWORD_TOO_SHORT_ERROR;
  }
  if (pw.length > MAX_PASSWORD_LENGTH) {
    return PASSWORD_TOO_LONG_ERROR;
  }
  return null;
}
