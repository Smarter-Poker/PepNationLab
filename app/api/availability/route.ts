// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { sanitizeUsername } from '@/lib/usernames';
import {
  normalizeNfkc,
  isMixedScriptLatinSuspect,
  containsConfusableCodepoint,
  containsProfanity,
  generateSlugSuggestions,
  generateDisplayNameSuggestions,
  isSimilarName,
  POLITELY_REJECT_REASON,
} from '@/lib/availability-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Field = 'slug' | 'username' | 'display_name';

/**
 * Fallback embedded reserved set - used only if the DB read of
 * public.reserved_slugs fails (e.g., transient outage). Kept small and
 * narrow; the authoritative list is the DB table.
 */
const FALLBACK_RESERVED = new Set([
  'admin', 'api', 'login', 'logout', 'register', 'signup', 'forgot-password',
  'become-agent', 'about', 'terms', 'privacy', 'compliance', 'disclaimer',
  'dashboard', 'checkout', 'orders', 'products', 'messages', 'messenger',
  'shipping', 'account', '_next', 'health', 'reorder',
]);

let reservedCache: { at: number; set: Set<string> } | null = null;
const RESERVED_TTL_MS = 60_000;

async function loadReservedSlugs(supabase: Awaited<ReturnType<typeof createServiceClient>>): Promise<Set<string>> {
  if (reservedCache && Date.now() - reservedCache.at < RESERVED_TTL_MS) {
    return reservedCache.set;
  }
  try {
    const { data, error } = await supabase.from('reserved_slugs').select('slug');
    if (error) throw error;
    const s = new Set<string>((data || []).map((r: { slug: string }) => r.slug));
    reservedCache = { at: Date.now(), set: s };
    return s;
  } catch (err) {
    console.warn('[availability] reserved_slugs read failed, using fallback:', err);
    return FALLBACK_RESERVED;
  }
}

function escapeLike(v: string): string {
  // Escape PostgreSQL ILIKE special characters: \ % _ and [ (POSIX char-class).
  return v.replace(/[\\%_[]/g, (m) => `\\${m}`);
}

interface ValidationOK { ok: true; normalized: string }
interface ValidationFail { ok: false; reason: string; reasonCode: 'invalid_format' | 'homoglyph' | 'profanity' | 'reserved' }
type Validation = ValidationOK | ValidationFail;

function validateSlug(raw: string, reserved: Set<string>): Validation {
  const nfkc = normalizeNfkc(raw).toLowerCase();
  if (nfkc.length < 3) return { ok: false, reason: 'Slug Must Be At Least 3 Characters.', reasonCode: 'invalid_format' };
  if (nfkc.length > 30) return { ok: false, reason: 'Slug Must Be 30 Characters Or Fewer.', reasonCode: 'invalid_format' };
  if (isMixedScriptLatinSuspect(nfkc) || containsConfusableCodepoint(nfkc)) {
    return { ok: false, reason: 'Slug Contains Look-Alike Characters From A Different Script. Use Plain Latin Letters.', reasonCode: 'homoglyph' };
  }
  if (!/^[a-z0-9-]+$/.test(nfkc)) {
    return { ok: false, reason: 'Slug May Only Contain Lowercase Letters, Numbers, And Hyphens.', reasonCode: 'invalid_format' };
  }
  if (nfkc.startsWith('-') || nfkc.endsWith('-')) {
    return { ok: false, reason: 'Slug Cannot Start Or End With A Hyphen.', reasonCode: 'invalid_format' };
  }
  if (nfkc.includes('--')) {
    return { ok: false, reason: 'Slug Cannot Contain Consecutive Hyphens.', reasonCode: 'invalid_format' };
  }
  if (containsProfanity(nfkc)) {
    return { ok: false, reason: POLITELY_REJECT_REASON, reasonCode: 'profanity' };
  }
  if (reserved.has(nfkc)) {
    return { ok: false, reason: 'That Slug Is Reserved By The Platform.', reasonCode: 'reserved' };
  }
  return { ok: true, normalized: nfkc };
}

function validateUsername(raw: string, reserved: Set<string>): Validation {
  const nfkc = normalizeNfkc(raw);
  if (isMixedScriptLatinSuspect(nfkc) || containsConfusableCodepoint(nfkc)) {
    return { ok: false, reason: 'Username Contains Look-Alike Characters. Use Plain Latin Letters.', reasonCode: 'homoglyph' };
  }
  const v = sanitizeUsername(nfkc);
  if (!v) {
    return { ok: false, reason: 'Username May Only Contain Letters, Numbers, And Underscores.', reasonCode: 'invalid_format' };
  }
  if (v.length < 2) return { ok: false, reason: 'Username Must Be At Least 2 Characters.', reasonCode: 'invalid_format' };
  if (v.length > 30) return { ok: false, reason: 'Username Must Be 30 Characters Or Fewer.', reasonCode: 'invalid_format' };
  if (containsProfanity(v)) {
    return { ok: false, reason: POLITELY_REJECT_REASON, reasonCode: 'profanity' };
  }
  if (reserved.has(v.toLowerCase())) {
    return { ok: false, reason: 'That Username Is Reserved By The Platform.', reasonCode: 'reserved' };
  }
  return { ok: true, normalized: v };
}

function validateDisplayName(raw: string, _reserved: Set<string>): Validation {
  const nfkc = normalizeNfkc(raw);
  if (nfkc.length < 2) return { ok: false, reason: 'User Name Must Be At Least 2 Characters.', reasonCode: 'invalid_format' };
  if (nfkc.length > 60) return { ok: false, reason: 'User Name Must Be 60 Characters Or Fewer.', reasonCode: 'invalid_format' };
  // User name is the friendliest field - we allow mixed scripts and
  // non-Latin entirely. But we still block obvious profanity.
  if (containsProfanity(nfkc)) {
    return { ok: false, reason: POLITELY_REJECT_REASON, reasonCode: 'profanity' };
  }
  return { ok: true, normalized: nfkc };
}

async function logFailedAttempt(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  payload: {
    field: Field;
    value: string;
    normalized: string;
    reason: string;
    reason_code: 'taken' | 'reserved' | 'invalid_format' | 'homoglyph' | 'profanity' | 'brand' | 'rate_limited' | 'other';
    ip: string | null;
    user_agent: string | null;
    caller_id: string | null;
  },
) {
  // Fire-and-forget - never block the response on the audit write. The
  // route's primary job is to answer the user; the log is best-effort.
  try {
    await supabase.from('availability_failed_attempts').insert(payload);
  } catch (err: any) {
    console.warn('[availability] audit insert failed:', err?.message || err);
  }
}

async function findSimilarExisting(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  field: Field,
  normalized: string,
  excludeId: string | null,
): Promise<string | null> {
  // Cheap prefix probe: pull rows whose value starts with the first 3
  // characters of the candidate. For 'slug' on agent_profiles this is a
  // bounded result set (slugs are unique + lowercase). We then walk the
  // returned set and apply isSimilarName().
  if (normalized.length < 3) return null;
  const table = field === 'username' ? 'profiles' : 'agent_profiles';
  const column = field === 'username' ? 'username' : field === 'slug' ? 'slug' : 'display_name';
  const prefix = normalized.slice(0, 3).toLowerCase();
  try {
    let q = supabase.from(table).select(`id, ${column}`).ilike(column, `${escapeLike(prefix)}%`).limit(25);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q;
    const haystack = (data || []) as Array<Record<string, unknown>>; // @ts-ignore
    for (const row of haystack) {
      const existing = String((row as any)[column] ?? '').toLowerCase().trim();
      if (!existing) continue;
      if (isSimilarName(normalized.toLowerCase(), existing)) {
        return existing;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function filterAvailableSuggestions(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  field: Field,
  candidates: string[],
  reserved: Set<string>,
): Promise<string[]> {
  if (candidates.length === 0) return [];
  const out: string[] = [];
  const table = field === 'username' ? 'profiles' : 'agent_profiles';
  const column = field === 'username' ? 'username' : field === 'slug' ? 'slug' : 'display_name';
  for (const c of candidates) {
    if (out.length >= 5) break;
    if (field === 'slug' && reserved.has(c.toLowerCase())) continue;
    if (field === 'username' && reserved.has(c.toLowerCase())) continue;
    try {
      const { data } = await supabase.from(table).select('id').ilike(column, escapeLike(c)).limit(1);
      if (!Array.isArray(data) || data.length === 0) {
        out.push(c);
      }
    } catch {
      // If a probe errors, just skip this candidate. The user gets fewer
      // suggestions but still some.
    }
  }
  return out;
}

async function issueReservation(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  field: Field,
  normalized: string,
  ip: string | null,
  excludeId: string | null,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('slug_reservations')
      .insert({
        field,
        normalized: normalized.toLowerCase(),
        ip,
        exclude_id: excludeId,
      })
      .select('token')
      .maybeSingle();
    if (error || !data?.token) return null;
    return String(data.token);
  } catch {
    return null;
  }
}

async function jitterDelay() {
  // 0–60ms jitter so an attacker can't distinguish DB-hit from
  // reserved-list-hit via latency. Cheap and unobtrusive.
  const ms = Math.floor(Math.random() * 60);
  await new Promise((r) => setTimeout(r, ms));
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const userAgent = req.headers.get('user-agent') ?? null;

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

  const supabase = await createServiceClient();
  const reserved = await loadReservedSlugs(supabase);

  const validated: Validation =
    field === 'slug'
      ? validateSlug(rawValue, reserved)
      : field === 'username'
        ? validateUsername(rawValue, reserved)
        : validateDisplayName(rawValue, reserved);

  if (!validated.ok) {
    await jitterDelay();
    // Audit format / homoglyph / profanity / reserved failures.
    await logFailedAttempt(supabase, {
      field,
      value: rawValue.slice(0, 200),
      normalized: rawValue.slice(0, 200),
      reason: validated.reason,
      reason_code: validated.reasonCode,
      ip,
      user_agent: userAgent,
      caller_id: null,
    });
    return NextResponse.json(
      {
        available: false,
        normalized: rawValue,
        reason: validated.reason,
        reserved: validated.reasonCode === 'reserved' || validated.reasonCode === 'profanity',
      },
      { status: 200, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  }

  const value = validated.normalized;
  const likeValue = escapeLike(value);
  const table: 'agent_profiles' | 'profiles' =
    field === 'slug' ? 'agent_profiles' : field === 'username' ? 'profiles' : 'agent_profiles';
  const column = field === 'slug' ? 'slug' : field === 'username' ? 'username' : 'display_name';

  let q = supabase.from(table).select('id').ilike(column, likeValue).limit(2);
  if (excludeId) q = q.neq('id', excludeId);
  const { data, error } = await q;

  if (error) {
    console.error('[availability] query failed:', error);
    return NextResponse.json({ error: 'Lookup Failed' }, { status: 500 });
  }

  const taken = Array.isArray(data) && data.length > 0;
  await jitterDelay();

  if (taken) {
    // Build alternative suggestions in parallel with the audit log write.
    const candidates =
      field === 'display_name'
        ? generateDisplayNameSuggestions(value)
        : generateSlugSuggestions(value);
    const [suggestions] = await Promise.all([
      filterAvailableSuggestions(supabase, field, candidates, reserved),
      logFailedAttempt(supabase, {
        field,
        value: rawValue.slice(0, 200),
        normalized: value.slice(0, 200),
        reason: 'Already taken',
        reason_code: 'taken',
        ip,
        user_agent: userAgent,
        caller_id: null,
      }),
    ]);
    return NextResponse.json(
      {
        available: false,
        normalized: value,
        reason:
          field === 'slug'
            ? 'That Storefront URL Slug Is Already Taken - Try Another.'
            : field === 'username'
              ? 'That Username Is Already Taken - Try Another.'
              : 'That User Name Is Already Taken - Try Another.',
        suggestions,
      },
      { status: 200, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  }

  // Available - issue a soft reservation and probe for similar names in
  // parallel. Both are best-effort; if either fails, the response still
  // carries available:true.
  const [reservationToken, similarTo] = await Promise.all([
    issueReservation(supabase, field, value, ip, excludeId || null),
    findSimilarExisting(supabase, field, value, excludeId || null),
  ]);

  return NextResponse.json(
    {
      available: true,
      normalized: value,
      reservationToken,
      similarTo,
    },
    { status: 200, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
  );
}
