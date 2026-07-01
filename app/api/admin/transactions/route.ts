export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
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

  const supabase = await createServiceClient();
  const { searchParams } = req.nextUrl;
  const agentId = searchParams.get('agent_id');
  const rawLimit = parseInt(searchParams.get('limit') ?? '100', 10);
  const limit = Math.min(isNaN(rawLimit) ? 100 : rawLimit, 500);

  if (agentId && !UUID_RE.test(agentId)) return NextResponse.json({ error: 'Invalid agent_id format' }, { status: 400 });

  let query = supabase.from('balance_transactions').select(`id, agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, created_at, profiles!balance_transactions_agent_id_fkey ( full_name, email )`).order('created_at', { ascending: false }).limit(limit);
  if (agentId) query = query.eq('agent_id', agentId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));

  return withIdempotency({
    userId: gate.userId,
    route: '/api/admin/transactions',
    key: readIdempotencyKey(req),
    request: body,
    handler: async () => {
      const supabase = await createServiceClient();
      const { agent_id, type, amount, description, reference_id, reference_type } = body;

      if (!agent_id || !UUID_RE.test(agent_id)) return NextResponse.json({ error: 'Missing or invalid agent_id (must be UUID)' }, { status: 400 });
      if (!type || !VALID_TRANSACTION_TYPES.includes(type)) return NextResponse.json({ error: `Invalid type. Must be one of: ${VALID_TRANSACTION_TYPES.join(', ')}` }, { status: 400 });
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
      if (!description || typeof description !== 'string' || description.trim().length === 0) return NextResponse.json({ error: 'description is required' }, { status: 400 });

      const { data: agentProfile, error: profileErr } = await supabase.from('profiles').select('prepaid_balance').eq('id', agent_id).maybeSingle();
      if (profileErr || !agentProfile) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

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
      if (balanceErr) return NextResponse.json({ error: 'An unexpected error occurred updating balance.' }, { status: 500 });

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
      }).select('id').single();
      if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
      return NextResponse.json({ success: true, id: data.id, balanceBefore, balanceAfter });
    },
  });
}
