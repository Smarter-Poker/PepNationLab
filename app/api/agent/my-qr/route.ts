
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

    // Referral identifier: username resolves across all roles (apply_signup_referral
    // matches username OR referral_code). Fall back to referral_code, then id.
    const referralCode = (profile.username || profile.referral_code || user.id) as string;

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

    // QR TARGET. Scanning an agent's code must open that agent's STORE - the
    // products and the pricing - never an account-creation screen. `?ref=` is
    // carried on the storefront URL so proxy.ts mints the identical signed
    // referral lock it minted when the QR pointed at `/`; attribution, downline
    // assignment and researcher referral credits are unchanged.
    //
    // Users with no resolvable storefront (researchers, and agents whose
    // agent_profiles row is missing or inactive) have nowhere to send a
    // scanner, so they keep the landing-page target - proxy.ts routes those
    // guests on to the house store for browsing.
    const signupUrl = storefrontSlug
      ? `${baseUrl}/${storefrontSlug}?ref=${encodeURIComponent(referralCode)}`
      : `${baseUrl}/?ref=${encodeURIComponent(referralCode)}`;

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
      qrCodeData: null, // regenerate client-side so the QR encodes the link above
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
