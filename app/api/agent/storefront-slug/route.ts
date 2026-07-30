import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { generateStorefrontQr } from '@/lib/qr-storefront';

/**
 * POST /api/agent/storefront-slug
 *
 * Update the calling agent's storefront slug with server-side validation
 * and a clean 409 surface when the slug collides with another agent OR
 * the database CHECK denylist (reserved words like admin/api/login/etc).
 *
 * Optional body: `reservationToken` - when supplied (and unexpired), the
 * server consumes it BEFORE the UPDATE so a competing simultaneous signup
 * trying the same slug loses the race. The 90-second token TTL lets a slow
 * typist finish their flow without losing the slug to a fast bot.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;

  // SACA: sub-agents do not own a storefront and cannot change a slug.
  // Without this gate the UPDATE finds zero rows (sub-agents have no
  // agent_profiles row) and returns a confusing 500 'unexpected error'.
  const subAgentCheckClient = await createServiceClient();
  const { data: subAgentCheck } = await subAgentCheckClient
    .from('profiles')
    .select('is_sub_agent')
    .eq('id', gate.user.id)
    .maybeSingle();
  if ((subAgentCheck as { is_sub_agent?: boolean | null } | null)?.is_sub_agent === true) {
    return NextResponse.json(
      { error: 'Sub-Agents Do Not Own A Storefront And Cannot Change Slugs.' },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const raw = typeof body?.slug === 'string' ? body.slug : '';
  const reservationToken =
    typeof body?.reservationToken === 'string' && /^[0-9a-f-]{36}$/i.test(body.reservationToken)
      ? body.reservationToken
      : null;
  const cleanSlug = raw.trim().toLowerCase();

  // Sanitize: lower-kebab only ([a-z0-9-]).
  if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
    return NextResponse.json(
      { error: 'Slug Must Contain Only Lowercase Letters, Numbers, And Hyphens.' },
      { status: 400 }
    );
  }

  if (cleanSlug.length < 3 || cleanSlug.length > 30) {
    return NextResponse.json(
      { error: 'Slug Must Be Between 3 And 30 Characters.' },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();
  const agentId = gate.user.id;

  // If the caller has a reservation token, consume it now. The RPC marks the
  // row consumed atomically; a stale or wrong-slug token returns false and
  // we fall through to the regular write path (DB still enforces uniqueness).
  if (reservationToken) {
    try {
      await supabase.rpc('consume_slug_reservation', {
        p_token: reservationToken,
        p_field: 'slug',
        p_normalized: cleanSlug,
      });
    } catch (err) {
      console.warn('[storefront-slug] consume_slug_reservation failed:', err);
    }
  }

  // Capture the OLD slug before the rename so its cached catalog entry can be
  // purged too - otherwise the old URL keeps serving a stale catalog (instead
  // of a 404) until its revalidate window expires.
  const { data: previous } = await supabase
    .from('agent_profiles')
    .select('slug')
    .eq('id', agentId)
    .maybeSingle();
  const oldSlug = previous?.slug ?? null;

  // A rename invalidates the stored QR code: it still encodes the OLD slug,
  // which now resolves to nothing. Every printed code an agent hands out would
  // keep pointing at a dead URL until someone noticed. Regenerate it in the
  // same UPDATE so the slug and its QR can never disagree.
  //
  // The referral namespace is profiles.referral_code when one exists and
  // profiles.username otherwise; proxy.ts's resolveRefCode() accepts either
  // (and the slug itself), so a missing profile row still yields a working
  // hard lock rather than no lock at all.
  const { data: refRow } = await supabase
    .from('profiles')
    .select('username, referral_code')
    .eq('id', agentId)
    .maybeSingle();
  const refCode =
    (refRow as { username?: string | null; referral_code?: string | null } | null)?.referral_code ||
    (refRow as { username?: string | null } | null)?.username ||
    cleanSlug;
  const freshQr = await generateStorefrontQr(cleanSlug, refCode);

  // Only overwrite qr_code_data when the render actually succeeded - writing
  // null would erase a working (if stale) code and leave the agent with none.
  const updatePayload: { slug: string; qr_code_data?: string } = { slug: cleanSlug };
  if (freshQr) updatePayload.qr_code_data = freshQr;

  const { data, error } = await supabase
    .from('agent_profiles')
    .update(updatePayload)
    .eq('id', agentId)
    .select('slug')
    .maybeSingle();

  if (error) {
    // Postgres unique violation = 23505; CHECK violation = 23514.
    const code = (error as any).code;
    if (code === '23505' || code === '23514') {
      return NextResponse.json(
        { error: 'Slug Is Reserved Or Already In Use' },
        { status: 409 }
      );
    }
    // Some Postgrest wrappers expose the constraint name in the message.
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('reserved') || msg.includes('unique') || msg.includes('duplicate') || msg.includes('check constraint')) {
      return NextResponse.json(
        { error: 'Slug Is Reserved Or Already In Use' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Slug Was Updated But Could Not Be Retrieved' }, { status: 500 });
  }

  // A slug rename moves the storefront URL: purge the NEW slug's tag (so the
  // first hit builds fresh), the OLD slug's tag (so the abandoned URL stops
  // serving a cached catalog), and the global tag.
  try {
    revalidateTag('storefront-catalog', { expire: 0 });
    revalidateTag('catalog:' + data.slug, { expire: 0 });
    if (oldSlug && oldSlug !== data.slug) revalidateTag('catalog:' + oldSlug, { expire: 0 });
  } catch { /* best-effort cache refresh */ }

  return NextResponse.json({ slug: data.slug, url: `/${data.slug}` });
}
