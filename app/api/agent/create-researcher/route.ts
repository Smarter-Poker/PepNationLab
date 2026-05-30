import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sanitizeUsername } from '@/lib/usernames';
import { assertSameOrigin } from '@/lib/csrf';
import { notifyNewResearcher } from '@/lib/notify';

// POST /api/agent/create-researcher
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

  const { data: agentProfile, error: profileErr } = await admin
    .from('profiles')
    .select('id, role, is_active, full_name')
    .eq('id', user.id)
    .single();

  if (profileErr || !agentProfile) {
    return NextResponse.json({ error: 'Agent Profile Not Found' }, { status: 403 });
  }

  const isAgent = ['agent', 'super_agent', 'admin'].includes(agentProfile.role);
  if (!isAgent || !agentProfile.is_active) {
    return NextResponse.json({ error: 'Only Active Agents Can Create Researcher Accounts' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { full_name, username, password } = body;

  if (!full_name || !username || !password) {
    return NextResponse.json({ error: 'Full Name, Username, And Password Are Required' }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Password Must Be At Least 6 Characters' }, { status: 400 });
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

  // UPSERT (not just UPDATE) — guarantees the profile is written even if the
  // handle_new_user trigger races with this call and the row doesn't exist yet.
  // createAdminClient() bypasses RLS so this always succeeds regardless of policies.
  const { data: upsertedRows, error: profileError } = await admin
    .from('profiles')
    .upsert({
      id: newUserId,
      email: internalEmail,
      username: usernameClean,
      full_name,
      role: 'researcher',
      referring_agent_id: user.id,   // ← Always the creating agent's UUID
      disclaimer_v1_accepted: false,
      is_active: true,
      must_change_password: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select('id, referring_agent_id');

  if (profileError) {
    console.error('[create-researcher] profile upsert error:', profileError);
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: `Profile Setup Failed: ${profileError.message}` },
      { status: 500 }
    );
  }

  // Sanity-check: verify referring_agent_id was actually written
  if (!upsertedRows?.[0]?.referring_agent_id) {
    console.error('[create-researcher] referring_agent_id not set after upsert — rolling back');
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: 'Profile Setup Failed: Could Not Link Researcher To Agent' },
      { status: 500 }
    );
  }

  // Fire-and-forget: notify the agent that a new researcher joined their team
  void notifyNewResearcher(admin, user.id, full_name).catch(() => { /* ignore */ });

  return NextResponse.json({
    success: true,
    userId: newUserId,
    username: usernameClean,
    full_name,
  });
}
