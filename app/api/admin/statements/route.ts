import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * Weekly agent billing statements.
 *
 * BILLING MODEL (Phase 8):
 * Super Agents are billed for their direct orders + sub-agent orders.
 * Sub-Agents are NEVER billed by Admin (they settle directly with their Super Agent).
 * Agents are billed for their direct orders.
 * We rely strictly on unit_cost_price and unit_super_agent_cost from order_items
 * as historical snapshots, rather than recalculating from base_cost.
 */

import { computeStatement, persistStatement } from '@/lib/statements';

// GET: list all statements with agent info
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const status = req.nextUrl.searchParams.get('status');

  let dbQuery = supabase
    .from('weekly_statements')
    .select('*, profiles!weekly_statements_agent_id_fkey(full_name, email)')
    .order('week_start', { ascending: false });

  if (status) {
    dbQuery = dbQuery.eq('status', status);
  }

  const { data, error } = await dbQuery;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

// POST: generate a statement or mark one paid
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (action === 'generate') {
    const { agentId, weekStart } = body;
    if (!agentId || !weekStart) {
      return NextResponse.json(
        { error: 'Agent And Week Start Date Are Required.' },
        { status: 400 }
      );
    }

    // Check if statement already exists to prevent Double-Billing
    const { data: existingStmt } = await supabase
      .from('weekly_statements')
      .select('id')
      .eq('agent_id', agentId)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (existingStmt) {
      return NextResponse.json(
        { error: 'A statement for this week has already been generated. To prevent double-billing, you cannot regenerate it.' },
        { status: 400 }
      );
    }

    const computed = await computeStatement(supabase, agentId, weekStart);
    if (!computed.ok) {
      return NextResponse.json({ error: computed.error }, { status: 400 });
    }

    const saved = await persistStatement(supabase, agentId, weekStart, computed.data);
    if (!saved.ok) {
      return NextResponse.json({ error: saved.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, statementId: saved.statementId });
  }

  if (action === 'mark_paid') {
    const { statementId, paymentNotes } = body;
    if (!statementId) {
      return NextResponse.json({ error: 'Statement ID Required.' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('weekly_statements')
      .update({
        status: 'paid',
        payment_notes: paymentNotes || null,
        paid_at: new Date().toISOString(),
      })
      .eq('id', statementId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid Action' }, { status: 400 });
}
