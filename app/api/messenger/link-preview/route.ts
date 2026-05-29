import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';

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

function pickMeta(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["\']${prop}["\'][^>]+content=["\']([^"\']+)["\']`, 'i');
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
  void user;

  const body = (await req.json().catch(() => ({}))) as { url?: string };
  const url = normalizeUrl(String(body.url ?? ''));
  if (!url) return NextResponse.json({ error: 'Invalid Url' }, { status: 400 });
  const hash = createHash('sha256').update(url).digest('hex');

  const svc = await createServiceClient();
  const { data: cached } = await svc.from('messenger_link_previews').select('*').eq('url_hash', hash).maybeSingle();
  if (cached) return NextResponse.json({ preview: cached });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const head = await fetch(url, { method: 'HEAD', signal: controller.signal });
    const cType = head.headers.get('content-type') ?? '';
    const len = Number(head.headers.get('content-length') ?? 0);
    if (!cType.includes('text/html')) return NextResponse.json({ preview: null });
    if (len > MAX_HTML_BYTES) return NextResponse.json({ preview: null });

    const get = await fetch(url, { signal: controller.signal });
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
    const preview = {
      url_hash: hash,
      url,
      title: pickMeta(html, 'og:title') ?? pickTitle(html),
      description: pickMeta(html, 'og:description') ?? pickMeta(html, 'description'),
      image_url: pickMeta(html, 'og:image'),
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
