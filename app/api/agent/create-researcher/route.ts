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
    .maybeSingle();

  if (profileErr || !callerProfile) {
    return NextResponse.json({ error: 'Agent Profile Not Found' }, { status: 403 });
  }

  const isAgent = ['agent', 'super_agent', 'admin'].includes(callerProfile.role);
  if (!isAgent || !callerProfile.is_active) {
    return NextResponse.json({ error: 'Only Active Agents Can Create Researcher Accounts' }, { status: 403 });
  }

  let referringAgentId: string = user.id;
  let referringSubAgentId: string | null = null;

  if (callerProfile.is_sub_agent === true) {
    if (!callerProfile.parent_agent_id) {
      console.error('[create-researcher] sub-agent caller has no parent_agent_id:', user.id);
      return NextResponse.json(
        { error: 'Sub-Agent Account Is Not Properly Linked. Contact Your Agent.' },
        { status: 400 },
      );
    }
    referringAgentId = callerProfile.parent_agent_id;
    referringSubAgentId = user.id;
  }

  let createdByRole: string = callerProfile.role;
  if (callerProfile.is_sub_agent === true) {
    createdByRole = 'sub_agent';
  } else if (callerProfile.role === 'agent' && callerProfile.is_super_agent === true) {
    createdByRole = 'super_agent';
  }

  const body = await req.json().catch(() => ({}));
  const { username, password, firstName, lastName, phone } = body || {};

  if (!username || !password || !firstName || !lastName) {
    return NextResponse.json({ error: 'Username, Password, First Name, And Last Name Are Required.' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password Must Be At Least 8 Characters' }, { status: 400 });
  }

  const usernameClean = sanitizeUsername(username);
  if (!usernameClean || usernameClean.length < 2) {
    return NextResponse.json({ error: 'Username Must Be At Least 2 Characters (Letters, Numbers, Underscores)' }, { status: 400 });
  }

  const { data: existingUser } = await admin
    .from('profiles')
    .select('id')
    .ilike('username', usernameClean)
    .maybeSingle();

  if (existingUser) {
    return NextResponse.json({ error: 'That Username Is Already Taken' }, { status: 400 });
  }

  const internalEmail = `${usernameClean}@internal.auth`;

  const fullName = `${String(firstName).trim()} ${String(lastName).trim()}`;

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: { username: usernameClean, full_name: fullName },
  });

  if (authError || !authData?.user) {
    console.error('[create-researcher] auth.admin.createUser error:', authError);
    return NextResponse.json(
      { error: authError?.message || 'Failed To Create Auth Account' },
      { status: 500 }
    );
  }

  const newUserId = authData.user.id;

  const profilePayload: Record<string, unknown> = {
    id: newUserId,
    email: null,
    username: usernameClean,
    full_name: fullName,
    first_name: String(firstName).trim(),
    last_name: String(lastName).trim(),
    role: 'researcher',
    referring_agent_id: referringAgentId,
    created_by_agent_id: user.id,
    created_by_role: createdByRole,
    disclaimer_v1_accepted: false,
    is_active: true,
    must_change_password: true,
    provisioned_password: password,
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
          full_name: fullName,
          first_name: String(firstName).trim(),
          last_name: String(lastName).trim(),
        },
      });
    } catch (e) {
      console.error('[create-researcher] audit log insert failed (non-fatal):', e);
    }
  }

  await notifyNewResearcher(admin, referringAgentId, fullName).catch(() => { /* ignore */ });

  return NextResponse.json({
    success: true,
    userId: newUserId,
    username: usernameClean,
    full_name: fullName,
    referring_agent_id: referringAgentId,
    referring_sub_agent_id: referringSubAgentId,
    sub_agent_tagged: !!referringSubAgentId,
    created_by_role: createdByRole,
  });
}
