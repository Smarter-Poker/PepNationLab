import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/agent/coupons/[id]    — toggle is_active (body: { is_active: boolean })
 * DELETE /api/agent/coupons/[id]   — hard delete (the agent owns the row)
 *
 * Ownership is enforced server-side: a coupon row can only be edited or
 * deleted by the agent_id that owns it (or an admin).
 */

interface Ctx { params: Promise<{ id: string }> }

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

async function gateAndOwn(req: NextRequest, ctx: Ctx) {
  const csrf = assertSameOrigin(req);
  if (csrf) return { ok: false as const, response: csrf };
  const gate = await requireAgent();
  if (!gate.ok) return { ok: false as const, response: gate.response };
  const { id } = await ctx.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false as const, response: bad('Invalid Coupon Id.') };
  }
  const svc = await createServiceClient();
  const { data: row } = await svc.from('coupons').select('id, agent_id').eq('id', id).maybeSingle();
  if (!row) return { ok: false as const, response: bad('Coupon Not Found.', 404) };

  // Check ownership: agent owns the coupon OR caller is admin.
  if (row.agent_id !== gate.user.id) {
    const { data: caller } = await svc.from('profiles').select('role').eq('id', gate.user.id).maybeSingle();
    if (caller?.role !== 'admin') return { ok: false as const, response: bad('Forbidden.', 403) };
  }
  return { ok: true as const, id, svc };
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const gate = await gateAndOwn(req, ctx);
  if (!gate.ok) return gate.response;

  let body: { is_active?: unknown };
  try { body = await req.json(); } catch { return bad('Invalid Request Body.'); }
  if (typeof body.is_active !== 'boolean') return bad('Field is_active Must Be A Boolean.');

  const { data, error } = await gate.svc
    .from('coupons')
    .update({ is_active: body.is_active })
    .eq('id', gate.id)
    .select('*')
    .maybeSingle();

  if (error) return bad('Failed To Update Coupon.', 500);
  return NextResponse.json({ coupon: data });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const gate = await gateAndOwn(req, ctx);
  if (!gate.ok) return gate.response;

  const { error } = await gate.svc.from('coupons').delete().eq('id', gate.id);
  if (error) return bad('Failed To Delete Coupon.', 500);
  return NextResponse.json({ success: true });
}
