import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { sanitizeUsername } from '@/lib/usernames';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Field = 'slug' | 'username' | 'display_name';

/**
 * Reserved slugs that conflict with the platform's URL surface. Anything in
 * /app at the top level or that already routes elsewhere on pepnationlab.com
 * lives here. The DB CHECK constraint enforces the same list — this client
 * mirror just gives a friendlier message before the round-trip.
 */
const RESERVED_SLUGS = new Set([
  'admin', 'api', 'login', 'logout', 'register', 'signup', 'forgot-password',
  'become-agent', 'about', 'terms', 'privacy', 'compliance', 'disclaimer',
  'dashboard', 'checkout', 'orders', 'products', 'messages', 'messenger',
  'shipping', 'account', 'static', '_next', 'favicon.ico', 'sitemap.xml',
  'robots.txt', 'health', 'reorder',
]);

function escapeLike(v: string): string {
  // ilike treats % and _ as wildcards — escape both so a username containing
  // _ doesn't accidentally match multiple rows. Backslash escapes those.
  return v.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function validateSlug(raw: string): { ok: true; normalized: string } | { ok: false; reason: string } {
  const v = raw.trim().toLowerCase();
  if (v.length < 3) return { ok: false, reason: 'Slug Must Be At Least 3 Characters.' };
  if (v.length > 30) return { ok: false, reason: 'Slug Must Be 30 Characters Or Fewer.' };
  if (!/^[a-z0-9-]+$/.test(v)) {
    return { ok: false, reason: 'Slug May Only Contain Lowercase Letters, Numbers, And Hyphens.' };
  }
  if (v.startsWith('-') || v.endsWith('-')) {
    return { ok: false, reason: 'Slug Cannot Start Or End With A Hyphen.' };
  }
  if (v.includes('--')) {
    return { ok: false, reason: 'Slug Cannot Contain Consecutive Hyphens.' };
  }
  if (RESERVED_SLUGS.has(v)) {
    return { ok: false, reason: 'That Slug Is Reserved By The Platform.' };
  }
  return { ok: true, normalized: v };
}

function validateUsername(raw: string): { ok: true; normalized: string } | { ok: false; reason: string } {
  const v = sanitizeUsername(raw);
  if (!v) {
    return { ok: false, reason: 'Username May Only Contain Letters, Numbers, And Underscores.' };
  }
  if (v.length < 2) return { ok: false, reason: 'Username Must Be At Least 2 Characters.' };
  if (v.length > 30) return { ok: false, reason: 'Username Must Be 30 Characters Or Fewer.' };
  return { ok: true, normalized: v };
}

function validateDisplayName(raw: string): { ok: true; normalized: string } | { ok: false; reason: string } {
  const v = raw.trim();
  if (v.length < 2) return { ok: false, reason: 'Display Name Must Be At Least 2 Characters.' };
  if (v.length > 60) return { ok: false, reason: 'Display Name Must Be 60 Characters Or Fewer.' };
  return { ok: true, normalized: v };
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'availability_check',
    limit: 60,
    windowSeconds: 60,
    identifier: ip,
  });
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  const url = new URL(req.url);
  const field = (url.searchParams.get('field') || '').trim() as Field;
  const rawValue = url.searchParams.get('value') ?? '';
  const excludeId = url.searchParams.get('excludeId') || '';

  if (!field || !rawValue) {
    return NextResponse.json({ error: 'field And value Are Required' }, { status: 400 });
  }
  if (!['slug', 'username', 'display_name'].includes(field)) {
    return NextResponse.json({ error: 'field Must Be slug, username, Or display_name' }, { status: 400 });
  }
  if (excludeId && !/^[0-9a-f-]{36}$/i.test(excludeId)) {
    return NextResponse.json({ error: 'Invalid excludeId' }, { status: 400 });
  }

  // Format-validate first so obvious junk is rejected without a DB query.
  const validated =
    field === 'slug'
      ? validateSlug(rawValue)
      : field === 'username'
        ? validateUsername(rawValue)
        : validateDisplayName(rawValue);

  if (!validated.ok) {
    return NextResponse.json({ available: false, reason: validated.reason, normalized: rawValue }, { status: 200 });
  }

  const supabase = await createServiceClient();
  const value = validated.normalized;
  const likeValue = escapeLike(value);

  let table: 'agent_profiles' | 'profiles';
  let column: string;
  if (field === 'slug') {
    table = 'agent_profiles';
    column = 'slug';
  } else if (field === 'username') {
    table = 'profiles';
    column = 'username';
  } else {
    table = 'agent_profiles';
    column = 'display_name';
  }

  let q = supabase.from(table).select('id').ilike(column, likeValue).limit(2);
  if (excludeId) q = q.neq('id', excludeId);
  const { data, error } = await q;

  if (error) {
    console.error('[availability] query failed:', error);
    return NextResponse.json({ error: 'Lookup Failed' }, { status: 500 });
  }

  const taken = Array.isArray(data) && data.length > 0;
  return NextResponse.json(
    {
      available: !taken,
      normalized: value,
      reason: taken
        ? field === 'slug'
          ? 'That Storefront URL Slug Is Already Taken — Try Another.'
          : field === 'username'
            ? 'That Username Is Already Taken — Try Another.'
            : 'That Display Name Is Already Taken — Try Another.'
        : undefined,
    },
    {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    },
  );
}
