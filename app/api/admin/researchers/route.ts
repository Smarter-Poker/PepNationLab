import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

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

  if (role) {
    dbQuery = dbQuery.eq('role', role);
    if (role === 'researcher') {
      dbQuery = dbQuery.eq('referring_agent_id', gate.userId);
    }
  } else {
    dbQuery = dbQuery.or(`role.neq.researcher,referring_agent_id.eq.${gate.userId}`);
  }

  if (rawQuery) {
    // P0 1.23: PostgREST .or() injection — sanitize syntax-significant chars.
    const sanitized = rawQuery.replace(/[%,():"'\\]/g, '').trim().slice(0, 60);
    if (sanitized) {
      dbQuery = dbQuery.or(
        `full_name.ilike.%${sanitized}%,username.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`
      );
    }
  }

  dbQuery = dbQuery.order('created_at', { ascending: false });
  const { data, error } = await dbQuery;
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const body = await req.json().catch(() => ({}));

  const { id, action, role, tier, account_type, credit_limit, is_active, slug, display_name, balance_delta, custom_markup_override } = body;
  if (!id) return NextResponse.json({ error: 'Missing User ID' }, { status: 400 });

  // Security: role must be one of the allowed non-admin values.
  // Admin-to-admin promotion is never permitted via this endpoint.
  const ALLOWED_ROLES = new Set(['researcher', 'agent', 'super_agent']);
  if (action !== 'toggle_active' && action !== 'adjust_balance') {
    if (!role || !ALLOWED_ROLES.has(role)) {
      return NextResponse.json(
        { error: 'Invalid Role. Must Be researcher, agent, Or super_agent.' },
        { status: 400 }
      );
    }
  }

  if (action === 'toggle_active') {
    if (is_active === undefined) return NextResponse.json({ error: 'Missing is_active Value' }, { status: 400 });
    const { error: toggleError } = await supabase.from('profiles').update({ is_active, updated_at: new Date().toISOString() }).eq('id', id);
    if (toggleError) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    await supabase.from('agent_profiles').update({ is_active: !!is_active }).eq('id', id);

    // Audit log: account (de)activation is a sensitive admin action.
    await supabase.from('admin_audit_log').insert({
      actor_id: gate.userId,
      action: 'account_active_toggled',
      entity_type: 'profile',
      entity_id: id,
      changes: { is_active: !!is_active },
    });

    return NextResponse.json({ success: true });
  }

  if (action === 'adjust_balance') {
    const delta = Number(balance_delta);
    if (isNaN(delta) || !isFinite(delta)) return NextResponse.json({ error: 'Invalid Balance Amount' }, { status: 400 });
    // Cap single adjustments to ±$10,000 to prevent accidental massive credits.
    if (Math.abs(delta) > 10000) return NextResponse.json({ error: 'Balance Adjustment Exceeds $10,000 Limit' }, { status: 400 });

    const { data: currentProfile, error: fetchError } = await supabase.from('profiles').select('prepaid_balance, full_name').eq('id', id).single();
    if (fetchError) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

    const balanceBefore = Number(currentProfile?.prepaid_balance ?? 0);
    const newBalance = Math.max(0, balanceBefore + delta);

    const { error: balanceError } = await supabase.from('profiles').update({ prepaid_balance: newBalance, updated_at: new Date().toISOString() }).eq('id', id);
    if (balanceError) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

    const txType = delta >= 0 ? 'credit' : 'debit';
    await supabase.from('balance_transactions').insert({
      agent_id: id, type: txType, amount: Math.abs(delta),
      balance_before: balanceBefore, balance_after: newBalance,
      description: delta >= 0 ? `Admin Balance Credit: +$${Math.abs(delta).toFixed(2)}` : `Admin Balance Deduction: -$${Math.abs(delta).toFixed(2)}`,
      reference_type: 'admin_adjustment',
    });

    // Audit log for balance adjustments.
    await supabase.from('admin_audit_log').insert({
      actor_id: gate.userId,
      action: 'balance_adjusted',
      entity_type: 'profile',
      entity_id: id,
      changes: { delta, balance_before: balanceBefore, balance_after: newBalance },
    });

    return NextResponse.json({ success: true, new_balance: newBalance });
  }

  let locked_tier_level = null;
  if (tier) {
    locked_tier_level = parseInt(tier.replace('tier_', ''), 10);
  }

  const profileUpdates: any = {
    role,
    tier: role === 'researcher' ? null : tier,
    locked_tier_level: role === 'researcher' ? null : locked_tier_level,
    fixed_scale_override: role === 'researcher' ? false : true,
    account_type: role === 'researcher' ? null : account_type,
    credit_limit: role === 'researcher' || account_type === 'prepaid' ? null : (credit_limit ? Number(credit_limit) : null),
    custom_markup_override: role === 'researcher' ? null : (custom_markup_override !== undefined ? custom_markup_override : null),
    is_active: is_active !== undefined ? is_active : true,
    updated_at: new Date().toISOString(),
  };

  const { error: profileError } = await supabase.from('profiles').update(profileUpdates).eq('id', id);
  if (profileError) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  // Audit log for profile role changes.
  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'profile_role_updated',
    entity_type: 'profile',
    entity_id: id,
    changes: { role, tier, account_type, credit_limit },
  });

  if (role === 'agent' || role === 'super_agent') {
    if (!slug || !display_name) return NextResponse.json({ error: 'Slug And Display Name Are Required For Agents' }, { status: 400 });
    const slugRegex = /^[a-z0-9\-]+$/;
    if (!slugRegex.test(slug)) return NextResponse.json({ error: 'Slug Must Contain Lowercase Letters, Numbers, And Hyphens Only' }, { status: 400 });
    if (slug.length < 2 || slug.length > 50) return NextResponse.json({ error: 'Slug Length Must Be Between 2 And 50 Characters' }, { status: 400 });

    const { data: existingSlug, error: slugCheckError } = await supabase.from('agent_profiles').select('id').eq('slug', slug).neq('id', id).maybeSingle();
    if (slugCheckError) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    if (existingSlug) return NextResponse.json({ error: 'This Agent Storefront Slug Is Already Taken' }, { status: 400 });

    const agentProfileData = {
      id, slug, display_name,
      is_active: is_active !== undefined ? is_active : true,
      updated_at: new Date().toISOString(),
    };
    const { error: agentError } = await supabase.from('agent_profiles').upsert(agentProfileData);
    if (agentError) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  } else {
    await supabase.from('agent_profiles').update({ is_active: false }).eq('id', id);
  }

  return NextResponse.json({ success: true });
}
