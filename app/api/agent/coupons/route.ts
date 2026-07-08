import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET  /api/agent/coupons        - list non-deleted coupons owned by caller
 * POST /api/agent/coupons        - create a single coupon
 *
 * v2 additions:
 *   - starts_at:            optional ISO timestamp; if set, RPC refuses redemption before it
 *   - new_customers_only:   if true, RPC refuses redemption when buyer has any prior non-cancelled order with the agent
 *   - notes:                free-text agent note (internal only, not shown at checkout)
 *   - deleted_at:           soft-delete column, populated by DELETE handler
 */

const CODE_REGEX = /^[A-Z0-9-]{3,24}$/;

interface CouponBody {
  code?: unknown;
  discount_type?: unknown;
  discount_value?: unknown;
  min_order_amount?: unknown;
  max_uses?: unknown;
  max_uses_per_user?: unknown;
  starts_at?: unknown;
  expires_at?: unknown;
  new_customers_only?: unknown;
  notes?: unknown;
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function GET() {
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('agent_id', gate.user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) return bad('Failed To Load Coupons.', 500);
  return NextResponse.json({ coupons: data ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;

  let body: CouponBody;
  try {
    body = (await req.json()) as CouponBody;
  } catch {
    return bad('Invalid Request Body.');
  }

  const rawCode = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  if (!CODE_REGEX.test(rawCode)) {
    return bad('Code Must Be 3 To 24 Characters Using Letters, Numbers, And Hyphens Only.');
  }

  const discountType = body.discount_type === 'fixed' ? 'fixed' : body.discount_type === 'percent' ? 'percent' : null;
  if (discountType === null) {
    return bad('Discount Type Must Be Percent Or Fixed.');
  }

  const discountValueRaw = Number(body.discount_value);
  if (!Number.isFinite(discountValueRaw) || discountValueRaw <= 0) {
    return bad('Discount Value Must Be Greater Than Zero.');
  }
  if (discountType === 'percent' && (discountValueRaw < 1 || discountValueRaw > 90)) {
    return bad('Percent Discount Must Be Between 1% And 90%.');
  }
  if (discountType === 'fixed' && (discountValueRaw < 1 || discountValueRaw > 500)) {
    return bad('Fixed Discount Must Be Between $1 And $500.');
  }
  const discountValue = Math.round(discountValueRaw * 100) / 100;

  let minOrder: number | null = null;
  if (body.min_order_amount !== undefined && body.min_order_amount !== null && body.min_order_amount !== '') {
    const n = Number(body.min_order_amount);
    if (!Number.isFinite(n) || n < 0) return bad('Minimum Order Must Be Zero Or Greater.');
    minOrder = Math.round(n * 100) / 100;
  }

  let maxUses: number | null = null;
  if (body.max_uses !== undefined && body.max_uses !== null && body.max_uses !== '') {
    const n = Number(body.max_uses);
    if (!Number.isInteger(n) || n < 1) return bad('Max Uses Must Be A Whole Number Of One Or More.');
    if (n > 100000) return bad('Max Uses Cannot Exceed 100,000.');
    maxUses = n;
  }

  let maxPerUser: number | null = null;
  if (body.max_uses_per_user !== undefined && body.max_uses_per_user !== null && body.max_uses_per_user !== '') {
    const n = Number(body.max_uses_per_user);
    if (!Number.isInteger(n) || n < 1) return bad('Max Uses Per User Must Be A Whole Number Of One Or More.');
    if (maxUses != null && n > maxUses) return bad('Max Uses Per User Cannot Exceed The Overall Max Uses.');
    maxPerUser = n;
  }

  function parseTs(input: unknown, allowPast = false): string | null | undefined {
    if (input === undefined) return undefined;
    if (input === null || input === '') return null;
    const s = String(input);
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T23:59:59Z` : s;
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return undefined;
    if (!allowPast && t <= Date.now()) return undefined;
    return new Date(t).toISOString();
  }

  let startsAt: string | null | undefined = parseTs(body.starts_at, /* allowPast */ true);
  if (startsAt === undefined) return bad('Start Date Is Invalid.');

  let expiresAt: string | null | undefined = parseTs(body.expires_at, /* allowPast */ false);
  if (expiresAt === undefined) return bad('Expiration Date Must Be A Valid Future Date.');

  if (startsAt && expiresAt && Date.parse(startsAt) >= Date.parse(expiresAt)) {
    return bad('Expiration Must Be After The Start Date.');
  }

  if (discountType === 'fixed' && minOrder != null && discountValue > minOrder) {
    return bad('Fixed Discount Cannot Be Greater Than Minimum Order Amount.');
  }
  if (discountType === 'fixed' && minOrder == null) {
    return bad('A Fixed-Amount Discount Requires A Minimum Order Of At Least The Discount Value.');
  }

  const newCustomersOnly = body.new_customers_only === true;
  const notes = typeof body.notes === 'string' && body.notes.trim().length > 0
    ? body.notes.trim().slice(0, 500)
    : null;

  const svc = await createServiceClient();

  const { data: existing } = await svc
    .from('coupons')
    .select('id, deleted_at')
    .eq('agent_id', gate.user.id)
    .eq('code', rawCode)
    .maybeSingle();
  if (existing && !existing.deleted_at) {
    return bad('You Already Have A Coupon With That Code.', 409);
  }
  if (existing && existing.deleted_at) {
    // Re-activate a previously soft-deleted code with new terms.
    const { data: revived, error: reviveErr } = await svc
      .from('coupons')
      .update({
        discount_type: discountType,
        discount_value: discountValue,
        min_order_amount: minOrder,
        max_uses: maxUses,
        max_uses_per_user: maxPerUser,
        starts_at: startsAt ?? null,
        expires_at: expiresAt ?? null,
        new_customers_only: newCustomersOnly,
        notes,
        is_active: true,
        uses_count: 0,
        deleted_at: null,
      })
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();
    if (reviveErr) return bad('Failed To Re-Activate Coupon.', 500);
    return NextResponse.json({ coupon: revived });
  }

  const { data: inserted, error: insertErr } = await svc
    .from('coupons')
    .insert({
      agent_id: gate.user.id,
      code: rawCode,
      discount_type: discountType,
      discount_value: discountValue,
      min_order_amount: minOrder,
      max_uses: maxUses,
      max_uses_per_user: maxPerUser,
      starts_at: startsAt ?? null,
      expires_at: expiresAt ?? null,
      new_customers_only: newCustomersOnly,
      notes,
      is_active: true,
    })
    .select('*')
    .maybeSingle();

  if (insertErr) {
    if ((insertErr.message ?? '').toLowerCase().includes('duplicate')) {
      return bad('You Already Have A Coupon With That Code.', 409);
    }
    return bad('Failed To Create Coupon.', 500);
  }

  return NextResponse.json({ coupon: inserted });
}
