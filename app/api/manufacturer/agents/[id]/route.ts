import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireManufacturer } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireManufacturer();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing agent ID' }, { status: 400 });

  let body: { tier?: string; commission_pct?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Ensure this agent belongs to the manufacturer
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, parent_agent_id')
    .eq('id', id)
    .maybeSingle();

  if (!profile || profile.parent_agent_id !== gate.user.id) {
    return NextResponse.json({ error: 'Agent not found or unauthorized' }, { status: 404 });
  }

  const updates: Record<string, any> = {};
  if (body.tier !== undefined) {
    updates.tier = body.tier;
    updates.locked_tier_level = body.tier ? parseInt(body.tier.replace('tier_', ''), 10) : null;
    updates.fixed_scale_override = true;
  }
  if (body.commission_pct !== undefined) {
    updates.commission_pct = body.commission_pct !== null ? Number(body.commission_pct) : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('[manufacturer/agents PATCH]', error);
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }

  // Audit log
  try {
    await supabase.from('admin_audit_log').insert({
      actor_id: gate.user.id,
      action: 'manufacturer_updated_agent',
      entity_type: 'profile',
      entity_id: id,
      changes: updates,
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ success: true });
}
