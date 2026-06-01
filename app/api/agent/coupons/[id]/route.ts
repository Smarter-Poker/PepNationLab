import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/agent/coupons/[id]
 *   Toggle is_active (body: { is_active: boolean }) OR update mutable fields
 *   (max_uses, max_uses_per_user, expires_at, starts_at, new_customers_only,
 *    min_order_amount, notes). discount_type / discount_value / code are
 *    locked once created — agents create a new coupon to change those.
 *
 * DELETE /api/agent/coupons/[id]
 *   SOFT-deletes by stamping deleted_at. Preserves redemption history /
 *   audit trail. The unique (agent_id, code) constraint is preserved so a
 *   re-create of the same code revives the row in place (see POST).
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
  const { data: row } = await svc.from('coupons').select('id, agent_id, deleted_at').eq('id', id).maybeSingle();
  if (!row) return { ok: false as const, response: bad('Coupon Not Found.', 404) };

  if (row.agent_id !== gate.user.id) {
    const { data: caller } = await svc.from('profiles').select('role').eq('id', gate.user.id).maybeSingle();
    if (caller?.role !== 'admin') return { ok: false as const, response: bad('Forbidden.', 403) };
  }
  return { ok: true as const, id, svc, agentId: row.agent_id as string, alreadyDeleted: row.deleted_at != null };
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const gate = await gateAndOwn(req, ctx);
  if (!gate.ok) return gate.response;
  if (gate.alreadyDeleted) return bad('Coupon Has Been Deleted.', 410);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return bad('Invalid Request Body.'); }

  const updates: Record<string, unknown> = {};

  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;
  if (typeof body.new_customers_only === 'boolean') updates.new_customers_only = body.new_customers_only;

  if (body.notes !== undefined) {
    if (body.notes === null || body.notes === '') updates.notes = null;
    else if (typeof body.notes === 'string') updates.notes = body.notes.trim().slice(0, 500);
  }

  if (body.min_order_amount !== undefined) {
    if (body.min_order_amount === null || body.min_order_amount === '') updates.min_order_amount = null;
    else {
      const n = Number(body.min_order_amount);
      if (!Number.isFinite(n) || n < 0) return bad('Minimum Order Must Be Zero Or Greater.');
      updates.min_order_amount = Math.round(n * 100) / 100;
    }
  }

  if (body.max_uses !== undefined) {
    if (body.max_uses === null || body.max_uses === '') updates.max_uses = null;
    else {
      const n = Number(body.max_uses);
      if (!Number.isInteger(n) || n < 1 || n > 100000) return bad('Max Uses Must Be A Whole Number 1-100,000.');
      updates.max_uses = n;
    }
  }

  if (body.max_uses_per_user !== undefined) {
    if (body.max_uses_per_user === null || body.max_uses_per_user === '') updates.max_uses_per_user = null;
    else {
      const n = Number(body.max_uses_per_user);
      if (!Number.isInteger(n) || n < 1) return bad('Max Uses Per User Must Be A Whole Number Of One Or More.');
      updates.max_uses_per_user = n;
    }
  }

  function parseTsField(input: unknown, allowPast = false): string | null | undefined {
    if (input === undefined) return undefined;
    if (input === null || input === '') return null;
    const s = String(input);
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T23:59:59Z` : s;
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return undefined;
    if (!allowPast && t <= Date.now()) return undefined;
    return new Date(t).toISOString();
  }

  if (body.starts_at !== undefined) {
    const v = parseTsField(body.starts_at, true);
    if (v === undefined) return bad('Start Date Is Invalid.');
    updates.starts_at = v;
  }
  if (body.expires_at !== undefined) {
    const v = parseTsField(body.expires_at, false);
    if (v === undefined) return bad('Expiration Date Must Be A Valid Future Date.');
    updates.expires_at = v;
  }

  if (Object.keys(updates).length === 0) return bad('No Updatable Fields Provided.');

  const { data, error } = await gate.svc
    .from('coupons')
    .update(updates)
    .eq('id', gate.id)
    .select('*')
    .maybeSingle();

  if (error) return bad('Failed To Update Coupon.', 500);
  return NextResponse.json({ coupon: data });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const gate = await gateAndOwn(req, ctx);
  if (!gate.ok) return gate.response;

  // Soft-delete: stamp deleted_at and mark inactive. Redemption history /
  // statement_orders linkage stays intact.
  const { error } = await gate.svc
    .from('coupons')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', gate.id);
  if (error) return bad('Failed To Delete Coupon.', 500);
  return NextResponse.json({ success: true });
}
