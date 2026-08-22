export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';
import { buildDownlineTree, collectAgentIds } from '@/lib/downline';

/**
 * Super Agent Downline Management
 *
 * GET  /api/agent/downline
 *   Returns The Caller's Own Downline Tree (Super Agents Only) Plus The
 *   Assignable Targets: The Caller And Every Active Agent In Their Downline.
 *
 * POST /api/agent/downline  { action: 'reassign_researcher', researcher_id, to_agent_id }
 *   Moves A Researcher Between Owners STRICTLY Inside The Caller's Own
 *   Downline: The Researcher's Current Owner And The Target Must Both Be The
 *   Caller Or An Agent Under The Caller. Uses The Same Sanctioned
 *   admin_reassign_researcher RPC As The Admin Path, So The
 *   referring_agent_id Immutability Guard Stays Enforced For Everything Else.
 */

async function requireSuperAgent(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized. Please Sign In.' }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role, is_super_agent, is_active, deleted_at')
    .eq('id', user.id)
    .maybeSingle();

  const isSuper = !!profile && (profile.is_super_agent === true || profile.role === 'super_agent') && profile.is_active !== false && (profile as { deleted_at?: string | null }).deleted_at == null;
  if (!isSuper) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden. Super Agent Access Is Required.' }, { status: 403 }) };
  }
  return { ok: true, userId: user.id };
}

export async function GET() {
  const gate = await requireSuperAgent();
  if (!gate.ok) return gate.response;

  try {
    const admin = createAdminClient();
    const tree = await buildDownlineTree(admin, gate.userId);
    if (!tree) return NextResponse.json({ error: 'Profile Not Found' }, { status: 404 });

    // Assignable Targets: The Super Agent Themself + Every Active Agent In
    // Their Downline.
    const targets: Array<{ id: string; label: string; is_super_agent: boolean }> = [];
    const walk = (node: typeof tree) => {
      if (node.is_active) {
        targets.push({
          id: node.id,
          label: node.display_name || node.full_name || node.username || 'Agent',
          is_super_agent: node.is_super_agent,
        });
      }
      node.children.forEach(walk);
    };
    walk(tree);

    return NextResponse.json({ tree, targets });
  } catch (err) {
    console.error('[agent/downline] GET error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireSuperAgent();
  if (!gate.ok) return gate.response;

  try {
    const admin = createAdminClient();
    const body = await req.json().catch(() => ({}));
    const { action, researcher_id, to_agent_id } = body as {
      action?: string;
      researcher_id?: string;
      to_agent_id?: string;
    };

    if (action !== 'reassign_researcher') {
      return NextResponse.json({ error: 'Unknown Action' }, { status: 400 });
    }
    if (!researcher_id || typeof researcher_id !== 'string') {
      return NextResponse.json({ error: 'Missing researcher_id' }, { status: 400 });
    }
    if (!to_agent_id || typeof to_agent_id !== 'string') {
      return NextResponse.json({ error: 'Missing to_agent_id' }, { status: 400 });
    }

    // Scope Wall: Both The Researcher's Current Owner And The Target Must Be
    // Inside The Caller's Own Downline (Caller Included).
    const tree = await buildDownlineTree(admin, gate.userId);
    if (!tree) return NextResponse.json({ error: 'Profile Not Found' }, { status: 404 });
    const downlineIds = new Set(collectAgentIds(tree));

    if (!downlineIds.has(to_agent_id)) {
      return NextResponse.json(
        { error: 'Target Must Be You Or An Agent In Your Downline' },
        { status: 403 },
      );
    }

    const { data: researcher } = await admin
      .from('profiles')
      .select('id, role, referring_agent_id')
      .eq('id', researcher_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!researcher || researcher.role !== 'researcher') {
      return NextResponse.json({ error: 'Researcher Not Found' }, { status: 404 });
    }
    if (!researcher.referring_agent_id || !downlineIds.has(researcher.referring_agent_id)) {
      return NextResponse.json(
        { error: 'This Researcher Is Not In Your Downline' },
        { status: 403 },
      );
    }
    if (researcher.referring_agent_id === to_agent_id) {
      return NextResponse.json({ error: 'Researcher Already Belongs To That Account' }, { status: 400 });
    }

    const { data: target } = await admin
      .from('profiles')
      .select('id, role, is_active')
      .eq('id', to_agent_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!target || (target.role !== 'agent' && target.role !== 'super_agent')) {
      return NextResponse.json({ error: 'Target Must Be An Agent Or Super Agent' }, { status: 400 });
    }
    if (target.is_active === false) {
      return NextResponse.json({ error: 'Cannot Assign To A Deactivated Agent' }, { status: 400 });
    }

    const { error: moveErr } = await admin.rpc('admin_reassign_researcher', {
      p_researcher_id: researcher_id,
      p_new_referring_agent_id: to_agent_id,
      p_new_parent_agent_id: to_agent_id,
    });
    if (moveErr) {
      console.error('[agent/downline] reassign rpc failed:', moveErr.message);
      return NextResponse.json({ error: `Reassignment Failed: ${moveErr.message}` }, { status: 500 });
    }

    await admin.from('admin_audit_log').insert({
      actor_id: gate.userId,
      action: 'researcher_reassigned_by_super_agent',
      entity_type: 'profile',
      entity_id: researcher_id,
      changes: { from: researcher.referring_agent_id, to: to_agent_id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[agent/downline] POST error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}
