import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * fix-57 #1: Reparent an agent under a different parent agent (or to null = root).
 *
 * Cycle guard: we fetch the downline of agentId via fn_admin_downline_tree
 * and reject if parentAgentId appears among the descendants - otherwise the
 * tree would form a loop.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const agentId = String(body.agentId ?? '').trim();
  const parentAgentId = body.parentAgentId == null ? null : String(body.parentAgentId).trim();

  if (!UUID_RE.test(agentId)) return NextResponse.json({ error: 'Invalid agentId' }, { status: 400 });
  if (parentAgentId !== null && !UUID_RE.test(parentAgentId)) {
    return NextResponse.json({ error: 'Invalid parentAgentId' }, { status: 400 });
  }
  if (parentAgentId === agentId) {
    return NextResponse.json({ error: 'Agent Cannot Be Its Own Parent' }, { status: 400 });
  }

  const svc = createAdminClient();

  // Confirm agentId is an agent / super_agent
  const { data: agent } = await svc
    .from('profiles')
    .select('id, role, parent_agent_id, full_name')
    .eq('id', agentId)
    .maybeSingle();
  if (!agent || (agent.role !== 'agent' && agent.role !== 'super_agent')) {
    return NextResponse.json({ error: 'agentId Must Be An Agent Or Super Agent' }, { status: 400 });
  }

  // Confirm new parent is valid (or null)
  if (parentAgentId !== null) {
    // Trivial self-cycle: an agent cannot be its own parent.
    if (parentAgentId === agentId) {
      return NextResponse.json({ error: 'An Agent Cannot Be Its Own Parent.' }, { status: 400 });
    }

    const { data: parent } = await svc
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', parentAgentId)
      .maybeSingle();
    if (!parent || (parent.role !== 'agent' && parent.role !== 'super_agent')) {
      return NextResponse.json({ error: 'parentAgentId Must Be An Agent Or Super Agent' }, { status: 400 });
    }

    // Cycle prevention: new parent must NOT be a descendant of agentId.
    const { data: tree } = await svc.rpc('fn_admin_downline_tree', { p_days: 1 });
    const desc = new Set<string>();
    if (Array.isArray(tree)) {
      // Anyone whose path starts with agentId (i.e. is in agentId's subtree).
      for (const r of tree as Array<{ id: string; path: string }>) {
        if (r.id === agentId) continue;
        if (r.path === agentId || r.path.startsWith(agentId + '/') || r.path.includes('/' + agentId + '/') || r.path.endsWith('/' + agentId)) {
          desc.add(r.id);
        }
      }
    }
    if (desc.has(parentAgentId)) {
      return NextResponse.json({ error: 'Cycle Detected: parentAgentId Is A Descendant Of agentId' }, { status: 400 });
    }
  }

  // Perform the update
  const { error: updateErr } = await svc
    .from('profiles')
    .update({ parent_agent_id: parentAgentId })
    .eq('id', agentId);
  if (updateErr) {
    console.error('[reparent] Failed to update parent_agent_id:', updateErr);
    return NextResponse.json({ error: 'Failed To Update Agent Parent' }, { status: 500 });
  }

  // Audit log
  try {
    await svc.from('admin_audit_log').insert({
      actor_id: admin.userId,
      action: 'agent_reparented',
      entity_type: 'profile',
      entity_id: agentId,
      changes: {
        from_parent_id: agent.parent_agent_id ?? null,
        to_parent_id: parentAgentId,
      },
    });
  } catch {
    // Audit failure shouldn't block the reparent
  }

  return NextResponse.json({ success: true });
}
