import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || !body.sub_agent_id) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  try {
    const adminClient = await createAdminClient();
    const { data: subAgent } = await adminClient.from('profiles').select('parent_agent_id').eq('id', body.sub_agent_id).maybeSingle();
    if (subAgent?.parent_agent_id !== user.id) return NextResponse.json({ error: 'unauthorized_action' }, { status: 403 });
    const { error } = await adminClient.from('agent_profiles').update({ previous_display_name_dismissed: true }).eq('id', body.sub_agent_id);
    if (error) return NextResponse.json({ error: 'failed_to_dismiss' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[sub-agents/dismiss-name] PATCH error:', err);
    return NextResponse.json({ error: 'Failed To Dismiss Name Change' }, { status: 500 });
  }
}