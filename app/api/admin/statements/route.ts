import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
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
import { assertSameOrigin } from '@/lib/csrf';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';

// GET: list all statements with agent info
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = createAdminClient();
  const status = req.nextUrl.searchParams.get('status');

  let dbQuery = supabase
    .from('weekly_statements')
    .select('*, profiles!weekly_statements_agent_id_fkey(full_name, email)')
    .order('week_start', { ascending: false })
    .limit(5000);

  if (status) {
    dbQuery = dbQuery.eq('status', status);
  }

  const { data, error } = await dbQuery;
  if (error) {
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
  return NextResponse.json({ data });
}

// POST: generate a statement or mark one paid
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  return withIdempotency({
    userId: gate.userId,
    route: '/api/admin/statements',
    key: readIdempotencyKey(req),
    request: body,
    handler: async () => {
  const supabase = createAdminClient();

  if (action === 'generate') {
    const { agentId, weekStart } = body;
    if (!agentId || !weekStart) {
      return NextResponse.json(
        { error: 'Agent And Week Start Date Are Required.' },
        { status: 400 }
      );
    }
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (!UUID_RE.test(agentId)) {
      return NextResponse.json({ error: 'Invalid agentId format (must be UUID).' }, { status: 400 });
    }
    if (!DATE_RE.test(weekStart) || isNaN(Date.parse(weekStart))) {
      return NextResponse.json({ error: 'Invalid weekStart format (must be YYYY-MM-DD).' }, { status: 400 });
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
    const { statementId, paymentMethod, paymentReference, paymentNotes } = body as {
      statementId?: string;
      paymentMethod?: string;
      paymentReference?: string;
      paymentNotes?: string;
    };
    if (!statementId) {
      return NextResponse.json({ error: 'Statement ID Required.' }, { status: 400 });
    }

    // Confirm the statement exists before flipping a financial state - an
    // unknown id would otherwise silently return success with zero rows updated.
    const { data: existingStmt } = await supabase
      .from('weekly_statements')
      .select('id, status, agent_id')
      .eq('id', statementId)
      .maybeSingle();
    if (!existingStmt) {
      return NextResponse.json({ error: 'Statement Not Found.' }, { status: 404 });
    }

    // Persist the canonical columns (payment_method, payment_reference) and
    // keep admin_notes available for free-form annotations. The legacy
    // `paymentNotes` key is folded into admin_notes if supplied.
    const updates: Record<string, unknown> = {
      status: 'paid',
      paid_at: new Date().toISOString(),
    };
    if (typeof paymentMethod === 'string' && paymentMethod.trim()) {
      updates.payment_method = paymentMethod.trim();
    }
    if (typeof paymentReference === 'string' && paymentReference.trim()) {
      updates.payment_reference = paymentReference.trim();
    }
    if (typeof paymentNotes === 'string' && paymentNotes.trim()) {
      updates.admin_notes = paymentNotes.trim();
    }

    const { error: updateError } = await supabase
      .from('weekly_statements')
      .update(updates)
      .eq('id', statementId);

    if (updateError) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    }

    // Audit the financial state change (paying out a weekly statement).
    await supabase.from('admin_audit_log').insert({
      actor_id: gate.userId,
      action: 'statement_marked_paid',
      entity_type: 'weekly_statement',
      entity_id: statementId,
      changes: {
        from: existingStmt.status,
        to: 'paid',
        agent_id: existingStmt.agent_id,
        payment_method: (updates.payment_method as string) ?? null,
        payment_reference: (updates.payment_reference as string) ?? null,
      },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid Action' }, { status: 400 });
    },
  });
}
