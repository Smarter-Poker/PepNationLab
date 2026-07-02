/**
 * Shared SSRF (Server-Side Request Forgery) guard.
 *
 * Any server-side code that fetches a URL whose host is influenced -- even
 * indirectly -- by user input MUST validate the destination with this module
 * before issuing the request. A naive `new URL(input).hostname` blocklist is
 * NOT enough on its own, because:
 *
 *   1. A public hostname (e.g. evil.com) can resolve via DNS to a private or
 *      cloud-metadata address (169.254.169.254, 127.0.0.1, 10.x, ...). A
 *      literal-string check never sees that. We therefore RESOLVE the host and
 *      validate every resolved IP.
 *   2. A public, allowed host can issue an HTTP 3xx redirect whose Location
 *      points at an internal address. The default fetch behaviour
 *      (`redirect: 'follow'`) silently chases it. We therefore follow redirects
 *      MANUALLY and re-validate every hop with `assertPublicUrl`.
 *
 * Covers IPv4 (loopback, RFC1918 private, link-local / cloud metadata, CGNAT,
 * 0.0.0.0/8) and IPv6 (::1, ::, ULA fc00::/7, link-local fe80::/10, and
 * IPv4-mapped ::ffff:a.b.c.d).
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

function ipv4InRange(ip: string, cidr: [string, number]): boolean {
  const [base, prefix] = cidr;
  const ipParts = ip.split('.').map((n) => Number(n));
  const baseParts = base.split('.').map((n) => Number(n));
  if (ipParts.length !== 4 || baseParts.length !== 4) return false;
  if (ipParts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false;
  const ipInt = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  const baseInt = (baseParts[0] << 24) | (baseParts[1] << 16) | (baseParts[2] << 8) | baseParts[3];
  const mask = prefix === 0 ? 0 : (-1 << (32 - prefix)) >>> 0;
  return ((ipInt >>> 0) & mask) === ((baseInt >>> 0) & mask);
}

function isPrivateOrLoopbackIPv4(ip: string): boolean {
  const blocks: Array<[string, number]> = [
    ['0.0.0.0', 8],        // "this" network
    ['10.0.0.0', 8],       // RFC1918 private
    ['100.64.0.0', 10],    // CGNAT (RFC6598)
    ['127.0.0.0', 8],      // loopback
    ['169.254.0.0', 16],   // link-local / AWS+GCP+Azure metadata (169.254.169.254)
    ['172.16.0.0', 12],    // RFC1918 private
    ['192.0.0.0', 24],     // IETF protocol assignments
    ['192.0.2.0', 24],     // TEST-NET-1 (RFC5737)
    ['192.168.0.0', 16],   // RFC1918 private
    ['198.18.0.0', 15],    // benchmarking
    ['198.51.100.0', 24],  // TEST-NET-2 (RFC5737)
    ['203.0.113.0', 24],   // TEST-NET-3 (RFC5737)
    ['240.0.0.0', 4],      // Reserved
    ['255.255.255.255', 32], // Broadcast
  ];
  return blocks.some((b) => ipv4InRange(ip, b));
}

function isPrivateOrLoopbackIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA fc00::/7
  if (lower.startsWith('fe80')) return true;                          // link-local
  if (lower.startsWith('2002:')) return true;                         // 6to4 (can map to private IPv4)
  if (lower.startsWith('64:ff9b::')) return true;                     // IPv4/IPv6 translation
  if (lower.startsWith('::ffff:')) {
    const v4 = lower.slice('::ffff:'.length);
    if (isIP(v4) === 4) return isPrivateOrLoopbackIPv4(v4);
  }
  return false;
}

/**
 * True when `hostname` is a literal private/loopback/metadata IP, a
 * non-routable name (localhost / *.internal / metadata*), OR resolves via DNS
 * to any private/loopback/metadata address. Fails CLOSED: a DNS failure is
 * treated as unsafe.
 */
export async function isSsrfTarget(hostname: string): Promise<boolean> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === 'metadata' ||
    host.startsWith('metadata.') ||
    host.endsWith('.internal') ||
    host.endsWith('.local')
  ) {
    return true;
  }

  const ipKind = isIP(host);
  if (ipKind === 4) return isPrivateOrLoopbackIPv4(host);
  if (ipKind === 6) return isPrivateOrLoopbackIPv6(host);

  try {
    const addrs = await lookup(host, { all: true });
    if (!addrs.length) return true;
    for (const a of addrs) {
      if (a.family === 4 && isPrivateOrLoopbackIPv4(a.address)) return true;
      if (a.family === 6 && isPrivateOrLoopbackIPv6(a.address)) return true;
    }
  } catch {
    return true; // DNS failure -> fail closed
  }
  return false;
}

/**
 * Validates a full URL string for outbound fetch safety. Returns a parsed URL
 * when safe, or null when the protocol is not http/https or the host is an
 * SSRF target.
 */
export async function assertPublicUrl(raw: string): Promise<URL | null> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (await isSsrfTarget(parsed.hostname)) return null;
  return parsed;
}

/**
 * SSRF-safe replacement for `fetch` when the destination is user-influenced.
 *
 * Validates the initial URL, then follows redirects MANUALLY (default
 * `redirect: 'follow'` is disabled), re-validating each hop's host against
 * `isSsrfTarget`. Throws on an unsafe URL/hop or when the redirect budget is
 * exhausted. Pass `init` through to the underlying fetch for headers, signal,
 * method, etc.
 */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  opts: { maxRedirects?: number } = {},
): Promise<Response> {
  const maxRedirects = opts.maxRedirects ?? 5;
  let current = await assertPublicUrl(rawUrl);
  if (!current) throw new Error('SSRF_BLOCKED: destination host is not allowed');

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetch(current.toString(), { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return res; // redirect with no target -> hand back as-is
      const next = await assertPublicUrl(new URL(location, current).toString());
      if (!next) throw new Error('SSRF_BLOCKED: redirect target host is not allowed');
      current = next;
      continue;
    }
    return res;
  }
  throw new Error('SSRF_BLOCKED: too many redirects');
}
