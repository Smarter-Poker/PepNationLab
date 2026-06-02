import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/csrf';
import {
  normalizeNfkc,
  generateSlugSuggestions,
  generateDisplayNameSuggestions,
} from '@/lib/availability-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Field = 'slug' | 'username' | 'display_name';

function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (m) => `\\${m}`);
}

async function loadReservedSlugs(supabase: Awaited<ReturnType<typeof createServiceClient>>): Promise<Set<string>> {
  try {
    const { data } = await supabase.from('reserved_slugs').select('slug');
    return new Set<string>((data || []).map((r: { slug: string }) => r.slug));
  } catch {
    return new Set<string>();
  }
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'availability_suggest',
    limit: 30,
    windowSeconds: 60,
    identifier: ip,
  });
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const field = String(body?.field || '') as Field;
  const value = String(body?.value || '');

  if (!field || !value) {
    return NextResponse.json({ error: 'field And value Are Required' }, { status: 400 });
  }
  if (!['slug', 'username', 'display_name'].includes(field)) {
    return NextResponse.json({ error: 'field Must Be slug, username, Or display_name' }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const reserved = await loadReservedSlugs(supabase);

  const normalized = normalizeNfkc(value);
  const candidates =
    field === 'display_name'
      ? generateDisplayNameSuggestions(normalized)
      : generateSlugSuggestions(normalized.toLowerCase());

  const table: 'agent_profiles' | 'profiles' =
    field === 'username' ? 'profiles' : 'agent_profiles';
  const column = field === 'slug' ? 'slug' : field === 'username' ? 'username' : 'display_name';

  const out: string[] = [];
  for (const c of candidates) {
    if (out.length >= 5) break;
    if ((field === 'slug' || field === 'username') && reserved.has(c.toLowerCase())) continue;
    try {
      const { data } = await supabase.from(table).select('id').ilike(column, escapeLike(c)).limit(1);
      if (!Array.isArray(data) || data.length === 0) {
        out.push(c);
      }
    } catch {
      // Skip on probe error.
    }
  }

  return NextResponse.json({ suggestions: out }, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}
