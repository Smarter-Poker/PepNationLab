import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.sub_agent_id) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const adminClient = await createServiceClient();

  // Verify that the requested sub-agent is actually under this user
  const { data: subAgent } = await adminClient
    .from('profiles')
    .select('parent_agent_id')
    .eq('id', body.sub_agent_id)
    .single();

  if (subAgent?.parent_agent_id !== user.id) {
    return NextResponse.json({ error: 'unauthorized_action' }, { status: 403 });
  }

  // Update the sub-agent's profile to dismiss the previous name
  const { error } = await adminClient
    .from('agent_profiles')
    .update({ previous_display_name_dismissed: true })
    .eq('id', body.sub_agent_id);

  if (error) {
    return NextResponse.json({ error: 'failed_to_dismiss' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
