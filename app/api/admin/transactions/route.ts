export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';

const VALID_TRANSACTION_TYPES = [
  'commission', 'withdrawal', 'adjustment', 'order_charge', 'restock_charge',
  'credit', 'debit', 'bonus', 'payout', 'deposit', 'manual_adjustment',
] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();
    const { searchParams } = req.nextUrl;
    const agentId = searchParams.get('agent_id');
    const rawLimit = parseInt(searchParams.get('limit') ?? '100', 10);
    const limit = Math.min(isNaN(rawLimit) ? 100 : rawLimit, 500);

    if (agentId && !UUID_RE.test(agentId)) return NextResponse.json({ error: 'Invalid Agent_Id Format' }, { status: 400 });

    let query = supabase.from('balance_transactions').select(`id, agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, created_at, profiles!balance_transactions_agent_id_fkey ( full_name, email )`).order('created_at', { ascending: false }).limit(limit);
    if (agentId) query = query.eq('agent_id', agentId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    console.error('[admin/transactions] GET error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json().catch(() => ({}));

    return withIdempotency({
      userId: gate.userId,
      route: '/api/admin/transactions',
      key: readIdempotencyKey(req),
      request: body,
      handler: async () => {
        const supabase = createAdminClient();
        const { agent_id, type, amount, description, reference_id, reference_type } = body;

        if (!agent_id || !UUID_RE.test(agent_id)) return NextResponse.json({ error: 'Missing Or Invalid Agent_Id (Must Be UUID)' }, { status: 400 });
        if (!type || !VALID_TRANSACTION_TYPES.includes(type)) return NextResponse.json({ error: `Invalid Type. Must Be One Of: ${VALID_TRANSACTION_TYPES.join(', ')}` }, { status: 400 });
        const parsedAmount = Number(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return NextResponse.json({ error: 'Amount Must Be A Positive Number' }, { status: 400 });
        if (!description || typeof description !== 'string' || description.trim().length === 0) return NextResponse.json({ error: 'Description Is Required' }, { status: 400 });
        if (description.trim().length > 500) return NextResponse.json({ error: 'Description Too Long (Max 500 Characters)' }, { status: 400 });

        const { data: agentProfile, error: profileErr } = await supabase.from('profiles').select('prepaid_balance').eq('id', agent_id).maybeSingle();
        if (profileErr || !agentProfile) return NextResponse.json({ error: 'Agent Not Found' }, { status: 404 });

        const balanceBefore = Number(agentProfile.prepaid_balance) || 0;
        // Determine direction: credit types add to balance, debit types subtract.
        const CREDIT_TYPES = ['credit', 'deposit', 'bonus', 'commission', 'adjustment', 'manual_adjustment'];
        const direction = CREDIT_TYPES.includes(type) ? 1 : -1;
        const balanceAfter = balanceBefore + direction * parsedAmount;

        // Update profiles.prepaid_balance atomically before inserting the ledger row
        const { error: balanceErr } = await supabase
          .from('profiles')
          .update({ prepaid_balance: balanceAfter, updated_at: new Date().toISOString() })
          .eq('id', agent_id);
        if (balanceErr) return NextResponse.json({ error: 'An Unexpected Error Occurred Updating Balance' }, { status: 500 });

        const { data, error } = await supabase.from('balance_transactions').insert({
          agent_id,
          type,
          amount: parsedAmount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          description: description.trim(),
          reference_id: reference_id ?? null,
          reference_type: reference_type ?? null,
          created_by: gate.userId,
        }).select('id').maybeSingle();
        if (error || !data) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
        return NextResponse.json({ success: true, id: data.id, balanceBefore, balanceAfter });
      },
    });
  } catch (err) {
    console.error('[admin/transactions] POST error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}
