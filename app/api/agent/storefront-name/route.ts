import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireAgentOrAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;
  const user = gate.user;
  const body = await req.json().catch(() => null);
  if (!body || !body.user_name) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  const newName = String(body.user_name).trim();
  if (newName.length < 2) return NextResponse.json({ error: 'Name must be at least 2 characters.' }, { status: 400 });
  try {
    const adminClient = await createServiceClient();
    const { data: currentProfile, error: fetchErr } = await adminClient.from('agent_profiles').select('display_name, display_name_changed_at').eq('id', user.id).maybeSingle();
    if (fetchErr || !currentProfile) return NextResponse.json({ error: 'profile_not_found' }, { status: 404 });
    if (currentProfile.display_name === newName) return NextResponse.json({ success: true, changed: false });
    if (currentProfile.display_name_changed_at) {
      const lastChange = new Date(currentProfile.display_name_changed_at).getTime();
      if (Date.now() - lastChange < 180 * 24 * 60 * 60 * 1000) return NextResponse.json({ error: 'You can only change your User Name once every 6 months.' }, { status: 403 });
    }
    const { data: existing } = await adminClient.from('agent_profiles').select('id').eq('display_name', newName).neq('id', user.id).maybeSingle();
    if (existing) return NextResponse.json({ error: 'User Name Is Already Taken - Try Another.' }, { status: 409 });
    const { error: updateErr } = await adminClient.from('agent_profiles').update({ display_name: newName, previous_display_name: currentProfile.display_name, display_name_changed_at: new Date().toISOString(), previous_display_name_dismissed: false }).eq('id', user.id);
    if (updateErr) return NextResponse.json({ error: 'Failed to update User Name.' }, { status: 500 });
    const { data: userProfile } = await adminClient.from('profiles').select('parent_agent_id').eq('id', user.id).maybeSingle();
    if (userProfile?.parent_agent_id) {
      await adminClient.from('notifications').insert({ user_id: userProfile.parent_agent_id, type: 'system', title: 'Sub-Agent Name Change', body: `Your sub-agent "${currentProfile.display_name}" is now known as "${newName}".`, url: '/dashboard/agent/sub-agents' });
    }
    return NextResponse.json({ success: true, changed: true, display_name_changed_at: new Date().toISOString() });
  } catch (err) {
    console.error('[storefront-name] POST error:', err);
    return NextResponse.json({ error: 'Failed To Update Storefront Name' }, { status: 500 });
  }
}
