// Shared open-redirect guard.
//
// Callers pass a post-auth "redirect" value that originates from the query string
// and is therefore attacker-controlled. Only a same-origin RELATIVE path is safe.
//
// The previous inline check (/^\/(?!\/|\\)/) was bypassable with an embedded
// control character: a URL-decoded value like "/<TAB>//evil.com" passes the
// negative lookahead (2nd char is a tab, not "/" or "\"), but browsers strip
// tab/newline/CR while parsing a URL, collapsing it to the scheme-relative
// "//evil.com" and navigating off-site. We strip control characters first, then
// require a single leading slash not followed by another slash or backslash.

// Strip ASCII control characters (code points 0-31) and DEL (127). Done by code
// point (not a regex) so no literal control byte ever appears in source.
function stripControlChars(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code <= 31 || code === 127) continue;
    out += input[i];
  }
  return out;
}

export function safeRelativePath(
  raw: string | null | undefined,
  fallback = '/dashboard',
): string {
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  const cleaned = stripControlChars(raw);
  if (!/^\/(?![/\\])/.test(cleaned)) return fallback;
  return cleaned;
}
