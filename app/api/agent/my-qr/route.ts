
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

    // The QR is now a REFERRAL SIGNUP link: whoever scans it lands on the signup
    // page with this user's referral code prefilled. Signup then applies the
    // referral -- downline assignment for agents/super-agents/sub-agents, and
    // referral credits for researchers (and opted-in sub-agents).
    const isSub = !!profile.is_sub_agent;
    const isSuper = !!profile.is_super_agent || profile.role === 'super_agent';
    const isResearcher = profile.role === 'researcher' && !isSub && !isSuper;

    // Referral identifier: username resolves across all roles (apply_signup_referral
    // matches username OR referral_code). Fall back to referral_code, then id.
    const referralCode = (profile.username || profile.referral_code || user.id) as string;

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')) || 'https://pepnationlab.com';
    const signupUrl = `${baseUrl}/signup?ref=${encodeURIComponent(referralCode)}`;

    // Best-effort: resolve the associated storefront (own for agents/super-agents,
    // parent for sub-agents, referring agent for researchers) so the hub can also
    // offer a storefront link. Never fails the referral QR if it is missing.
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
          .select('slug, display_name, primary_color')
          .eq('id', lookupId)
          .maybeSingle();
        if (aErr) {
          logError('agent.my-qr.agent_query', { userId: user.id, lookupId }, aErr);
        }
        if (agent?.slug) {
          storefrontSlug = agent.slug;
          storefrontUrl = `${baseUrl}/${agent.slug}`;
        }
        if (agent?.display_name) displayName = agent.display_name;
        if (agent?.primary_color) primaryColor = agent.primary_color;
      }
    }

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
      qrCodeData: null, // regenerate client-side so the QR encodes the signup link
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
