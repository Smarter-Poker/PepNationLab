import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export async function PATCH(request: NextRequest) {
  try {
    // CSRF: state-changing admin route must be same-origin (platform rule).
    const csrf = assertSameOrigin(request);
    if (csrf) return csrf;

    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: adminCheck } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (adminCheck?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const {
      id,
      full_name,
      is_active,
      account_type,
      credit_limit,
      prepaid_balance,
      max_auto_approve_limit
    } = await request.json();

    if (!id) return NextResponse.json({ error: 'Missing agent ID' }, { status: 400 });

    const updates: any = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (is_active !== undefined) updates.is_active = is_active;
    if (account_type !== undefined) {
      updates.account_type = account_type;
      updates.auto_approve_orders = account_type === 'credit';
    }
    
    // Convert to number or null, ensuring safe defaults. Money fields are
    // clamped to >= 0 so a stray negative can never persist a bad balance.
    const nonNeg = (v: number) => (Number.isFinite(v) ? Math.max(0, v) : 0);
    if (credit_limit !== undefined) updates.credit_limit = credit_limit === '' ? null : nonNeg(Number(credit_limit));
    if (prepaid_balance !== undefined) updates.prepaid_balance = prepaid_balance === '' ? 0 : nonNeg(Number(prepaid_balance));
    if (max_auto_approve_limit !== undefined) updates.max_auto_approve_limit = max_auto_approve_limit === '' ? null : nonNeg(Number(max_auto_approve_limit));

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Update agent error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updates });
  } catch (err: any) {
    console.error('Update agent catch:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
