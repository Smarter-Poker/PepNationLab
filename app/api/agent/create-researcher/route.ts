import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

// POST /api/agent/create-researcher
// Called by agents to create researcher accounts linked to them.
// This is agent-gated — NOT admin-only.
export async function POST(req: NextRequest) {
  const supabase = await createServiceClient();

  // Verify the caller is an active agent or super_agent
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password Must Be At Least 8 Characters' }, { status: 400 });
  }

  const usernameClean = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!usernameClean || usernameClean.length < 2) {
    return NextResponse.json({ error: 'Username Must Be At Least 2 Characters (Letters, Numbers, Underscores)' }, { status: 400 });
  }

  // Check username uniqueness
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', usernameClean)
    .maybeSingle();

  if (existingUser) {
    return NextResponse.json({ error: 'That Username Is Already Taken' }, { status: 400 });
  }

  const internalEmail = `${usernameClean}@pepnationlab.com`;

  // Create the auth user via service role
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: `Failed To Create Account: ${authError?.message ?? 'Unknown Error'}` },
      { status: 500 }
    );
  }

  const newUserId = authData.user.id;

  // Upsert the profile as researcher, linked to this agent
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: newUserId,
      email: internalEmail,
      username: usernameClean,
      full_name,
      role: 'researcher',
      referring_agent_id: user.id,  // Links researcher to the creating agent
      disclaimer_v1_accepted: false, // Researcher must accept on first login
      is_active: true,
      updated_at: new Date().toISOString(),
    });

  if (profileError) {
    await supabase.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: `Profile Creation Failed: ${profileError.message}` },
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
