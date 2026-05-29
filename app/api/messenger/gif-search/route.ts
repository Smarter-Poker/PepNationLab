import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TenorMediaFormat { url: string; dims?: number[]; size?: number }
interface TenorResult {
  id: string;
  title: string;
  media_formats: { gif?: TenorMediaFormat; tinygif?: TenorMediaFormat };
}
interface TenorResponse { results?: TenorResult[]; next?: string }

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });
  void user;

  const key = process.env.TENOR_API_KEY;
  if (!key) return NextResponse.json({ error: 'Gif Search Not Configured' }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { q?: string; pos?: string };
  const q = String(body.q ?? '').trim().slice(0, 80);
  if (!q) return NextResponse.json({ results: [] });

  const url = new URL('https://tenor.googleapis.com/v2/search');
  url.searchParams.set('q', q);
  url.searchParams.set('key', key);
  url.searchParams.set('limit', '20');
  url.searchParams.set('media_filter', 'gif,tinygif');
  url.searchParams.set('contentfilter', 'high');
  url.searchParams.set('client_key', 'pepnationlab');
  if (body.pos) url.searchParams.set('pos', String(body.pos));

  try {
    const resp = await fetch(url.toString(), { cache: 'no-store' });
    if (!resp.ok) return NextResponse.json({ error: 'Tenor Error', status: resp.status }, { status: 502 });
    const json = (await resp.json()) as TenorResponse;
    const results = (json.results ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      gifUrl: r.media_formats.gif?.url ?? null,
      thumbUrl: r.media_formats.tinygif?.url ?? null,
    }));
    return NextResponse.json({ results, next: json.next ?? null });
  } catch {
    return NextResponse.json({ error: 'Network Error' }, { status: 502 });
  }
}
