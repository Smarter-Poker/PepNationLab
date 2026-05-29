const DANGEROUS_URL_RE = /(?:javascript|data|vbscript|file):/i;
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Sanitize a user-supplied message body before storing it. Strips control
 * characters, normalizes whitespace, refuses any text that contains a
 * dangerous URL scheme so we never persist a payload that could be turned
 * into an injection vector during a later render.
 *
 * Returns the cleaned string, or null if the input is unsafe and must be
 * rejected at the API boundary with a 400.
 */
export function sanitizeMessageText(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  if (DANGEROUS_URL_RE.test(raw)) return null;
  const stripped = raw.replace(CONTROL_CHARS_RE, '');
  const normalized = stripped.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n');
  return normalized.trim();
}
