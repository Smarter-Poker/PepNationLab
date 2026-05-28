import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// POST /api/auth/register
// Public endpoint — allows new researchers to self-register via an agent's storefront link.
// The agent_slug ties the new account to the correct referring agent.
export async function POST(req: NextRequest) {
  const supabase = await createServiceClient();

  const body = await req.json().catch(() => ({}));
  const { full_name, username, password, agent_slug } = body;

  if (!full_name || !username || !password || !agent_slug) {
    return NextResponse.json({ error: 'All Fields Are Required' }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Password Must Be At Least 6 Characters' }, { status: 400 });
  }

  const usernameClean = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!usernameClean || usernameClean.length < 2) {
    return NextResponse.json({ error: 'Username Must Be At Least 2 Characters (Letters, Numbers, Underscores)' }, { status: 400 });
  }

  // Validate the agent slug exists and is active
  const { data: agentProfile, error: agentErr } = await supabase
    .from('agent_profiles')
    .select('id')
    .eq('slug', agent_slug)
    .eq('is_active', true)
    .single();

  if (agentErr || !agentProfile) {
    return NextResponse.json({ error: 'Invalid Agent Storefront' }, { status: 400 });
  }

  // The agent_profiles.id IS the agent's user id (profile id)
  const referringAgentId = agentProfile.id;

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

  // Check email uniqueness in auth
  const { data: existingEmail } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', internalEmail)
    .maybeSingle();

  if (existingEmail) {
    return NextResponse.json({ error: 'That Username Is Already Taken' }, { status: 400 });
  }

  // Create the auth user via service role
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: `Account Creation Failed: ${authError?.message ?? 'Unknown Error'}` },
      { status: 500 }
    );
  }

  const newUserId = authData.user.id;

  // Create the profile as researcher, linked to this agent
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: newUserId,
      email: internalEmail,
      username: usernameClean,
      full_name,
      role: 'researcher',
      referring_agent_id: referringAgentId,
      disclaimer_v1_accepted: false,
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
    email: internalEmail,
    full_name,
  });
}
