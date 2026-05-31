import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Scope = 'master_base_cost' | 'master_bulk_price';
type AdjustmentType = 'set' | 'percent_delta' | 'flat_delta';

const ALLOWED_SCOPES: Scope[] = ['master_base_cost', 'master_bulk_price'];
const ALLOWED_ADJUSTMENTS: AdjustmentType[] = ['set', 'percent_delta', 'flat_delta'];

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: {
    product_ids?: string[];
    scope?: Scope;
    adjustment_type?: AdjustmentType;
    new_value?: number;
    effective_at?: string | null;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid Body' }, { status: 400 });
  }

  const productIds = Array.isArray(body.product_ids)
    ? body.product_ids.filter((id): id is string => typeof id === 'string')
    : [];
  const scope = body.scope;
  const adjustmentType = body.adjustment_type;
  const newValue = typeof body.new_value === 'number' && Number.isFinite(body.new_value) ? body.new_value : null;
  const effectiveAtRaw = typeof body.effective_at === 'string' && body.effective_at.trim() ? body.effective_at : null;
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : null;

  if (productIds.length === 0) return NextResponse.json({ error: 'No Products Selected' }, { status: 400 });
  if (!scope || !ALLOWED_SCOPES.includes(scope)) return NextResponse.json({ error: 'Invalid Scope' }, { status: 400 });
  if (!adjustmentType || !ALLOWED_ADJUSTMENTS.includes(adjustmentType)) {
    return NextResponse.json({ error: 'Invalid Adjustment Type' }, { status: 400 });
  }
  if (newValue === null) return NextResponse.json({ error: 'Invalid New Value' }, { status: 400 });
  if (adjustmentType === 'set' && newValue < 0) {
    return NextResponse.json({ error: 'New Value Cannot Be Negative' }, { status: 400 });
  }

  const effectiveAt = effectiveAtRaw ? new Date(effectiveAtRaw) : new Date();
  if (Number.isNaN(effectiveAt.getTime())) {
    return NextResponse.json({ error: 'Invalid Effective Date' }, { status: 400 });
  }

  const service = await createServiceClient();
  const isImmediate = effectiveAt.getTime() <= Date.now();

  const rows = productIds.map((pid) => ({
    scope,
    effective_at: effectiveAt.toISOString(),
    product_id: pid,
    adjustment_type: adjustmentType,
    new_value: newValue,
    notes,
    created_by: gate.userId,
  }));

  const { error: insertErr } = await service.from('scheduled_price_changes').insert(rows);
  if (insertErr) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  let appliedCount = 0;
  if (isImmediate) {
    const { data: applied, error: applyErr } = await service.rpc('apply_due_price_changes');
    if (applyErr) {
      // The change is already persisted in scheduled_price_changes; the cron
      // will apply it on the next run. Log the immediate-apply failure rather
      // than masking it as a clean success.
      console.error('apply_due_price_changes failed (products bulk-price):', applyErr.message);
    } else {
      appliedCount = typeof applied === 'number' ? applied : 0;
    }
  }

  await service.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'bulk_price_change',
    entity_type: 'product',
    entity_id: productIds[0] ?? null,
    changes: {
      scope,
      adjustment_type: adjustmentType,
      new_value: newValue,
      product_ids: productIds,
      effective_at: effectiveAt.toISOString(),
      immediate: isImmediate,
      applied_count: appliedCount,
    },
  });

  return NextResponse.json({
    ok: true,
    scheduled_count: rows.length,
    applied_count: appliedCount,
  });
}
