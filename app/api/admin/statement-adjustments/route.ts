import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { safeError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Credits owed back to an agent for orders cancelled out of a statement they
 * had ALREADY paid.
 *
 * The recompute path records these (an unpaid statement is corrected in place;
 * a paid one is settled history and must not be rewritten), but until now
 * nothing read the table. The rows existed, the RLS policy existed, the
 * notification existed - and the money was still invisible from every product
 * surface, which is exactly the state the recompute was written to fix.
 *
 * GET   - list adjustments, newest first, pending by default.
 * PATCH - resolve one: 'refunded' (money sent back out of band),
 *         'applied' (credited against a future bill), or 'void' (not owed).
 */

const PatchBody = z.object({
  id: z.string().uuid(),
  status: z.enum(['refunded', 'applied', 'void']),
  note: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? 'pending';
  const svc = createAdminClient();

  let query = svc
    .from('statement_adjustments')
    .select('id, statement_id, order_id, agent_id, amount, kind, status, reason, created_at, resolved_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (status !== 'all') query = query.eq('status', status);

  const { data: rows, error } = await query;
  if (error) return safeError('admin.statement_adjustments.list', error, 500);

  // Attach agent names in one round trip rather than an embed, so a schema
  // cache quirk on the FK cannot 500 the whole panel.
  const agentIds = Array.from(new Set((rows ?? []).map((r: { agent_id: string }) => r.agent_id)));
  const nameById = new Map<string, string>();
  if (agentIds.length > 0) {
    const { data: profiles } = await svc
      .from('profiles')
      .select('id, full_name, email')
      .in('id', agentIds);
    for (const p of profiles ?? []) {
      nameById.set(p.id as string, (p.full_name as string) || (p.email as string) || 'Agent');
    }
  }

  type AdjustmentRow = {
    id: string; statement_id: string; order_id: string | null; agent_id: string;
    amount: number; kind: string; status: string; reason: string | null;
    created_at: string; resolved_at: string | null;
  };
  const adjustments: Array<AdjustmentRow & { agent_name: string }> =
    ((rows ?? []) as AdjustmentRow[]).map((r) => ({
      ...r,
      agent_name: nameById.get(r.agent_id) ?? 'Agent',
    }));

  const pendingTotal = adjustments
    .filter((a) => a.status === 'pending')
    .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  return NextResponse.json({
    adjustments,
    count: adjustments.length,
    pendingTotal: Math.round(pendingTotal * 100) / 100,
  });
}

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: z.infer<typeof PatchBody>;
  try { body = PatchBody.parse(await req.json()); }
  catch { return NextResponse.json({ error: 'Invalid Request.' }, { status: 400 }); }

  const svc = createAdminClient();

  // Only a pending row can be resolved, so two admins clicking at once cannot
  // both "refund" the same credit.
  const { data: updated, error } = await svc
    .from('statement_adjustments')
    .update({
      status: body.status,
      resolved_by: gate.userId,
      resolved_at: new Date().toISOString(),
      ...(body.note ? { reason: body.note } : {}),
    })
    .eq('id', body.id)
    .eq('status', 'pending')
    .select('id, status, amount, agent_id')
    .maybeSingle();

  if (error) return safeError('admin.statement_adjustments.resolve', error, 500);
  if (!updated) {
    return NextResponse.json({ error: 'That Credit Has Already Been Resolved.' }, { status: 409 });
  }

  await svc.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'statement_adjustment_resolved',
    target_type: 'statement_adjustment',
    target_id: body.id,
    metadata: { status: body.status, amount: updated.amount, agent_id: updated.agent_id },
  }).then(
    () => undefined,
    () => undefined, // audit must never fail the resolution
  );

  return NextResponse.json({ ok: true, adjustment: updated });
}
