import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';

// GET: List every coupon across all agents (joined with the owning agent profile)
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('coupons')
    .select('*, profiles!coupons_agent_id_fkey(full_name, username)')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST: Create a new coupon (admin can create coupons for any agent)
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));

  return withIdempotency({
    userId: gate.userId,
    route: '/api/admin/coupons',
    key: readIdempotencyKey(req),
    request: body,
    handler: async () => {
  const supabase = await createServiceClient();

  const {
    agentId,
    code,
    discountType,
    discountValue,
    minOrderAmount,
    maxUses,
    expiresAt,
  } = body;

  if (!agentId || !code || !discountType || discountValue === undefined) {
    return NextResponse.json(
      { error: 'Missing Required Fields (Agent, Code, Type, Value)' },
      { status: 400 }
    );
  }

  if (discountType !== 'percent' && discountType !== 'fixed') {
    return NextResponse.json({ error: 'Discount Type Must Be Percent Or Fixed' }, { status: 400 });
  }

  const normalizedCode = String(code).trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,24}$/.test(normalizedCode)) {
    return NextResponse.json(
      { error: 'Code Must Be 3 To 24 Characters: Letters, Numbers, And Hyphens Only.' },
      { status: 400 }
    );
  }

  const value = Number(discountValue);
  if (isNaN(value) || value <= 0) {
    return NextResponse.json({ error: 'Discount Value Must Be Greater Than Zero' }, { status: 400 });
  }
  if (discountType === 'percent' && value > 100) {
    return NextResponse.json({ error: 'A Percent Discount Cannot Exceed 100' }, { status: 400 });
  }

  // Verify that the target profile is actually an agent or super_agent.
  const { data: agentProfile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', agentId)
    .maybeSingle();

  if (!agentProfile || (agentProfile.role !== 'agent' && agentProfile.role !== 'super_agent')) {
    return NextResponse.json({ error: 'Selected Profile Is Not An Agent' }, { status: 400 });
  }

  // Validate optional numeric fields rather than writing NaN to the DB.
  let minOrder: number | null = null;
  if (minOrderAmount !== undefined && minOrderAmount !== null && minOrderAmount !== '') {
    minOrder = Number(minOrderAmount);
    if (!Number.isFinite(minOrder) || minOrder < 0) {
      return NextResponse.json({ error: 'Minimum Order Amount Must Be Zero Or Greater' }, { status: 400 });
    }
  }

  let maxUsesVal: number | null = null;
  if (maxUses !== undefined && maxUses !== null && maxUses !== '') {
    maxUsesVal = Number(maxUses);
    if (!Number.isInteger(maxUsesVal) || maxUsesVal < 1) {
      return NextResponse.json({ error: 'Max Uses Must Be A Whole Number Of At Least One' }, { status: 400 });
    }
  }

  // Guard the date parse so a malformed value cannot throw a RangeError (500).
  let expiresAtIso: string | null = null;
  if (expiresAt) {
    const d = new Date(`${expiresAt}T23:59:59`);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Expiry Date Is Invalid' }, { status: 400 });
    }
    expiresAtIso = d.toISOString();
  }

  const insertPayload: Record<string, any> = {
    agent_id: agentId,
    code: normalizedCode,
    discount_type: discountType,
    discount_value: value,
    min_order_amount: minOrder,
    max_uses: maxUsesVal,
    expires_at: expiresAtIso,
    is_active: true,
  };

  const { data: created, error: insertError } = await supabase
    .from('coupons')
    .insert(insertPayload)
    .select('id')
    .maybeSingle();

  if (insertError) {
    const friendly = insertError.message.toLowerCase().includes('duplicate')
      ? 'A Coupon With That Code Already Exists For This Agent.'
      : 'An unexpected error occurred.';
    return NextResponse.json({ error: friendly }, { status: 500 });
  }

  // Audit log
  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'coupon_create',
    entity_type: 'coupon',
    entity_id: created.id,
    changes: {
      code: normalizedCode,
      discount_type: discountType,
      discount_value: value,
      agent_id: agentId,
    },
  });

  return NextResponse.json({ success: true, id: created.id });
    },
  });
}

// PATCH: Toggle is_active flag
export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const { id, is_active } = body;

  if (!id || typeof is_active !== 'boolean') {
    return NextResponse.json({ error: 'Missing Coupon Id Or Active Flag' }, { status: 400 });
  }

  return withIdempotency({
    userId: gate.userId,
    route: '/api/admin/coupons',
    key: readIdempotencyKey(req),
    request: { id, is_active },
    handler: async () => {
  const supabase = await createServiceClient();

  const { data: existing } = await supabase
    .from('coupons')
    .select('id, code, is_active, agent_id')
    .eq('id', id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Coupon Not Found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('coupons')
    .update({ is_active })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'coupon_toggle',
    entity_type: 'coupon',
    entity_id: id,
    changes: {
      code: existing.code,
      agent_id: existing.agent_id,
      from: existing.is_active,
      to: is_active,
    },
  });

  return NextResponse.json({ success: true });
    },
  });
}

// DELETE: Remove a coupon
export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const id = req.nextUrl.searchParams.get('id');

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Missing or Invalid Coupon Id Parameter' }, { status: 400 });
  }

  return withIdempotency({
    userId: gate.userId,
    route: '/api/admin/coupons',
    key: readIdempotencyKey(req),
    request: { method: 'DELETE', id },
    handler: async () => {
  const supabase = await createServiceClient();

  const { data: existing } = await supabase
    .from('coupons')
    .select('id, code, agent_id')
    .eq('id', id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Coupon Not Found' }, { status: 404 });
  }

  const { error } = await supabase.from('coupons').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'coupon_delete',
    entity_type: 'coupon',
    entity_id: id,
    changes: {
      code: existing.code,
      agent_id: existing.agent_id,
    },
  });

  return NextResponse.json({ success: true });
    },
  });
}
