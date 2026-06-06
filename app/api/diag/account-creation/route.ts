import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type StepResult = { name: string; ok: boolean; detail?: string; ms?: number };

function step(name: string, started: number): StepResult {
  return { name, ok: true, ms: Date.now() - started };
}

async function safeDelete(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<void> {
  // Best-effort cleanup - ignore failures, the route must always tear down.
  try { await admin.from('disclaimer_acceptances').delete().eq('user_id', userId); } catch { /* noop */ }
  try { await admin.from('admin_audit_log').delete().eq('entity_id', userId); } catch { /* noop */ }
  try { await admin.from('profiles').delete().eq('id', userId); } catch { /* noop */ }
  try { await admin.auth.admin.deleteUser(userId); } catch { /* noop */ }
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  // Admin gate - only the platform owner runs the diagnostic. We can't use
  // requireAdmin here because that's middleware-bound; we just inline the
  // role check against the caller's profile.
  const userClient = await createClient();
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: caller } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (caller?.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const startedAt = Date.now();
  const steps: StepResult[] = [];
  let createdUserId: string | null = null;
  let failed_at: string | null = null;
  let errorMessage: string | null = null;

  try {
    // STEP 1 - pick an active agent to act as referring_agent_id.
    let s = Date.now();
    const { data: refAgent } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'agent')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (!refAgent?.id) {
      throw new Error('no_active_agent_for_referring_agent_id');
    }
    steps.push({ ...step('pick_referring_agent', s), detail: refAgent.id });

    // STEP 2 - auth.admin.createUser. Fires handle_new_user trigger which
    // inserts a partial profile row. Historically this is where the route
    // fails if SUPABASE_SERVICE_ROLE_KEY is missing in the deploy env.
    s = Date.now();
    const ts = Date.now();
    const username = `__diag_${ts}`;
    const internalEmail = `${username}@internal.auth`;
    const { data: authData, error: authErr2 } = await admin.auth.admin.createUser({
      email: internalEmail,
      password: `DiagPass${ts}!`,
      email_confirm: true,
      user_metadata: { username, full_name: 'Diagnostic Test' },
    });
    if (authErr2 || !authData?.user) {
      throw new Error('auth_admin_createUser_failed: ' + (authErr2?.message ?? 'no user returned'));
    }
    createdUserId = authData.user.id;
    steps.push({ ...step('auth_admin_createUser', s), detail: createdUserId });

    // STEP 3 - verify handle_new_user trigger inserted a partial profile row.
    s = Date.now();
    const { data: triggerRow } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', createdUserId)
      .maybeSingle();
    if (!triggerRow) {
      throw new Error('handle_new_user_trigger_did_not_create_profile_row');
    }
    steps.push({ ...step('verify_trigger_insert', s), detail: `role=${triggerRow.role}` });

    // STEP 4 - upsert the full profile (the historically-broken step that
    // fails when the broken @supabase/ssr-based service client is used).
    s = Date.now();
    const { data: upsertedRows, error: upsertErr } = await admin
      .from('profiles')
      .upsert({
        id: createdUserId,
        username,
        full_name: 'Diagnostic Test',
        first_name: 'Diagnostic',
        last_name: 'Test',
        role: 'researcher',
        referring_agent_id: refAgent.id,
        is_active: true,
        disclaimer_v1_accepted: false,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select('id, referring_agent_id, role');
    if (upsertErr) throw new Error('profile_upsert_failed: ' + upsertErr.message);
    if (!upsertedRows?.[0]) throw new Error('profile_upsert_returned_no_rows');
    steps.push({ ...step('profile_upsert', s) });

    // STEP 5 - read-back to confirm referring_agent_id stuck (it would
    // silently be reverted if a protect_profile_columns-style trigger
    // matched the calling context).
    s = Date.now();
    const written = upsertedRows[0];
    if (written.referring_agent_id !== refAgent.id) {
      throw new Error(
        'referring_agent_id_did_not_stick: expected=' + refAgent.id + ' got=' + (written.referring_agent_id ?? 'null')
      );
    }
    if (written.role !== 'researcher') {
      throw new Error('role_did_not_stick: expected=researcher got=' + written.role);
    }
    steps.push({ ...step('readback_verify', s) });

    // SUCCESS
    await safeDelete(admin, createdUserId);
    steps.push({ name: 'cleanup', ok: true });
    return NextResponse.json({
      ok: true,
      duration_ms: Date.now() - startedAt,
      steps,
    });
  } catch (err: any) {
    errorMessage = err?.message ?? String(err);
    failed_at = steps.length > 0 ? `after_step_${steps[steps.length - 1].name}` : 'pre_first_step';
    if (createdUserId) {
      await safeDelete(admin, createdUserId);
      steps.push({ name: 'cleanup', ok: true, detail: 'rolled back on failure' });
    }
    return NextResponse.json(
      {
        ok: false,
        duration_ms: Date.now() - startedAt,
        failed_at,
        error: errorMessage,
        steps,
      },
      { status: 500 }
    );
  }
}
