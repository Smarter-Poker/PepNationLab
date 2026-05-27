import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com';

// GET: List all agents with their profiles and storefront data
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('*, agent_profiles(slug, is_active)')
    .eq('role', 'agent')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST: Create a brand-new agent directly (no registration required)
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const body = await req.json().catch(() => ({}));

  const {
    full_name,
    username,
    password,
    tier,
    account_type,
    credit_limit,
    prepaid_balance,
    slug,
    display_name,
    tagline,
    bio,
  } = body;

  // Validate required fields
  if (!full_name || !username || !password || !tier || !account_type || !slug || !display_name) {
    return NextResponse.json({ error: 'Missing Required Fields' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password Must Be At Least 8 Characters' }, { status: 400 });
  }

  const usernameClean = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!usernameClean) {
    return NextResponse.json({ error: 'Invalid Username' }, { status: 400 });
  }

  // Internal email used for Supabase auth only — users never see this
  const internalEmail = `${usernameClean}@pepnationlab.com`;

  const slugRegex = /^[a-z0-9\-]+$/;
  if (!slugRegex.test(slug)) {
    return NextResponse.json({ error: 'Slug Must Contain Lowercase Letters, Numbers, And Hyphens Only' }, { status: 400 });
  }

  // Check username uniqueness
  const { data: existingUsername } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', usernameClean)
    .maybeSingle();

  if (existingUsername) {
    return NextResponse.json({ error: 'This Username Is Already Taken' }, { status: 400 });
  }

  // Check slug uniqueness
  const { data: existingSlug } = await supabase
    .from('agent_profiles')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existingSlug) {
    return NextResponse.json({ error: 'This Storefront Slug Is Already Taken' }, { status: 400 });
  }

  // 1. Create the Supabase Auth user using the admin API (service role key)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: `Failed To Create Auth User: ${authError?.message ?? 'Unknown Error'}` },
      { status: 500 }
    );
  }

  const userId = authData.user.id;

  // 2. Upsert the profile (the trigger may have already created a shell row)
  const profileData = {
    id: userId,
    email: internalEmail,
    username: usernameClean,
    full_name,
    role: 'agent',
    tier,
    account_type,
    credit_limit: account_type === 'credit' ? (Number(credit_limit) || null) : null,
    prepaid_balance: account_type === 'prepaid' ? (Number(prepaid_balance) || 0) : 0,
    disclaimer_v1_accepted: true,
    disclaimer_accepted_at: new Date().toISOString(),
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(profileData);

  if (profileError) {
    // Clean up the auth user if profile creation fails
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: `Profile Creation Failed: ${profileError.message}` },
      { status: 500 }
    );
  }

  // 3. Create the agent_profiles storefront record
  const storefrontUrl = `${APP_URL}/${slug}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=00c4bc&bgcolor=0a1018&data=${encodeURIComponent(storefrontUrl)}`;

  const { error: agentError } = await supabase
    .from('agent_profiles')
    .insert({
      id: userId,
      slug,
      display_name,
      tagline: tagline || null,
      bio: bio || null,
      qr_code_url: qrCodeUrl,
      is_active: true,
    });

  if (agentError) {
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: `Storefront Creation Failed: ${agentError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, userId, username: usernameClean });
}
