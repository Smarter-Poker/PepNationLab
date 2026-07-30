import { NextRequest, NextResponse } from 'next/server';
import { generateQrDataUrl } from '@/lib/qr';
import { createAdminClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { STORE_SLUG_RE, RESERVED_SEGMENTS } from '@/lib/store-slug';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * PostgREST treats `_` and `%` as LIKE wildcards inside .ilike(). A referral
 * code containing either would silently widen the match and could resolve to a
 * different agent - i.e. print a QR code pointing at someone else's store.
 * Same escape proxy.ts uses.
 */
function likeEscape(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * Resolve a referral identifier to a routable, ACTIVE storefront slug.
 *
 * The identifier that reaches this route is whatever the referrals page had on
 * hand - `data.referral_code` (a username or a referral_code) or, failing that,
 * the agent's own slug. All three are accepted, in the same order proxy.ts
 * resolves them, so the QR target matches what the middleware will lock to.
 *
 * Returns null when nothing resolves or the storefront is paused; an inactive
 * store renders a "Storefront Paused" card, which is not a usable QR target.
 */
async function resolveStorefrontSlug(ref: string): Promise<string | null> {
  const candidate = ref.trim().toLowerCase();
  if (!candidate) return null;

  const supabase = createAdminClient();

  // 1. The identifier may already be the storefront slug.
  if (STORE_SLUG_RE.test(candidate) && !RESERVED_SEGMENTS.has(candidate)) {
    const { data: bySlug } = await supabase
      .from('agent_profiles')
      .select('slug, is_active')
      .eq('slug', candidate)
      .maybeSingle();
    if (bySlug?.slug && bySlug.is_active !== false) return bySlug.slug;
  }

  // 2. Otherwise it is a username or a referral_code on profiles. Usernames are
  //    stored lowercased, so that lookup is an exact match; referral_code is
  //    not, so it needs a case-insensitive one.
  let ownerId: string | null = null;

  const { data: byUsername } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', candidate)
    .maybeSingle();
  ownerId = byUsername?.id ?? null;

  if (!ownerId) {
    const { data: byCode } = await supabase
      .from('profiles')
      .select('id')
      .ilike('referral_code', likeEscape(candidate))
      .limit(1)
      .maybeSingle();
    ownerId = byCode?.id ?? null;
  }

  if (!ownerId) return null;

  const { data: agent } = await supabase
    .from('agent_profiles')
    .select('slug, is_active')
    .eq('id', ownerId)
    .maybeSingle();

  if (agent?.slug && agent.is_active !== false) return agent.slug;
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ref = (searchParams.get('ref') || searchParams.get('slug') || '').trim();

  if (!ref) {
    return NextResponse.json({ error: 'Referral Code Is Required' }, { status: 400 });
  }
  if (ref.length > 64) {
    return NextResponse.json({ error: 'Referral Code Is Invalid' }, { status: 400 });
  }

  // Unauthenticated endpoint that now does DB lookups plus PNG generation.
  const rl = await rateLimit({
    key: 'referral_qr',
    limit: 60,
    windowSeconds: 60,
    identifier: getClientIp(req),
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')) || 'https://pepnationlab.com';

  // QR TARGET. Scanning an agent's code opens that agent's STORE - the products
  // and the pricing. It must never open an account-creation screen; `/signup`
  // (heading: "Create Researcher Account") was the old target here.
  //
  // `?ref=` rides along so proxy.ts mints the identical signed referral lock it
  // minted when the QR pointed at /signup - downline assignment and referral
  // credits are unchanged.
  let storefrontSlug: string | null = null;
  try {
    storefrontSlug = await resolveStorefrontSlug(ref);
  } catch (err) {
    // A lookup failure must not turn a storefront QR into an error card.
    console.error('[referral-qr] slug resolution failed:', err);
  }

  // Fallback is the landing page, never /signup. proxy.ts redirects `/?ref=<code>`
  // on to the locked store whenever the code resolves, and the landing page
  // itself offers "Continue As Guest".
  const url = storefrontSlug
    ? `${base}/${storefrontSlug}?ref=${encodeURIComponent(ref)}`
    : `${base}/?ref=${encodeURIComponent(ref)}`;

  try {
    const dataUrl = await generateQrDataUrl(url);
    // dataUrl is "data:image/png;base64,..."
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        // The encoded target now depends on mutable DB state (slug renames,
        // storefront deactivation), so this can no longer be an immutable
        // day-long cache - that would keep handing out a QR for a dead slug.
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err) {
    console.error('QR Generation Error:', err);
    return NextResponse.json({ error: 'Failed To Generate QR Code' }, { status: 500 });
  }
}
