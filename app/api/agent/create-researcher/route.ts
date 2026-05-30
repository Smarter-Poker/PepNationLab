import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { sanitizeUsername } from '@/lib/usernames';
import { assertSameOrigin } from '@/lib/csrf';

// POST /api/agent/create-researcher
// Called by agents to create researcher accounts linked to them.
// This is agent-gated — NOT admin-only.
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  // IMPORTANT: Must use createClient() (anon key + cookies) to read the
  // caller's session. createServiceClient() uses the service role key and
  // ignores user session cookies, causing getUser() to always return null.
  const userSupabase = await createClient();
  const { data: { user }, error: authErr } = await userSupabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use service client for all DB operations (bypasses RLS)
  const supabase = await createServiceClient();

  const { data: agentProfile, error: profileErr } = await supabase
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

  const usernameClean = sanitizeUsername(username);
  if (!usernameClean || usernameClean.length < 2) {
    return NextResponse.json({ error: 'Username Must Be At Least 2 Characters (Letters, Numbers, Underscores)' }, { status: 400 });
  }

  // Check username uniqueness
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', usernameClean)
    .maybeSingle();

  if (existingUser) {
    return NextResponse.json({ error: 'That Username Is Already Taken' }, { status: 400 });
  }

  const internalEmail = `${usernameClean}@pepnationlab.com`;

  // Create the auth user via service role.
  // The handle_new_user trigger fires AFTER INSERT on auth.users and automatically
  // creates the profile row. We pass username + full_name in user_metadata so the
  // trigger sets them correctly on the auto-created row.
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: {
      username: usernameClean,
      full_name,
    },
  });

  if (authError || !authData?.user) {
    console.error('[create-researcher] auth.admin.createUser error:', authError);
    return NextResponse.json(
      { error: 'Failed To Create Auth Account.' },
      { status: 500 }
    );
  }

  const newUserId = authData.user.id;

  // The trigger already created the profile row. Use UPDATE (not upsert/insert)
  // to set the remaining fields the trigger doesn't know about.
  // Using update() avoids any INSERT conflict with the trigger-created row.
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      username: usernameClean,
      full_name,
      role: 'researcher',
      referring_agent_id: user.id,
      disclaimer_v1_accepted: false,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', newUserId);

  if (profileError) {
    console.error('[create-researcher] profile update error:', profileError);
    // Roll back: delete the auth user we just created
    await supabase.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: 'Profile Setup Failed.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    userId: newUserId,
    username: usernameClean,
    full_name,
  });
}
