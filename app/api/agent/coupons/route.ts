import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/coupons
 *   Returns the calling agent's coupons (newest first).
 *
 * POST /api/agent/coupons
 *   Creates a coupon owned by the calling agent. All validation lives
 *   here — the component shows the same rules in helper text but a bad
 *   client cannot bypass them.
 *
 * Body shape:
 *   {
 *     code: string,
 *     discount_type: 'percent' | 'fixed',
 *     discount_value: number,
 *     min_order_amount?: number | null,
 *     max_uses?: number | null,
 *     max_uses_per_user?: number | null,
 *     expires_at?: string | null     // ISO date (yyyy-mm-dd) or full ISO timestamp
 *   }
 */

const CODE_REGEX = /^[A-Z0-9-]{3,24}$/;

interface CouponBody {
  code?: unknown;
  discount_type?: unknown;
  discount_value?: unknown;
  min_order_amount?: unknown;
  max_uses?: unknown;
  max_uses_per_user?: unknown;
  expires_at?: unknown;
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function GET() {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('agent_id', gate.user.id)
    .order('created_at', { ascending: false });

  if (error) return bad('Failed To Load Coupons.', 500);
  return NextResponse.json({ coupons: data ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  let body: CouponBody;
  try {
    body = (await req.json()) as CouponBody;
  } catch {
    return bad('Invalid Request Body.');
  }

  // ---- code -------------------------------------------------------
  const rawCode = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  if (!CODE_REGEX.test(rawCode)) {
    return bad('Code Must Be 3 To 24 Characters Using Letters, Numbers, And Hyphens Only.');
  }

  // ---- discount_type ---------------------------------------------
  const discountType = body.discount_type === 'fixed' ? 'fixed' : body.discount_type === 'percent' ? 'percent' : null;
  if (discountType === null) {
    return bad('Discount Type Must Be Percent Or Fixed.');
  }

  // ---- discount_value -------------------------------------------
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

  // ---- min_order_amount -----------------------------------------
  let minOrder: number | null = null;
  if (body.min_order_amount !== undefined && body.min_order_amount !== null && body.min_order_amount !== '') {
    const n = Number(body.min_order_amount);
    if (!Number.isFinite(n) || n < 0) {
      return bad('Minimum Order Must Be Zero Or Greater.');
    }
    minOrder = Math.round(n * 100) / 100;
  }

  // ---- max_uses --------------------------------------------------
  let maxUses: number | null = null;
  if (body.max_uses !== undefined && body.max_uses !== null && body.max_uses !== '') {
    const n = Number(body.max_uses);
    if (!Number.isInteger(n) || n < 1) {
      return bad('Max Uses Must Be A Whole Number Of One Or More.');
    }
    if (n > 100000) {
      return bad('Max Uses Cannot Exceed 100,000.');
    }
    maxUses = n;
  }

  // ---- max_uses_per_user ----------------------------------------
  let maxPerUser: number | null = null;
  if (body.max_uses_per_user !== undefined && body.max_uses_per_user !== null && body.max_uses_per_user !== '') {
    const n = Number(body.max_uses_per_user);
    if (!Number.isInteger(n) || n < 1) {
      return bad('Max Uses Per User Must Be A Whole Number Of One Or More.');
    }
    if (maxUses != null && n > maxUses) {
      return bad('Max Uses Per User Cannot Exceed The Overall Max Uses.');
    }
    maxPerUser = n;
  }

  // ---- expires_at -----------------------------------------------
  let expiresAt: string | null = null;
  if (body.expires_at !== undefined && body.expires_at !== null && body.expires_at !== '') {
    const s = String(body.expires_at);
    // Accept yyyy-mm-dd (date picker) or full ISO.
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T23:59:59Z` : s;
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) {
      return bad('Expiration Date Is Invalid.');
    }
    if (t <= Date.now()) {
      return bad('Expiration Date Must Be In The Future.');
    }
    expiresAt = new Date(t).toISOString();
  }

  // ---- consistency: fixed discount vs min order -----------------
  // A $50-off coupon with no min-order or a $1 min order creates a free
  // order if someone buys a $5 vial. Block obvious abuse vectors.
  if (discountType === 'fixed' && minOrder != null && discountValue > minOrder) {
    return bad('Fixed Discount Cannot Be Greater Than Minimum Order Amount.');
  }
  if (discountType === 'fixed' && minOrder == null) {
    // Still allow it but require min_order to be at least discount value.
    // Block to keep the rule simple and protect the agent.
    return bad('A Fixed-Amount Discount Requires A Minimum Order Of At Least The Discount Value.');
  }

  const svc = await createServiceClient();

  // Reject duplicate code within this agent's namespace.
  const { data: existing } = await svc
    .from('coupons')
    .select('id')
    .eq('agent_id', gate.user.id)
    .eq('code', rawCode)
    .maybeSingle();
  if (existing) {
    return bad('You Already Have A Coupon With That Code.', 409);
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
      expires_at: expiresAt,
      is_active: true,
    })
    .select('*')
    .single();

  if (insertErr) {
    if ((insertErr.message ?? '').toLowerCase().includes('duplicate')) {
      return bad('You Already Have A Coupon With That Code.', 409);
    }
    return bad('Failed To Create Coupon.', 500);
  }

  return NextResponse.json({ coupon: inserted });
}
