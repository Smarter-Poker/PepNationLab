import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

// GET: List all profiles with optional roles and search query
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const searchParams = req.nextUrl.searchParams;
  const role = searchParams.get('role');
  const query = searchParams.get('query');

  let dbQuery = supabase
    .from('profiles')
    .select('*, agent_profiles(*)');

  if (role) {
    dbQuery = dbQuery.eq('role', role);
  }

  if (query) {
    dbQuery = dbQuery.or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`);
  }

  // Sort by created_at desc
  dbQuery = dbQuery.order('created_at', { ascending: false });

  const { data, error } = await dbQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST: Upgrade a researcher, update an agent's details, or adjust prepaid balance
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const body = await req.json().catch(() => ({}));

  const {
    id,
    action,
    role,
    tier,
    account_type,
    credit_limit,
    is_active,
    slug,
    display_name,
    tagline,
    bio,
    // Balance adjustment fields
    balance_delta,
  } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing User ID' }, { status: 400 });
  }

  // ── Balance Adjustment (separate quick action) ──────────────────────────────
  if (action === 'adjust_balance') {
    const delta = Number(balance_delta);
    if (isNaN(delta)) {
      return NextResponse.json({ error: 'Invalid Balance Amount' }, { status: 400 });
    }

    // Fetch current balance first
    const { data: currentProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('prepaid_balance, full_name')
      .eq('id', id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: `Failed To Fetch Profile: ${fetchError.message}` }, { status: 500 });
    }

    const balanceBefore = Number(currentProfile?.prepaid_balance ?? 0);
    const newBalance = Math.max(0, balanceBefore + delta);

    const { error: balanceError } = await supabase
      .from('profiles')
      .update({ prepaid_balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (balanceError) {
      return NextResponse.json({ error: `Balance Update Failed: ${balanceError.message}` }, { status: 500 });
    }

    // Write full audit trail entry to balance_transactions
    const txType = delta >= 0 ? 'credit' : 'debit';
    await supabase.from('balance_transactions').insert({
      agent_id: id,
      type: txType,
      amount: Math.abs(delta),
      balance_before: balanceBefore,
      balance_after: newBalance,
      description: delta >= 0
        ? `Admin Balance Credit: +$${Math.abs(delta).toFixed(2)}`
        : `Admin Balance Deduction: -$${Math.abs(delta).toFixed(2)}`,
      reference_type: 'admin_adjustment',
    });

    return NextResponse.json({ success: true, new_balance: newBalance });
  }

  // ── Profile / Agent Update ───────────────────────────────────────────────────
  // 1. Update the base profile
  const profileUpdates: any = {
    role,
    tier: role === 'researcher' ? null : tier,
    account_type: role === 'researcher' ? null : account_type,
    credit_limit: role === 'researcher' || account_type === 'prepaid' ? null : (credit_limit ? Number(credit_limit) : null),
    is_active: is_active !== undefined ? is_active : true,
    updated_at: new Date().toISOString(),
  };

  const { error: profileError } = await supabase
    .from('profiles')
    .update(profileUpdates)
    .eq('id', id);

  if (profileError) {
    return NextResponse.json({ error: `Profile Update Failed: ${profileError.message}` }, { status: 500 });
  }

  // 2. If the role is agent or super_agent, upsert agent_profiles
  if (role === 'agent' || role === 'super_agent') {
    if (!slug || !display_name) {
      return NextResponse.json({ error: 'Slug And Display Name Are Required For Agents' }, { status: 400 });
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9\-]+$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json({ error: 'Slug Must Contain Lowercase Letters, Numbers, And Hyphens Only' }, { status: 400 });
    }

    if (slug.length < 2 || slug.length > 50) {
      return NextResponse.json({ error: 'Slug Length Must Be Between 2 And 50 Characters' }, { status: 400 });
    }

    // Check slug uniqueness (excluding current user)
    const { data: existingSlug, error: slugCheckError } = await supabase
      .from('agent_profiles')
      .select('id')
      .eq('slug', slug)
      .neq('id', id)
      .maybeSingle();

    if (slugCheckError) {
      return NextResponse.json({ error: `Slug Check Failed: ${slugCheckError.message}` }, { status: 500 });
    }

    if (existingSlug) {
      return NextResponse.json({ error: 'This Agent Storefront Slug Is Already Taken' }, { status: 400 });
    }

    // Generate dynamic QR code URL
    const storefrontUrl = `https://pepnationlab.com/${slug}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=00c4bc&bgcolor=0a1018&data=${encodeURIComponent(storefrontUrl)}`;

    const agentProfileData = {
      id,
      slug,
      display_name,
      tagline: tagline || null,
      bio: bio || null,
      qr_code_url: qrCodeUrl,
      is_active: is_active !== undefined ? is_active : true,
      updated_at: new Date().toISOString(),
    };

    const { error: agentError } = await supabase
      .from('agent_profiles')
      .upsert(agentProfileData);

    if (agentError) {
      return NextResponse.json({ error: `Agent Profile Update Failed: ${agentError.message}` }, { status: 500 });
    }
  } else {
    // If downgraded back to researcher, deactivate agent profile if it exists
    await supabase
      .from('agent_profiles')
      .update({ is_active: false })
      .eq('id', id);
  }

  return NextResponse.json({ success: true });
}

