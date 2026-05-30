import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 200 * 1024;

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

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
    ['10.0.0.0', 8],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],   // link-local / AWS / GCP metadata
    ['172.16.0.0', 12],
    ['192.168.0.0', 16],
    ['0.0.0.0', 8],
    ['100.64.0.0', 10],    // CGNAT
  ];
  return blocks.some((b) => ipv4InRange(ip, b));
}

function isPrivateOrLoopbackIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7
  if (lower.startsWith('fe80')) return true;                          // link-local
  if (lower.startsWith('::ffff:')) {
    const v4 = lower.slice('::ffff:'.length);
    if (isIP(v4) === 4) return isPrivateOrLoopbackIPv4(v4);
  }
  return false;
}

async function isSsrfTarget(hostname: string): Promise<boolean> {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === 'metadata' || host === 'metadata.google.internal') return true;
  const ipKind = isIP(host);
  if (ipKind === 4) return isPrivateOrLoopbackIPv4(host);
  if (ipKind === 6) return isPrivateOrLoopbackIPv6(host);
  try {
    const addrs = await lookup(host, { all: true });
    for (const a of addrs) {
      if (a.family === 4 && isPrivateOrLoopbackIPv4(a.address)) return true;
      if (a.family === 6 && isPrivateOrLoopbackIPv6(a.address)) return true;
    }
  } catch {
    // DNS failure -- treat as suspicious and bail out.
    return true;
  }
  return false;
}

function pickMeta(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
  const m = html.match(re);
  return m ? m[1] : null;
}

function pickTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('read', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);
  void user;

  const body = (await req.json().catch(() => ({}))) as { url?: string };
  const url = normalizeUrl(String(body.url ?? ''));
  if (!url) return NextResponse.json({ error: 'Invalid Url' }, { status: 400 });
  const hash = createHash('sha256').update(url).digest('hex');

  const svc = await createServiceClient();
  const { data: cached } = await svc.from('messenger_link_previews').select('*').eq('url_hash', hash).maybeSingle();
  if (cached) return NextResponse.json({ preview: cached });

  // Audit fix: SSRF guard. Resolve the hostname and refuse to fetch any URL
  // that resolves to a loopback, link-local, private, or cloud-metadata
  // address. This protects the runtime from being used as a proxy into the
  // internal network of whatever Vercel/Cloud Run host serves the function.
  let parsed: URL;
  try { parsed = new URL(url); } catch { return NextResponse.json({ error: 'Invalid Url' }, { status: 400 }); }
  if (await isSsrfTarget(parsed.hostname)) {
    return NextResponse.json({ preview: null });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const head = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'manual' });
    const cType = head.headers.get('content-type') ?? '';
    const len = Number(head.headers.get('content-length') ?? 0);
    if (!cType.includes('text/html')) return NextResponse.json({ preview: null });
    if (len > MAX_HTML_BYTES) return NextResponse.json({ preview: null });

    const get = await fetch(url, { signal: controller.signal, redirect: 'manual' });
    const reader = get.body?.getReader();
    if (!reader) return NextResponse.json({ preview: null });
    let received = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_HTML_BYTES) { try { await reader.cancel(); } catch {} break; }
      chunks.push(value);
    }
    const buf = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) { buf.set(c, offset); offset += c.byteLength; }
    const html = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    const host = new URL(url).host;
    // Audit4 fix: og:image is attacker-controlled HTML metadata. Validate
    // it as an http(s) absolute URL before persisting. Drop javascript:,
    // data:, vbscript:, file:, and relative paths so the <img src> on the
    // client only ever points at a real fetchable image.
    const rawImage = pickMeta(html, 'og:image');
    let imageUrl: string | null = null;
    if (rawImage) {
      try {
        const u = new URL(rawImage, url);
        if (u.protocol === 'http:' || u.protocol === 'https:') {
          imageUrl = u.toString();
        }
      } catch {
        imageUrl = null;
      }
    }
    const preview = {
      url_hash: hash,
      url,
      title: pickMeta(html, 'og:title') ?? pickTitle(html),
      description: pickMeta(html, 'og:description') ?? pickMeta(html, 'description'),
      image_url: imageUrl,
      host,
      fetched_at: new Date().toISOString(),
    };
    await svc.from('messenger_link_previews').upsert(preview, { onConflict: 'url_hash' });
    return NextResponse.json({ preview });
  } catch {
    return NextResponse.json({ preview: null });
  } finally {
    clearTimeout(timer);
  }
}
