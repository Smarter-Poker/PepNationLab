/**
 * Server error codes -> sentences a person can read.
 *
 * The wallet's own header comment states the rule: "the API returns raw enum
 * text (e.g. pending_payment) which must never reach the UI per the platform
 * Title Case rule." Three call sites broke it by concatenating the raw server
 * message into a toast, so agents were shown things like:
 *
 *   Pay Failed: amount_mismatch
 *   Dispute Failed: already_disputed
 *   Request Failed: must_be_higher_than_current
 *
 * Mirrors the approach in lib/payment-method-labels.ts: one map, used
 * everywhere, with a safe generic fallback rather than leaking the raw text.
 */

const MESSAGES: Record<string, string> = {
  // pay_invoice
  amount_mismatch: 'That Amount No Longer Matches This Bill. Refresh And Try Again.',
  already_paid: 'This Bill Has Already Been Paid.',
  target_not_found: 'That Bill Could Not Be Found.',
  invalid_target_type: 'Unrecognised Bill Type.',
  // disputes
  already_disputed: 'This Bill Has Already Been Disputed.',
  // credit increase
  must_be_higher_than_current: 'Enter An Amount Higher Than Your Current Limit.',
  rate_limited: 'You Have Made This Request Recently. Please Wait Before Trying Again.',
  pending_request_exists: 'You Already Have A Request Waiting For Review.',
  // shared
  forbidden: 'This Does Not Belong To Your Account.',
  unauthorized: 'Please Sign In Again.',
  bad_request: 'That Request Was Not Valid.',
};

const GENERIC = 'Something Went Wrong. Please Try Again.';

/**
 * `raw` may be a bare code, a sentence the server already made friendly, or a
 * Postgres message with a code embedded in it. Only text that is already
 * human-readable is passed through: anything that looks like an internal code
 * (snake_case, no spaces) is replaced.
 */
export function walletErrorMessage(raw: unknown, fallback: string = GENERIC): string {
  const text = typeof raw === 'string' ? raw : raw instanceof Error ? raw.message : '';
  if (!text) return fallback;

  for (const [code, message] of Object.entries(MESSAGES)) {
    if (text.includes(code)) return message;
  }

  // Looks like an internal identifier rather than a sentence.
  const looksLikeCode = !text.includes(' ') || /^[a-z0-9_]+$/.test(text.trim());
  if (looksLikeCode) return fallback;

  return text;
}
