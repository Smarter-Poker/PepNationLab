import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { generateQrDataUrl } from '@/lib/qr';
import { sanitizeUsername } from '@/lib/usernames';
import { assertSameOrigin } from '@/lib/csrf';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com';

// GET: List all agents with their profiles and storefront data
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('*, agent_profiles(slug, is_active)')
    .in('role', ['agent', 'super_agent'])
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST: Create a brand-new agent or researcher directly (no registration required)
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
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
    account_role = 'agent',
    parent_agent_id,
  } = body;

  const isResearcher = account_role === 'researcher';

  if (!full_name || !username || !password) {
    return NextResponse.json({ error: 'Missing Required Fields' }, { status: 400 });
  }
  if (!isResearcher && (!tier || !account_type || !slug || !display_name)) {
    return NextResponse.json({ error: 'Missing Required Agent Fields (Tier, Billing, Slug, Display Name)' }, { status: 400 });
  }
  if (isResearcher && !parent_agent_id) {
    return NextResponse.json({ error: 'Researcher Accounts Must Be Assigned To An Agent' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password Must Be At Least 8 Characters' }, { status: 400 });
  }

  const usernameClean = sanitizeUsername(username);
  if (!usernameClean) {
    return NextResponse.json({ error: 'Invalid Username' }, { status: 400 });
  }

  const internalEmail = `${usernameClean}@pepnationlab.com`;

  if (!isResearcher) {
    const slugRegex = /^[a-z0-9\-]+$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json({ error: 'Slug Must Contain Lowercase Letters, Numbers, And Hyphens Only' }, { status: 400 });
    }
  }

  const { data: existingUsername } = await supabase.from('profiles').select('id').ilike('username', usernameClean).maybeSingle();
  if (existingUsername) {
    return NextResponse.json({ error: 'This Username Is Already Taken' }, { status: 400 });
  }

  if (!isResearcher && slug) {
    const { data: existingSlug } = await supabase.from('agent_profiles').select('id').eq('slug', slug).maybeSingle();
    if (existingSlug) {
      return NextResponse.json({ error: 'This Storefront Slug Is Already Taken' }, { status: 400 });
    }
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  const userId = authData.user.id;
  const profileRole = account_role === 'super_agent' ? 'agent' : account_role;
  const profileData: Record<string, any> = {
    id: userId,
    email: internalEmail,
    username: usernameClean,
    full_name,
    role: profileRole,
    disclaimer_v1_accepted: true,
    disclaimer_accepted_at: new Date().toISOString(),
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  if (isResearcher) {
    profileData.parent_agent_id = parent_agent_id;
    profileData.referring_agent_id = parent_agent_id;
  } else {
    profileData.tier = tier;
    profileData.account_type = account_type;
    profileData.credit_limit = account_type === 'credit' ? (Number(credit_limit) || null) : null;
    profileData.prepaid_balance = account_type === 'prepaid' ? (Number(prepaid_balance) || 0) : 0;
    profileData.is_super_agent = account_role === 'super_agent';
  }

  const { error: profileError } = await supabase.from('profiles').upsert(profileData);
  if (profileError) {
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  if (!isResearcher) {
    const storefrontUrl = `${APP_URL}/${slug}`;
    let qrCodeData: string | null = null;
    try {
      qrCodeData = await generateQrDataUrl(storefrontUrl);
    } catch (qrErr) {
      console.error('QR generation failed:', qrErr);
      qrCodeData = null;
    }

    const { error: agentError } = await supabase.from('agent_profiles').insert({
      id: userId,
      slug,
      display_name,
      tagline: tagline || null,
      bio: bio || null,
      qr_code_data: qrCodeData,
      is_active: true,
    });

    if (agentError) {
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }
  }

  const roleLabel = isResearcher ? 'Researcher' : account_role === 'super_agent' ? 'Super Agent' : 'Agent';
  return NextResponse.json({ success: true, userId, username: usernameClean, role: roleLabel });
}
