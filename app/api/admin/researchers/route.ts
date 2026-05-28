import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { generateQrDataUrl } from '@/lib/qr';

// GET: List all profiles with optional roles and search query
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const searchParams = req.nextUrl.searchParams;
  const role = searchParams.get('role');
  const rawQuery = searchParams.get('query');

  let dbQuery = supabase
    .from('profiles')
    .select('*, agent_profiles(*)');
    // username is fetched via * — it was added in migration 008

  if (role) {
    dbQuery = dbQuery.eq('role', role);
  }

  if (rawQuery) {
    // Sanitize: PostgREST's .or() parses commas and parentheses as syntax.
    // Strip any characters that could break out of the value or be used to
    // smuggle additional filters. Cap the length so an attacker can't blow
    // up the query string.
    const sanitized = rawQuery
      .replace(/[%,():"'\\]/g, '')
      .trim()
      .slice(0, 60);

    if (sanitized) {
      dbQuery = dbQuery.or(
        `full_name.ilike.%${sanitized}%,username.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`
      );
    }
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

  // ── Toggle Active (lightweight — does NOT require slug/display_name) ────────
  if (action === 'toggle_active') {
    if (is_active === undefined) {
      return NextResponse.json({ error: 'Missing is_active Value' }, { status: 400 });
    }
    const { error: toggleError } = await supabase
      .from('profiles')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (toggleError) {
      return NextResponse.json({ error: `Toggle Failed: ${toggleError.message}` }, { status: 500 });
    }

    // If deactivating an agent, also deactivate their storefront
    if (!is_active) {
      await supabase
        .from('agent_profiles')
        .update({ is_active: false })
        .eq('id', id);
    } else {
      // Re-activating: re-enable their storefront if it exists
      await supabase
        .from('agent_profiles')
        .update({ is_active: true })
        .eq('id', id);
    }

    return NextResponse.json({ success: true });
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

    // Generate QR code in-process (no external dependency)
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com';
    const storefrontUrl = `${APP_URL}/${slug}`;
    let qrCodeData: string | null = null;
    try {
      qrCodeData = await generateQrDataUrl(storefrontUrl);
    } catch (qrErr) {
      console.error('QR generation failed:', qrErr);
      qrCodeData = null;
    }

    const agentProfileData = {
      id,
      slug,
      display_name,
      tagline: tagline || null,
      bio: bio || null,
      qr_code_data: qrCodeData,
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

