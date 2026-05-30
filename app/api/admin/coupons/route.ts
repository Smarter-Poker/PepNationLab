import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

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

  const supabase = await createServiceClient();
  const body = await req.json().catch(() => ({}));

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

  const insertPayload: Record<string, any> = {
    agent_id: agentId,
    code: normalizedCode,
    discount_type: discountType,
    discount_value: value,
    min_order_amount:
      minOrderAmount !== undefined && minOrderAmount !== null && minOrderAmount !== ''
        ? Number(minOrderAmount)
        : null,
    max_uses:
      maxUses !== undefined && maxUses !== null && maxUses !== ''
        ? Number(maxUses)
        : null,
    expires_at: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
    is_active: true,
  };

  const { data: created, error: insertError } = await supabase
    .from('coupons')
    .insert(insertPayload)
    .select('id')
    .single();

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
}

// PATCH: Toggle is_active flag
export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const body = await req.json().catch(() => ({}));
  const { id, is_active } = body;

  if (!id || typeof is_active !== 'boolean') {
    return NextResponse.json({ error: 'Missing Coupon Id Or Active Flag' }, { status: 400 });
  }

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
}

// DELETE: Remove a coupon
export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing Coupon Id Parameter' }, { status: 400 });
  }

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
}
