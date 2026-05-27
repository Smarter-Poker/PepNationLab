import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

// GET: Fetch transaction ledger for an agent (or all agents)
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const { searchParams } = req.nextUrl;
  const agentId = searchParams.get('agent_id');
  const limit = parseInt(searchParams.get('limit') ?? '100', 10);

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

// POST: Log a manual transaction (called internally by other APIs)
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const body = await req.json().catch(() => ({}));

  const {
    agent_id,
    type,
    amount,
    balance_before,
    balance_after,
    description,
    reference_id,
    reference_type,
    created_by,
  } = body;

  if (!agent_id || !type || amount === undefined || !description) {
    return NextResponse.json({ error: 'Missing Required Fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('balance_transactions')
    .insert({
      agent_id,
      type,
      amount: Math.abs(Number(amount)),
      balance_before: Number(balance_before ?? 0),
      balance_after: Number(balance_after ?? 0),
      description,
      reference_id: reference_id ?? null,
      reference_type: reference_type ?? null,
      created_by: created_by ?? null,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data.id });
}
