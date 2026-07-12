// R24 hotfix - Unified "My QR Code" endpoint (bulletproofed).
// Returns the storefront URL the current user should advertise via QR.
// Sub-agents inherit their PARENT agent's storefront and append ?ref=<sub_agent_id>
// so order attribution credits them correctly.
//
// Error reporting: every failure path returns a JSON body with `error` + `message`
// so the modal can show why it failed (rather than a generic "Could Not Load QR").
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { captureError } from '@/lib/sentry';
import { logError } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized', message: 'Please Sign In' }, { status: 401 });

    // CRITICAL: createServiceClient is async - must be awaited.
    const svc = await createServiceClient();

    const { data: profile, error: pErr } = await svc
      .from('profiles')
      .select('id, role, is_super_agent, is_sub_agent, parent_agent_id, referring_agent_id, full_name, username')
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

    // Decide which agent_profile to look up:
    //   - Sub-agents use their parent_agent_id (the super_agent who promoted them)
    //   - Researchers use referring_agent_id
    //   - Agents/super_agents use themselves
    const isSub = !!profile.is_sub_agent || profile.role === 'sub_agent'; // @ts-ignore
    const isResearcher = profile.role === 'researcher';
    let lookupId: string | null = user.id;
    let isInvite = false;
    if (isSub) {
      lookupId = profile.parent_agent_id ?? profile.referring_agent_id ?? null;
      isInvite = true;
    } else if (isResearcher) {
      lookupId = profile.referring_agent_id ?? null;
    }

    if (!lookupId) {
      return NextResponse.json({
        error: 'no_agent',
        message: isSub
          ? 'Your Sub-Agent Account Is Not Linked To A Parent Agent. Contact Your Super-Agent.'
          : 'You Do Not Have An Associated Agent Yet.',
      }, { status: 404 });
    }

    const { data: agent, error: aErr } = await svc
      .from('agent_profiles')
      .select('id, slug, display_name, qr_code_data, primary_color')
      .eq('id', lookupId)
      .maybeSingle();
    if (aErr) {
      logError('agent.my-qr.agent_query', { userId: user.id, lookupId }, aErr);
      captureError(aErr, { context: 'agent.my-qr.agent_query', userId: user.id, lookupId });
      return NextResponse.json({ error: 'agent_query_failed', message: 'Could Not Load The Storefront Profile. Please Try Again.' }, { status: 500 });
    }
    if (!agent) {
      return NextResponse.json({
        error: 'no_agent_profile',
        message: 'No Storefront Profile Exists For That Agent.',
      }, { status: 404 });
    }
    if (!agent.slug) {
      return NextResponse.json({
        error: 'no_storefront_slug',
        message: 'Storefront URL Is Not Yet Set Up. Visit Storefront Settings To Pick A URL Name.',
      }, { status: 404 });
    }

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')) || 'https://pepnationlab.com';
    const path = isInvite ? `/${agent.slug}?ref=${user.id}` : `/${agent.slug}`;
    const fullUrl = `${baseUrl}${path}`;

    return NextResponse.json({
      url: fullUrl,
      slug: agent.slug,
      displayName: agent.display_name ?? null,
      qrCodeData: agent.qr_code_data ?? null,
      primaryColor: agent.primary_color ?? '#C0B8A8',
      isInvite,
      referCode: isInvite ? user.id : null,
      roleLabel: isInvite ? 'My Invite QR' : 'My Storefront QR',
      description: isInvite
        ? 'Anyone Who Scans This Will Register Under You And Their Orders Will Credit You.'
        : 'Customers Who Scan This Will Land On Your Storefront.',
    });
  } catch (e: any) {
    console.error('[/api/agent/my-qr] uncaught:', e?.message, e?.stack);
    return NextResponse.json({
      error: 'unexpected',
      message: process.env.NODE_ENV === 'production' ? 'Unexpected Server Error' : (e?.message ?? 'Unknown'),
    }, { status: 500 });
  }
}
