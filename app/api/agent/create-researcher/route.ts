import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sanitizeUsername } from '@/lib/usernames';
import { assertSameOrigin } from '@/lib/csrf';
import { notifyNewResearcher } from '@/lib/notify';

/**
 * POST /api/agent/create-researcher
 *
 * Creates a researcher account tied to the caller's downline.
 *
 * SACA 2026-05-31 - sub-agent callers:
 *   When the caller is a sub-agent (profiles.is_sub_agent=true), the
 *   researcher MUST be filed under the sub-agent's PARENT, not the sub-agent
 *   itself. Sub-agents never have their own storefront and never own the
 *   researcher relationship - they only earn commission on the researcher's
 *   orders. So we stamp:
 *     referring_agent_id     = sub-agent's parent_agent_id  (storefront owner)
 *     referring_sub_agent_id = sub-agent's id              (commission tag)
 *
 *   For agent or super-agent callers (non-sub-agent), behavior is unchanged:
 *     referring_agent_id     = caller.id
 *     referring_sub_agent_id = NULL
 *
 *   Admins can create researchers but the researcher will not have a
 *   storefront owner of record - kept for backwards compatibility with
 *   admin-driven imports.
 *
 * Provisioning attribution (2026-06-01):
 *   created_by_agent_id stamps the actual caller (sub-agent, agent, super
 *   agent, or admin). created_by_role records the caller's role at creation
 *   so the admin dashboard can render "Created By <Role>" without an extra
 *   join to a possibly-changed creator profile.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const userSupabase = await createClient();
  const { data: { user }, error: authErr } = await userSupabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use the true RLS-bypassing admin client for all DB writes
  const admin = createAdminClient();

  const { data: callerProfile, error: profileErr } = await admin
    .from('profiles')
    .select('id, role, is_active, full_name, is_sub_agent, parent_agent_id, is_super_agent')
    .eq('id', user.id)
    .single();

  if (profileErr || !callerProfile) {
    return NextResponse.json({ error: 'Agent Profile Not Found' }, { status: 403 });
  }

  const isAgent = ['agent', 'super_agent', 'admin'].includes(callerProfile.role);
  if (!isAgent || !callerProfile.is_active) {
    return NextResponse.json({ error: 'Only Active Agents Can Create Researcher Accounts' }, { status: 403 });
  }

  // SACA: resolve the storefront owner and commission tag based on caller role.
  // Sub-agent callers must route the researcher under their parent; the
  // researcher stays on the parent's storefront, the sub-agent gets the tag.
  let referringAgentId: string = user.id;
  let referringSubAgentId: string | null = null;

  if (callerProfile.is_sub_agent === true) {
    if (!callerProfile.parent_agent_id) {
      // Defensive: a sub-agent without a parent is an invalid state and would
      // strand the researcher with no storefront owner.
      console.error('[create-researcher] sub-agent caller has no parent_agent_id:', user.id);
      return NextResponse.json(
        { error: 'Sub-Agent Account Is Not Properly Linked. Contact Your Agent.' },
        { status: 400 },
      );
    }
    referringAgentId = callerProfile.parent_agent_id;
    referringSubAgentId = user.id;
  }

  // Provisioning attribution: created_by_role records WHICH KIND of account
  // performed the creation. Sub-agents are still role='agent' in the enum,
  // so check is_sub_agent / is_super_agent to disambiguate for the UI.
  let createdByRole: string = callerProfile.role;
  if (callerProfile.is_sub_agent === true) {
    createdByRole = 'sub_agent';
  } else if (callerProfile.role === 'agent' && callerProfile.is_super_agent === true) {
    createdByRole = 'super_agent';
  }

  const body = await req.json().catch(() => ({}));
  const { full_name, username, password } = body;

  if (!full_name || !username || !password) {
    return NextResponse.json({ error: 'Full Name, Username, And Password Are Required' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password Must Be At Least 8 Characters' }, { status: 400 });
  }

  // sanitizeUsername lowercases + strips non-alphanumeric
  const usernameClean = sanitizeUsername(username);
  if (!usernameClean || usernameClean.length < 2) {
    return NextResponse.json({ error: 'Username Must Be At Least 2 Characters (Letters, Numbers, Underscores)' }, { status: 400 });
  }

  // Check username uniqueness
  const { data: existingUser } = await admin
    .from('profiles')
    .select('id')
    .ilike('username', usernameClean)
    .maybeSingle();

  if (existingUser) {
    return NextResponse.json({ error: 'That Username Is Already Taken' }, { status: 400 });
  }

  // Email is always lowercase (sanitizeUsername lowercases the username)
  const internalEmail = `${usernameClean}@pepnationlab.com`;

  // Create the auth user. The handle_new_user trigger fires and auto-creates
  // a partial profile row. We pass metadata so the trigger sets username + full_name.
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: { username: usernameClean, full_name },
  });

  if (authError || !authData?.user) {
    console.error('[create-researcher] auth.admin.createUser error:', authError);
    return NextResponse.json(
      { error: authError?.message || 'Failed To Create Auth Account' },
      { status: 500 }
    );
  }

  const newUserId = authData.user.id;

  // UPSERT (not just UPDATE) - guarantees the profile is written even if the
  // handle_new_user trigger races with this call and the row doesn't exist yet.
  // createAdminClient() bypasses RLS so this always succeeds regardless of policies.
  const profilePayload: Record<string, unknown> = {
    id: newUserId,
    email: internalEmail,
    username: usernameClean,
    full_name,
    role: 'researcher',
    referring_agent_id: referringAgentId,
    // Provisioning attribution (2026-06-01)
    created_by_agent_id: user.id,
    created_by_role: createdByRole,
    disclaimer_v1_accepted: false,
    is_active: true,
    must_change_password: true,
    updated_at: new Date().toISOString(),
  };
  if (referringSubAgentId) {
    profilePayload.referring_sub_agent_id = referringSubAgentId;
  }

  const { data: upsertedRows, error: profileError } = await admin
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' })
    .select('id, referring_agent_id, referring_sub_agent_id, created_by_agent_id');

  if (profileError) {
    console.error('[create-researcher] profile upsert error:', profileError);
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: `Profile Setup Failed: ${profileError.message}` },
      { status: 500 }
    );
  }

  // Sanity-check: verify referring_agent_id was actually written
  const written = upsertedRows?.[0];
  if (!written?.referring_agent_id || written.referring_agent_id !== referringAgentId) {
    console.error('[create-researcher] referring_agent_id not set correctly after upsert - rolling back');
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: 'Profile Setup Failed: Could Not Link Researcher To Agent' },
      { status: 500 }
    );
  }
  if (referringSubAgentId && written.referring_sub_agent_id !== referringSubAgentId) {
    console.error('[create-researcher] referring_sub_agent_id not set correctly - rolling back');
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: 'Profile Setup Failed: Could Not Tag Sub-Agent Commission' },
      { status: 500 }
    );
  }

  // Audit log for the SACA path so we have proof a sub-agent created
  // a researcher under the parent storefront.
  if (referringSubAgentId) {
    try {
      await admin.from('admin_audit_log').insert({
        actor_id: user.id,
        action: 'researcher_created_by_sub_agent',
        entity_type: 'profiles',
        entity_id: newUserId,
        changes: {
          referring_agent_id: referringAgentId,
          referring_sub_agent_id: referringSubAgentId,
          username: usernameClean,
        },
      });
    } catch (e) {
      console.error('[create-researcher] audit log insert failed (non-fatal):', e);
    }
  }

  // Fire-and-forget: notify the storefront-owning agent (parent for sub-agent
  // callers, caller for regular agents) that a new researcher joined.
  void notifyNewResearcher(admin, referringAgentId, full_name).catch(() => { /* ignore */ });

  return NextResponse.json({
    success: true,
    userId: newUserId,
    username: usernameClean,
    full_name,
    referring_agent_id: referringAgentId,
    referring_sub_agent_id: referringSubAgentId,
    sub_agent_tagged: !!referringSubAgentId,
    created_by_role: createdByRole,
  });
}
