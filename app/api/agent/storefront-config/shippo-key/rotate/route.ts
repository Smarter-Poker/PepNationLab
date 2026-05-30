import { NextResponse, type NextRequest } from 'next/server';
import { requireAgent } from '@/lib/admin-auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = await createServiceClient();
  const { error } = await svc
    .from('agent_profiles')
    .update({ shippo_api_key: null })
    .eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await svc.from('admin_audit_log').insert({
    actor_id: user.id,
    actor_email: user.email ?? null,
    action: 'shippo_key_rotated',
    target_type: 'agent_profile',
    target_id: user.id,
    summary: 'Shippo API key cleared via rotation flow. Agent must re-enter a fresh key.',
    metadata: { rotated_at: new Date().toISOString() },
  });

  return NextResponse.json({ ok: true });
}
