export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireManufacturer } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

/**
 * POST /api/manufacturer/agents/[id]/toggle-active
 * Activates or deactivates an agent in the manufacturer's downline.
 * Body: { is_active: boolean }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireManufacturer();
  if (!gate.ok) return gate.response;

  const manufacturerId = gate.user.id;
  const { id: agentId } = await params;

  if (!agentId) return NextResponse.json({ error: 'Missing agent ID' }, { status: 400 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { is_active } = body ?? {};
  if (typeof is_active !== 'boolean') {
    return NextResponse.json({ error: 'is_active must be a boolean' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Scope check — must be in manufacturer's downline
  const { data: target } = await supabase
    .from('profiles')
    .select('id, parent_agent_id, role, full_name')
    .eq('id', agentId)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  if (target.parent_agent_id !== manufacturerId) {
    return NextResponse.json({ error: 'You can only manage agents in your own network' }, { status: 403 });
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', agentId);

  if (error) {
    console.error('[manufacturer/toggle-active]', error);
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: manufacturerId,
    action: is_active ? 'manufacturer_agent_activated' : 'manufacturer_agent_deactivated',
    entity_type: 'profiles',
    entity_id: agentId,
    changes: { is_active, target_name: target.full_name },
  }).catch(() => { /* non-fatal */ });

  return NextResponse.json({ success: true, is_active });
}
