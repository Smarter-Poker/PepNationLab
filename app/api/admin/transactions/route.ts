import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

const VALID_TRANSACTION_TYPES = [
  'commission', 'withdrawal', 'adjustment', 'order_charge', 'restock_charge',
  'credit', 'bonus', 'refund', 'payout', 'deposit', 'manual_adjustment',
] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET: Fetch transaction ledger for an agent (or all agents)
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const { searchParams } = req.nextUrl;
  const agentId = searchParams.get('agent_id');
  // Cap limit to prevent unbounded data dumps
  const rawLimit = parseInt(searchParams.get('limit') ?? '100', 10);
  const limit = Math.min(isNaN(rawLimit) ? 100 : rawLimit, 500);

  // Validate agentId as UUID if provided
  if (agentId && !UUID_RE.test(agentId)) {
    return NextResponse.json({ error: 'Invalid agent_id format' }, { status: 400 });
  }

  let query = supabase
    .from('balance_transactions')
    .select(`
      id,
      agent_id,
      type,
      amount,
      balance_before,
      balance_after,
      description,
      reference_id,
      reference_type,
      created_at,
      profiles!balance_transactions_agent_id_fkey (
        full_name,
        email
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (agentId) {
    query = query.eq('agent_id', agentId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

// POST: Log a manual transaction (admin-initiated ledger entry)
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const body = await req.json().catch(() => ({}));

  const {
    agent_id,
    type,
    amount,
    description,
    reference_id,
    reference_type,
  } = body;

  // Input validation
  if (!agent_id || !UUID_RE.test(agent_id)) {
    return NextResponse.json({ error: 'Missing or invalid agent_id (must be UUID)' }, { status: 400 });
  }
  if (!type || !VALID_TRANSACTION_TYPES.includes(type)) {
    return NextResponse.json({
      error: `Invalid type. Must be one of: ${VALID_TRANSACTION_TYPES.join(', ')}`,
    }, { status: 400 });
  }
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }
  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
  }

  // Fetch current agent balance server-side — NEVER trust caller-supplied balance values.
  // Using balance_before/balance_after from the request body would allow fraudulent
  // ledger entries with arbitrary balance snapshots.
  const { data: agentProfile, error: profileErr } = await supabase
    .from('profiles')
    .select('prepaid_balance')
    .eq('id', agent_id)
    .maybeSingle();

  if (profileErr || !agentProfile) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const balanceBefore = Number(agentProfile.prepaid_balance) || 0;
  // Note: this route logs the transaction but does NOT change the balance.
  // Balance changes are performed by the deduct_prepaid_balance / credit_balance RPCs.
  // The balance_before/after here are informational snapshots at the time of logging.
  const balanceAfter = balanceBefore;

  const { data, error } = await supabase
    .from('balance_transactions')
    .insert({
      agent_id,
      type,
      amount: parsedAmount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      description: description.trim(),
      reference_id: reference_id ?? null,
      reference_type: reference_type ?? null,
      created_by: gate.userId, // always set to the authenticated admin — never caller-supplied
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data.id });
}
