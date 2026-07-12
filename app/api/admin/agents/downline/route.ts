export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { buildDownlineTree } from '@/lib/downline';
import { safeError } from '@/lib/api-error';

/**
 * GET /api/admin/agents/downline?rootId=<uuid>  (Admin Only)
 *
 * Returns The Full Downline Tree Rooted At Any Agent Or Super Agent, Plus The
 * List Of Every Assignable Owner On The Platform (For The Move Dropdowns):
 * Researchers May Move To Any Active Agent Or Super Agent; Agents May Move
 * Under Any Super Agent Or Become Independent.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const rootId = req.nextUrl.searchParams.get('rootId') ?? '';
  if (!rootId) return NextResponse.json({ error: 'Missing rootId' }, { status: 400 });

  try {
    const admin = createAdminClient();
    const tree = await buildDownlineTree(admin, rootId);
    if (!tree) return NextResponse.json({ error: 'Agent Not Found' }, { status: 404 });

    const { data: owners } = await admin
      .from('profiles')
      .select('id, username, full_name, role, is_super_agent, is_sub_agent, is_active')
      .in('role', ['agent', 'super_agent'])
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    return NextResponse.json({
      tree,
      owners: (owners ?? []).map((o) => ({
        id: o.id,
        label: o.full_name || o.username || 'Agent',
        username: o.username ?? null,
        is_super_agent: o.is_super_agent === true || o.role === 'super_agent',
        is_sub_agent: o.is_sub_agent === true,
      })),
    });
  } catch (err) {
    console.error('[admin/agents/downline] GET error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}

/**
 * POST /api/admin/agents/downline  (Admin Only)
 *
 * action = 'reassign_agent': Move An Agent Under A Different Super Agent,
 * Under A Regular Agent (Becoming A Sub-Agent), Or Make It Independent
 * (new_parent_id = '__NONE__'). Super Agents Themselves Are Top-Level And
 * Cannot Be Moved Under Anyone.
 *
 * Researcher Moves Use The Existing POST /api/admin/researchers
 * (action = 'assign_researcher'), Which Already Accepts Any Agent Or Super
 * Agent As The Target.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const admin = createAdminClient();
    const body = await req.json().catch(() => ({}));
    const { action, agent_id, new_parent_id } = body as {
      action?: string;
      agent_id?: string;
      new_parent_id?: string;
    };

    if (action !== 'reassign_agent') {
      return NextResponse.json({ error: 'Unknown Action' }, { status: 400 });
    }
    if (!agent_id || typeof agent_id !== 'string') {
      return NextResponse.json({ error: 'Missing agent_id' }, { status: 400 });
    }
    if (!new_parent_id || typeof new_parent_id !== 'string') {
      return NextResponse.json({ error: 'Missing new_parent_id' }, { status: 400 });
    }
    if (new_parent_id === agent_id) {
      return NextResponse.json({ error: 'An Agent Cannot Be Assigned Under Itself' }, { status: 400 });
    }

    // The Moving Profile Must Be A Regular Agent. Super Agents Are Top-Level.
    const { data: moving } = await admin
      .from('profiles')
      .select('id, role, is_super_agent, is_sub_agent, full_name, username')
      .eq('id', agent_id)
      .maybeSingle();
    if (!moving || (moving.role !== 'agent' && moving.role !== 'super_agent')) {
      return NextResponse.json({ error: 'Agent Not Found' }, { status: 404 });
    }
    if (moving.is_super_agent === true || moving.role === 'super_agent') {
      return NextResponse.json(
        { error: 'Super Agents Are Top-Level Accounts And Cannot Be Moved Under Another Agent' },
        { status: 400 },
      );
    }

    // Does The Moving Agent Have Its Own Downline Agents?
    const { count: childCount } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('parent_agent_id', agent_id);
    const hasChildren = (childCount ?? 0) > 0;

    let updates: Record<string, unknown>;

    if (new_parent_id === '__NONE__') {
      updates = { parent_agent_id: null, is_sub_agent: false };
    } else {
      const { data: parent } = await admin
        .from('profiles')
        .select('id, role, is_super_agent, is_sub_agent, is_active, parent_agent_id')
        .eq('id', new_parent_id)
        .maybeSingle();
      if (!parent || (parent.role !== 'agent' && parent.role !== 'super_agent')) {
        return NextResponse.json({ error: 'Target Owner Must Be An Agent Or Super Agent' }, { status: 400 });
      }
      if (parent.is_active === false) {
        return NextResponse.json({ error: 'Cannot Assign Under A Deactivated Account' }, { status: 400 });
      }
      if (parent.parent_agent_id === agent_id) {
        return NextResponse.json({ error: 'Cannot Assign An Agent Under Its Own Downline' }, { status: 400 });
      }

      const parentIsSuper = parent.is_super_agent === true || parent.role === 'super_agent';
      if (parentIsSuper) {
        // Downline Agent Under A Super Agent.
        updates = { parent_agent_id: new_parent_id, is_sub_agent: false };
      } else {
        // Under A Regular Agent The Moving Account Becomes A Sub-Agent.
        // Database Triggers Forbid Nesting, So An Agent That Has Its Own
        // Downline Cannot Become A Sub-Agent.
        if (parent.is_sub_agent === true) {
          return NextResponse.json({ error: 'Sub-Agents Cannot Own Sub-Agents' }, { status: 400 });
        }
        if (hasChildren) {
          return NextResponse.json(
            { error: 'This Agent Has Its Own Downline And Can Only Be Moved Under A Super Agent Or Made Independent' },
            { status: 400 },
          );
        }
        updates = { parent_agent_id: new_parent_id, is_sub_agent: true };
      }
    }

    const { error: moveErr } = await admin
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', agent_id);
    if (moveErr) {
      return safeError('admin.agents.downline.reassign', moveErr, 500, 'Reassignment Failed. Please Try Again Or Contact Support.');
    }

    await admin.from('admin_audit_log').insert({
      actor_id: gate.userId,
      action: 'agent_reassigned',
      entity_type: 'profile',
      entity_id: agent_id,
      changes: { new_parent_id: new_parent_id === '__NONE__' ? null : new_parent_id, ...updates },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/agents/downline] POST error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}
