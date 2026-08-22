
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Scenario = {
  role_label: 'admin' | 'super_agent' | 'agent' | 'sub_agent';
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  caller_id?: string;
  caller_username?: string;
  expected_referring_agent_id?: string;
  expected_referring_sub_agent_id?: string | null;
  steps?: { name: string; ok: boolean; detail?: string }[];
  error?: string;
};

async function safeDelete(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<void> {
  try { await admin.from('disclaimer_acceptances').delete().eq('user_id', userId); } catch { /* noop */ }
  try { await admin.from('admin_audit_log').delete().eq('entity_id', userId); } catch { /* noop */ }
  try { await admin.from('profiles').delete().eq('id', userId); } catch { /* noop */ }
  try { await admin.auth.admin.deleteUser(userId); } catch { /* noop */ }
}

/**
 * Run a single role scenario. Mirrors EXACTLY what /api/agent/create-researcher
 * does for a caller of that role. If this passes, that role's HTTP route works.
 */
async function runScenario(
  admin: ReturnType<typeof createAdminClient>,
  caller: {
    id: string;
    role: string;
    is_super_agent: boolean;
    is_sub_agent: boolean;
    parent_agent_id: string | null;
    username: string;
  },
  role_label: Scenario['role_label'],
): Promise<Scenario> {
  const scenario: Scenario = {
    role_label,
    ok: false,
    caller_id: caller.id,
    caller_username: caller.username,
    steps: [],
  };

  // Compute role-derived attribution exactly as the route does
  let referring_agent_id = caller.id;
  let referring_sub_agent_id: string | null = null;
  let created_by_role: string = caller.role;
  if (caller.is_sub_agent) {
    if (!caller.parent_agent_id) {
      scenario.error = 'sub-agent has no parent_agent_id (invalid state)';
      return scenario;
    }
    referring_agent_id = caller.parent_agent_id;
    referring_sub_agent_id = caller.id;
    created_by_role = 'sub_agent';
  } else if (caller.role === 'agent' && caller.is_super_agent) {
    created_by_role = 'super_agent';
  }
  scenario.expected_referring_agent_id = referring_agent_id;
  scenario.expected_referring_sub_agent_id = referring_sub_agent_id;

  let userId: string | null = null;
  try {
    // STEP 1: auth.admin.createUser
    const ts = Date.now();
    const username = `__diag_${role_label}_${ts}`;
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email: `${username}@internal.auth`,
      password: `DiagPass${ts}!`,
      email_confirm: true,
      user_metadata: { username, full_name: `Diag ${role_label}` },
    });
    if (authErr || !authData?.user) {
      scenario.error = 'auth.admin.createUser failed: ' + (authErr?.message ?? 'no user');
      return scenario;
    }
    userId = authData.user.id;
    scenario.steps!.push({ name: 'auth_createUser', ok: true, detail: userId });

    // STEP 2: verify handle_new_user trigger inserted partial profile
    const { data: triggerRow } = await admin.from('profiles').select('id, role').eq('id', userId).maybeSingle();
    if (!triggerRow) {
      scenario.error = 'handle_new_user trigger did not insert partial profile';
      return scenario;
    }
    scenario.steps!.push({ name: 'trigger_inserted', ok: true, detail: `role=${triggerRow.role}` });

    // STEP 3: upsert profile with role-specific attribution
    const payload: Record<string, unknown> = {
      id: userId,
      username,
      full_name: `Diag ${role_label}`,
      first_name: 'Diag',
      last_name: role_label,
      role: 'researcher',
      referring_agent_id,
      created_by_agent_id: caller.id,
      created_by_role,
      is_active: true,
      must_change_password: false,
      disclaimer_v1_accepted: false,
      updated_at: new Date().toISOString(),
    };
    if (referring_sub_agent_id) payload.referring_sub_agent_id = referring_sub_agent_id;

    const { data: upserted, error: upsertErr } = await admin
      .from('profiles')
      //  Database schema mismatch from generated types
      .upsert(payload, { onConflict: 'id' })
      .select('id, referring_agent_id, referring_sub_agent_id, role, created_by_role');
    if (upsertErr) {
      scenario.error = 'profile upsert failed: ' + upsertErr.message;
      return scenario;
    }
    scenario.steps!.push({ name: 'profile_upsert', ok: true });

    // STEP 4: read-back assertions
    const written = upserted?.[0];
    if (!written) {
      scenario.error = 'profile upsert returned no rows';
      return scenario;
    }
    if (written.referring_agent_id !== referring_agent_id) {
      scenario.error = `referring_agent_id mismatch: expected=${referring_agent_id} got=${written.referring_agent_id ?? 'null'}`;
      return scenario;
    }
    if (referring_sub_agent_id && written.referring_sub_agent_id !== referring_sub_agent_id) {
      scenario.error = `referring_sub_agent_id mismatch: expected=${referring_sub_agent_id} got=${written.referring_sub_agent_id ?? 'null'}`;
      return scenario;
    }
    if (written.role !== 'researcher') {
      scenario.error = `role did not stick: expected=researcher got=${written.role}`;
      return scenario;
    }
    if (written.created_by_role !== created_by_role) {
      scenario.error = `created_by_role mismatch: expected=${created_by_role} got=${written.created_by_role ?? 'null'}`;
      return scenario;
    }
    scenario.steps!.push({ name: 'readback_assertions', ok: true });

    scenario.ok = true;
    return scenario;
  } catch (e: any) {
    scenario.error = e?.message ?? String(e);
    return scenario;
  } finally {
    if (userId) await safeDelete(admin, userId);
  }
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  // Admin gate - only admins should be probing the live create-researcher flow.
  const userClient = await createClient();
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const startedAt = Date.now();
  const scenarios: Record<string, Scenario> = {};

  // Pick one real account of each role to act as the "caller" for that scenario.
  // If a role has no eligible account in the DB, we mark that scenario as skipped
  // and report it - but don't fail the overall run.

  // ADMIN - use the calling admin themselves
  const { data: adminP } = await admin
    .from('profiles')
    .select('id, role, is_super_agent, is_sub_agent, parent_agent_id, username')
    .eq('role', 'admin').eq('is_active', true).limit(1).maybeSingle();
  if (adminP) {
    scenarios.admin = await runScenario(admin, adminP as any, 'admin');
  } else {
    scenarios.admin = { role_label: 'admin', ok: false, skipped: true, reason: 'no active admin profile found' };
  }

  // SUPER_AGENT
  const { data: superP } = await admin
    .from('profiles')
    .select('id, role, is_super_agent, is_sub_agent, parent_agent_id, username')
    .eq('role', 'agent').eq('is_super_agent', true).eq('is_active', true).limit(1).maybeSingle();
  if (superP) {
    scenarios.super_agent = await runScenario(admin, superP as any, 'super_agent');
  } else {
    scenarios.super_agent = { role_label: 'super_agent', ok: false, skipped: true, reason: 'no active super_agent profile found' };
  }

  // AGENT (regular, non-super, non-sub)
  const { data: agentP } = await admin
    .from('profiles')
    .select('id, role, is_super_agent, is_sub_agent, parent_agent_id, username')
    .eq('role', 'agent').eq('is_super_agent', false).eq('is_sub_agent', false).eq('is_active', true).limit(1).maybeSingle();
  if (agentP) {
    scenarios.agent = await runScenario(admin, agentP as any, 'agent');
  } else {
    scenarios.agent = { role_label: 'agent', ok: false, skipped: true, reason: 'no active regular agent profile found' };
  }

  // SUB_AGENT
  const { data: subP } = await admin
    .from('profiles')
    .select('id, role, is_super_agent, is_sub_agent, parent_agent_id, username')
    .eq('is_sub_agent', true).eq('is_active', true).limit(1).maybeSingle();
  if (subP) {
    scenarios.sub_agent = await runScenario(admin, subP as any, 'sub_agent');
  } else {
    scenarios.sub_agent = { role_label: 'sub_agent', ok: false, skipped: true, reason: 'no active sub_agent profile found' };
  }

  // Overall verdict - pass if every role that COULD be tested passed.
  const failures = Object.values(scenarios).filter((s) => !s.ok && !s.skipped);
  const allOk = failures.length === 0;

  return NextResponse.json(
    {
      ok: allOk,
      duration_ms: Date.now() - startedAt,
      failed_scenarios: failures.map((s) => s.role_label),
      scenarios,
    },
    { status: allOk ? 200 : 500 },
  );
}
