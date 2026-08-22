export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';
import { writeAuditLog } from '@/lib/admin-audit';

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

        // Atomic adjustment via SECURITY DEFINER RPC: row lock + relative
        // balance update + ledger insert happen in one DB transaction, so a
        // concurrent deduction can never be erased by an absolute write.
        // The function applies the same CREDIT_TYPES direction logic this
        // route used to compute in JS.
        const { data, error } = await supabase.rpc('admin_adjust_balance', {
          p_agent_id: agent_id,
          p_type: type,
          p_amount: parsedAmount,
          p_description: description.trim(),
          p_created_by: gate.userId,
          p_reference_id: reference_id ?? null,
          p_reference_type: reference_type ?? null,
        });
        if (error) {
          if ((error.message ?? '').includes('Agent not found')) {
            return NextResponse.json({ error: 'Agent Not Found' }, { status: 404 });
          }
          return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
        }
        // The RPC RETURNS TABLE, so supabase-js resolves to an array of rows.
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });

        const balanceBefore = Number(row.balance_before);
        const balanceAfter = Number(row.balance_after);

        // Audit every manual balance move (retained from concurrent change).
        await writeAuditLog(supabase, {
          actorId: gate.userId,
          action: 'manual_balance_adjustment',
          entityType: 'profile',
          entityId: agent_id,
          changes: { type, amount: parsedAmount, balance_before: balanceBefore, balance_after: balanceAfter, description: description.trim() },
        });

        return NextResponse.json({ success: true, id: row.transaction_id, balanceBefore, balanceAfter });
      },
    });
  } catch (err) {
    console.error('[admin/transactions] POST error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}
