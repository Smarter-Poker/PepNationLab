import { NextRequest, NextResponse } from 'next/server';
import { safeError } from '@/lib/api-error';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export async function PATCH(request: NextRequest) {
  try {
    // CSRF: state-changing admin route must be same-origin (platform rule).
    const csrf = assertSameOrigin(request);
    if (csrf) return csrf;

    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    const supabase = createAdminClient();

    const {
      id,
      full_name,
      is_active,
      account_type,
      credit_limit,
      prepaid_balance,
      max_auto_approve_limit
    } = await request.json();

    if (!id) return NextResponse.json({ error: 'Missing Agent ID' }, { status: 400 });

    const updates: any = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (is_active !== undefined) updates.is_active = is_active;
    if (account_type !== undefined) {
      updates.account_type = account_type;
      updates.auto_approve_orders = account_type === 'credit';
    }
    
    const nonNeg = (v: number) => (Number.isFinite(v) ? Math.max(0, v) : 0);
    if (credit_limit !== undefined) updates.credit_limit = credit_limit === '' ? null : nonNeg(Number(credit_limit));
    if (prepaid_balance !== undefined) updates.prepaid_balance = prepaid_balance === '' ? 0 : nonNeg(Number(prepaid_balance));
    if (max_auto_approve_limit !== undefined) updates.max_auto_approve_limit = max_auto_approve_limit === '' ? null : nonNeg(Number(max_auto_approve_limit));

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id);

    if (error) {
      return safeError('admin.update-agent', error, 500);
    }

    return NextResponse.json({ success: true, updates });
  } catch (err: unknown) {
    return safeError('admin.update-agent.catch', err, 500);
  }
}
