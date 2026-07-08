// Minimal HTML sanitization for the handful of places that render
// non-static strings through dangerouslySetInnerHTML. This is intentionally an
// allowlist escaper, not a full DOM sanitizer: we HTML-escape everything, then
// re-allow ONLY the small set of formatting tags each call site needs. That
// makes injection of <script>, <img onerror>, event handlers, etc. impossible
// because the raw '<' of any non-allowed tag is already escaped to '&lt;'.

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape all HTML, then convert newlines to <br/>. For rendering free-form
 * text (e.g. AI/LLM output) where the only formatting we want is line breaks.
 * Handles literal newlines and the escaped "\n" sequence some upstreams emit.
 */
export function escapeWithLineBreaks(input: string | null | undefined): string {
  if (!input) return '';
  return escapeHtml(String(input)).replace(/\\n|\n/g, '<br/>');
}

/**
 * Escape all HTML, then re-allow ONLY <mark> and </mark>. For Postgres
 * ts_headline snippets, which wrap search matches in <mark> but do NOT escape
 * any HTML already present in the source column (stored-XSS vector otherwise).
 */
export function escapeAllowingMark(input: string | null | undefined): string {
  if (!input) return '';
  return escapeHtml(String(input))
    .replace(/&lt;mark&gt;/g, '<mark>')
    .replace(/&lt;\/mark&gt;/g, '</mark>');
}
