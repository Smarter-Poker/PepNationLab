import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { createServiceClient } from '@/lib/supabase/server';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';

export const dynamic = 'force-dynamic';

type AdjustmentType = 'set' | 'percent_delta' | 'flat_delta';
const ALLOWED_ADJUSTMENTS: AdjustmentType[] = ['set', 'percent_delta', 'flat_delta'];

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: { agent_product_ids?: string[]; adjustment_type?: AdjustmentType; new_value?: number; effective_at?: string | null; notes?: string; };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid Body' }, { status: 400 });
  }

  const ids = Array.isArray(body.agent_product_ids) ? body.agent_product_ids.filter((id): id is string => typeof id === 'string') : [];
  const adjustmentType = body.adjustment_type;
  const newValue = typeof body.new_value === 'number' && Number.isFinite(body.new_value) ? body.new_value : null;
  const effectiveAtRaw = typeof body.effective_at === 'string' && body.effective_at.trim() ? body.effective_at : null;
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : null;

  if (ids.length === 0) return NextResponse.json({ error: 'No Agent Products Selected' }, { status: 400 });
  if (!adjustmentType || !ALLOWED_ADJUSTMENTS.includes(adjustmentType)) return NextResponse.json({ error: 'Invalid Adjustment Type' }, { status: 400 });
  if (newValue === null) return NextResponse.json({ error: 'Invalid New Value' }, { status: 400 });
  if (adjustmentType === 'set' && newValue < 0) return NextResponse.json({ error: 'New Value Cannot Be Negative' }, { status: 400 });

  const effectiveAt = effectiveAtRaw ? new Date(effectiveAtRaw) : new Date();
  if (Number.isNaN(effectiveAt.getTime())) return NextResponse.json({ error: 'Invalid Effective Date' }, { status: 400 });

  return withIdempotency({
    userId: gate.userId,
    route: '/api/admin/agent-products/bulk-price',
    key: readIdempotencyKey(req),
    request: { ids, adjustmentType, newValue, effectiveAt: effectiveAt.toISOString(), notes },
    handler: async () => {
      const service = await createServiceClient();
      const isImmediate = effectiveAt.getTime() <= Date.now();

      const rows = ids.map((id) => ({ scope: 'agent_retail', effective_at: effectiveAt.toISOString(), agent_product_id: id, adjustment_type: adjustmentType, new_value: newValue, notes, created_by: gate.userId }));

      const { error: insertErr } = await service.from('scheduled_price_changes').insert(rows);
      if (insertErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

      let appliedCount = 0;
      if (isImmediate) {
        const { data: applied, error: applyErr } = await service.rpc('apply_due_price_changes');
        if (!applyErr) appliedCount = typeof applied === 'number' ? applied : 0;
      }

      await service.from('admin_audit_log').insert({ actor_id: gate.userId, action: 'bulk_price_change', entity_type: 'agent_product', entity_id: null, changes: { scope: 'agent_retail', adjustment_type: adjustmentType, new_value: newValue, count: ids.length, sample_id: ids[0] ?? null, agent_product_ids: ids, effective_at: effectiveAt.toISOString(), immediate: isImmediate, applied_count: appliedCount } });

      return NextResponse.json({ ok: true, scheduled_count: rows.length, applied_count: appliedCount });
    },
  });
}
