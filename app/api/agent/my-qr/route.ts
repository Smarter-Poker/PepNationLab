
// R24 hotfix - Unified "My QR Code" endpoint (bulletproofed).
// Returns the storefront URL the current user should advertise via QR.
// Sub-agents inherit their PARENT agent's storefront and append ?ref=<sub_agent_id>
// so order attribution credits them correctly.
//
// Error reporting: every failure path returns a JSON body with `error` + `message`
// so the modal can show why it failed (rather than a generic "Could Not Load QR").
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { captureError } from '@/lib/sentry';
import { logError } from '@/lib/log';
// ONE builder for storefront QR payloads. See lib/qr-storefront.ts: every
// route that hand-rolled this string had drifted, and the drift is what
// silently dropped `?ref=` and the utm pair off printed codes.
import { buildStorefrontQrUrl, generateStorefrontQr } from '@/lib/qr-storefront';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await getEffectiveUser(supabase);
    if (!user) return NextResponse.json({ error: 'unauthorized', message: 'Please Sign In' }, { status: 401 });

    // CRITICAL: createServiceClient is async - must be awaited.
    const svc = await createServiceClient();

    const { data: profile, error: pErr } = await svc
      .from('profiles')
      .select('id, role, is_super_agent, is_sub_agent, parent_agent_id, referring_agent_id, full_name, username, referral_code')
      .eq('id', user.id)
      .maybeSingle();
    if (pErr) {
      logError('agent.my-qr.profile_query', { userId: user.id }, pErr);
      captureError(pErr, { context: 'agent.my-qr.profile_query', userId: user.id });
      return NextResponse.json({ error: 'profile_query_failed', message: 'Could Not Load Your Profile. Please Try Again.' }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json({ error: 'no_profile', message: 'Your Profile Was Not Found' }, { status: 404 });
    }

    const isSub = !!profile.is_sub_agent;
    const isSuper = !!profile.is_super_agent || profile.role === 'super_agent';
    const isResearcher = profile.role === 'researcher' && !isSub && !isSuper;

    // NOTE: the referral identifier is resolved AFTER the storefront lookup
    // below, not here. Its last-resort fallback is the storefront slug, which
    // does not exist yet at this point in the handler.
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')) || 'https://pepnationlab.com';

    // Resolve the associated storefront FIRST (own for agents/super-agents,
    // parent for sub-agents, referring agent for researchers) - the QR target
    // depends on it. This lookup already existed but ran *after* the URL was
    // built, so it could only ever be offered as a secondary link.
    let storefrontSlug: string | null = null;
    let storefrontUrl: string | null = null;
    let displayName: string | null = profile.full_name ?? null;
    let primaryColor = '#C0B8A8';
    {
      const lookupId = isSub
        ? (profile.parent_agent_id ?? profile.referring_agent_id ?? null)
        : isResearcher
          ? (profile.referring_agent_id ?? null)
          : user.id;
      if (lookupId) {
        const { data: agent, error: aErr } = await svc
          .from('agent_profiles')
          .select('slug, display_name, primary_color, is_active')
          .eq('id', lookupId)
          .maybeSingle();
        if (aErr) {
          logError('agent.my-qr.agent_query', { userId: user.id, lookupId }, aErr);
        }
        // An inactive storefront renders a "Storefront Paused" card, so it is
        // not a usable QR destination - fall back to the landing page for it.
        if (agent?.slug && agent.is_active !== false) {
          storefrontSlug = agent.slug;
          storefrontUrl = `${baseUrl}/${agent.slug}`;
        }
        if (agent?.display_name) displayName = agent.display_name;
        if (agent?.primary_color) primaryColor = agent.primary_color;
      }
    }

    // REFERRAL IDENTIFIER - THE PRECEDENCE MATTERS AND IT MUST NEVER BE A UUID.
    // proxy.ts resolveRefCode() looks a scanned code up with
    // `username.ilike.<code> OR referral_code.ilike.<code>` against profiles,
    // so either column resolves. `referral_code` is the column that exists
    // precisely to be handed out, so it wins; `username` is the fallback
    // because the same query accepts it and every account has one.
    //
    // This order used to be inverted AND it terminated in `user.id`. A UUID
    // matches NEITHER column, so resolveRefCode() returned null, no referral
    // lock was ever minted, and the scan credited nobody - the agent handed
    // out a printed code that looked perfect and earned them nothing, with no
    // symptom until the commissions failed to appear. The storefront slug is
    // the last resort instead: a scan of `/<slug>` is still resolved by
    // proxy.ts resolveStoreSlug(), which mints a lock for that store's owner,
    // so attribution survives even when both profile columns are unusable.
    //
    // `||`, deliberately not `??`. Profile rows written with an empty string
    // rather than NULL are just as unusable as missing ones, and `??` only
    // skips null/undefined - it would let `''` win over a perfectly good
    // referral_code and emit `?ref=` with nothing after it.
    const referralCode = (profile.referral_code || profile.username || storefrontSlug || '').trim();

    // Nothing resolvable at all. Returning a QR anyway would print a code that
    // credits nobody; saying so plainly is the only outcome the agent can act
    // on, so this fails loudly rather than shipping a decorative QR.
    if (!referralCode) {
      logError(
        'agent.my-qr.no_referral_identifier',
        { userId: user.id },
        new Error('Profile has no referral_code, no username and no routable storefront slug'),
      );
      return NextResponse.json({
        error: 'no_referral_code',
        message: 'Your Account Has No Referral Code Yet. Please Contact Support So Your Code Can Be Issued.',
      }, { status: 409 });
    }

    // QR TARGET. Scanning an agent's code must open that agent's STORE - the
    // products and the pricing - never an account-creation screen. `?ref=` is
    // carried on the storefront URL so proxy.ts mints the identical signed
    // referral lock it minted when the QR pointed at `/`; attribution, downline
    // assignment and researcher referral credits are unchanged.
    //
    // Built through buildStorefrontQrUrl() instead of a local template so this
    // route cannot drift from the codes the provisioning routes already store.
    // The hand-rolled string it replaces carried the `?ref=` but NO utm params,
    // so every scan of a dashboard-issued code arrived in analytics as untagged
    // direct traffic, indistinguishable from somebody typing the URL - the
    // exact drift lib/qr-storefront.ts was created to end.
    //
    // An empty slug is a supported input, not an accident: buildStorefrontQrUrl
    // then emits `${APP_ORIGIN}/?ref=<code>&utm_...`, which is the same
    // landing-page target this route has always used for users with no
    // resolvable storefront (researchers, and agents whose agent_profiles row
    // is missing or inactive). proxy.ts routes those guests on to the house
    // store for browsing.
    const signupUrl = buildStorefrontQrUrl(storefrontSlug ?? '', referralCode);

    // Render the QR server-side. This endpoint is named "my-qr" and answered
    // `qrCodeData: null`, which made every caller re-derive the payload itself
    // - and a caller that rebuilt the URL even slightly differently (or not at
    // all) showed an empty box or a code pointing somewhere else. This encodes
    // exactly the `signupUrl` above, from the same builder, so the two can
    // never disagree. generateStorefrontQr never throws: a render failure
    // returns null and the client-side regeneration path below still covers it.
    const qrCodeData = await generateStorefrontQr(storefrontSlug ?? '', referralCode);

    const effectDescription = isResearcher
      ? 'Anyone Who Signs Up With This Code Earns You Referral Credits On Their First Qualifying Order.'
      : isSub
        ? 'Anyone Who Signs Up With This Code Joins Your Downline. Turn On Referral Rewards In Settings To Also Earn Credits.'
        : 'Anyone Who Signs Up With This Code Joins Your Downline And Their Orders Credit You.';

    return NextResponse.json({
      url: signupUrl,
      referralCode,
      signupUrl,
      storefrontSlug,
      storefrontUrl,
      slug: storefrontSlug,
      displayName,
      qrCodeData, // server-rendered data URL; null only if rendering failed, in
                  // which case clients regenerate it from the link above
      primaryColor,
      isInvite: true,
      referCode: referralCode,
      roleLabel: 'My Referral Code',
      description: effectDescription,
      role: isResearcher ? 'researcher' : isSub ? 'sub_agent' : isSuper ? 'super_agent' : 'agent',
    });
  } catch (e: any) {
    console.error('[/api/agent/my-qr] uncaught:', e?.message, e?.stack);
    return NextResponse.json({
      error: 'unexpected',
      message: process.env.NODE_ENV === 'production' ? 'Unexpected Server Error' : (e?.message ?? 'Unknown'),
    }, { status: 500 });
  }
}
