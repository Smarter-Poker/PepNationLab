// R24 hotfix — Unified "My QR Code" endpoint.
// Returns the storefront URL the current user should advertise via QR.
// Sub-agents inherit their PARENT agent's storefront and append ?ref=<sub_agent_id>
// so order attribution credits them correctly.
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = createServiceClient();
  const { data: profile } = await svc
    .from('profiles')
    .select('id, role, is_super_agent, is_sub_agent, parent_agent_id, referring_agent_id')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'no_profile' }, { status: 404 });

  // Decide which agent_profile to look up:
  //   - Sub-agents use their parent_agent_id (the super_agent who promoted them)
  //   - Researchers use referring_agent_id
  //   - Agents/super_agents use themselves
  let lookupId: string | null = user.id;
  let isInvite = false;
  if (profile.is_sub_agent || profile.role === 'sub_agent') {
    lookupId = profile.parent_agent_id ?? profile.referring_agent_id ?? null;
    isInvite = true;
  } else if (profile.role === 'researcher') {
    lookupId = profile.referring_agent_id ?? null;
  }

  if (!lookupId) {
    return NextResponse.json({ error: 'no_agent', message: 'No Associated Agent Found For Your Account' }, { status: 404 });
  }

  const { data: agent } = await svc
    .from('agent_profiles')
    .select('id, slug, display_name, qr_code_data, primary_color')
    .eq('id', lookupId)
    .maybeSingle();

  if (!agent?.slug) {
    return NextResponse.json({ error: 'no_storefront', message: 'Storefront Not Set Up' }, { status: 404 });
  }

  // Build the absolute URL the QR encodes
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://pepnationlab.com';
  const path = isInvite ? `/${agent.slug}?ref=${user.id}` : `/${agent.slug}`;
  const fullUrl = `${baseUrl}${path}`;

  return NextResponse.json({
    url: fullUrl,
    slug: agent.slug,
    displayName: agent.display_name,
    qrCodeData: agent.qr_code_data ?? null,
    primaryColor: agent.primary_color ?? '#C0B8A8',
    isInvite,
    referCode: isInvite ? user.id : null,
    roleLabel: isInvite ? 'My Invite QR' : 'My Storefront QR',
    description: isInvite
      ? 'Anyone Who Scans This Will Register Under Your Agent And Order Through Your Link.'
      : 'Customers Who Scan This Will Land On Your Storefront.',
  });
}
