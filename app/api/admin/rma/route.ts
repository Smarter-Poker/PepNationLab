import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['requested', 'approved', 'label_sent', 'in_transit', 'received', 'inspected', 'resolved', 'rejected']).optional(),
  rejected_reason: z.string().max(500).optional().nullable(),
  inspection_notes: z.string().max(2000).optional().nullable(),
  restock_decision: z.enum(['restock', 'dispose', 'quarantine', 'vendor_return']).optional().nullable(),
  resolution_type: z.enum(['refund_full', 'refund_partial', 'store_credit_full', 'store_credit_partial', 'replacement_sent', 'no_action']).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

/**
 * GET /api/admin/rma
 * Returns RMAs across the platform with optional filters.
 * ?status=requested&agentId=...&from=2025-01-01&to=2025-02-01
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const url = req.nextUrl;
  const statusFilter = url.searchParams.get('status');
  const agentId = url.searchParams.get('agentId');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  const service = await createServiceClient();

  let query = service
    .from('rma_requests')
    .select(`
      id, order_id, requester_id, status, reason_category, reason_details, requested_resolution,
      return_label_url, return_tracking_number, return_label_purchased_at,
      received_at, inspected_at, restock_decision, resolution_type, resolved_at,
      rejected_reason, created_at, updated_at,
      requester:profiles!rma_requests_requester_id_fkey(full_name, email, username),
      orders(id, agent_id, total, status, created_at)
    `)
    .order('created_at', { ascending: false })
    .limit(500);

  if (statusFilter) query = query.eq('status', statusFilter);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rmas = data ?? [];
  if (agentId) {
    rmas = rmas.filter((r: any) => {
      const o = Array.isArray(r.orders) ? r.orders[0] : r.orders;
      return o?.agent_id === agentId;
    });
  }

  return NextResponse.json({ rmas });
}

/**
 * PATCH /api/admin/rma
 * Admin override of RMA fields. Body must include `id` and any subset of the
 * mutable columns. Writes an admin_audit_log row.
 */
export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Update', details: parsed.error.issues }, { status: 400 });
  }

  const { id, ...patch } = parsed.data;
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) updates[k] = v;
  }

  const service = await createServiceClient();

  const { error } = await service
    .from('rma_requests')
    .update(updates)
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await service.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'rma_override',
    entity_type: 'rma_request',
    entity_id: id,
    changes: updates,
  });

  return NextResponse.json({ ok: true });
}
