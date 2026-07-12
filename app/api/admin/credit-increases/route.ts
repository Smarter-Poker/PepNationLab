// Admin Credit-Increase Review - list and decide agent credit-limit increase
// requests. Approving raises the agent's profiles.credit_limit (atomic RPC
// decide_credit_increase). Pending requests are surfaced first.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const svc = await createServiceClient();
  const { data: reqs } = await svc
    .from('credit_increase_requests')
    .select('id, agent_id, current_limit, requested_limit, reason, status, decided_at, decision_note, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const ids = Array.from(new Set((reqs ?? []).map((r) => r.agent_id)));
  const nameById = new Map<string, { full_name: string | null; email: string; account_type: string | null; credit_limit: number; prepaid_balance: number }>();
  if (ids.length > 0) {
    const { data: profs } = await svc
      .from('profiles')
      .select('id, full_name, email, account_type, credit_limit, prepaid_balance')
      .in('id', ids);
    for (const p of profs ?? []) {
      nameById.set(p.id, { full_name: p.full_name, email: p.email, account_type: p.account_type, credit_limit: Number(p.credit_limit || 0), prepaid_balance: Number(p.prepaid_balance || 0) }); // @ts-ignore
    }
  }

  // Order-history context so the reviewer can judge volume at a glance:
  // lifetime non-cancelled order count + dollar volume per requesting agent.
  const orderStats = new Map<string, { count: number; volume: number }>();
  if (ids.length > 0) {
    const { data: ords } = await svc
      .from('orders')
      .select('agent_id, total, status')
      .in('agent_id', ids)
      .neq('status', 'cancelled');
    for (const o of ords ?? []) {
      const cur = orderStats.get(o.agent_id) ?? { count: 0, volume: 0 }; // @ts-ignore
      cur.count += 1;
      cur.volume += Number(o.total || 0);
      orderStats.set(o.agent_id, cur); // @ts-ignore
    }
  }

  const rows = (reqs ?? []).map((r) => {
    const p = nameById.get(r.agent_id);
    const stats = orderStats.get(r.agent_id);
    return {
      ...r,
      current_limit: Number(r.current_limit || 0),
      requested_limit: Number(r.requested_limit || 0),
      agent_name: p?.full_name || p?.email || 'Agent',
      agent_email: p?.email || '',
      account_type: p?.account_type || null,
      live_limit: p?.credit_limit ?? null,
      prepaid_balance: p?.prepaid_balance ?? null,
      orders_count: stats?.count ?? 0,
      orders_volume: Math.round((stats?.volume ?? 0) * 100) / 100,
    };
  });

  // Pending first, then most recent.
  rows.sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (b.status === 'pending' && a.status !== 'pending') return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return NextResponse.json({ requests: rows });
}

const Body = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(['approved', 'denied']),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e: any) { return NextResponse.json({ error: 'bad_request', details: e.errors }, { status: 400 }); }

  const svc = await createServiceClient();
  const { data, error } = await svc.rpc('decide_credit_increase', {
    p_request_id: body.requestId,
    p_decision: body.decision,
    p_admin: gate.userId,
    p_note: body.note?.trim() || null, // @ts-ignore
  });
  if (error) {
    const msg = error.message?.includes('already_decided') ? 'This Request Was Already Decided.'
      : error.message?.includes('not_found') ? 'Request Not Found.'
      : 'Failed To Save Decision. Please Try Again.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const result = (data ?? {}) as { agent_id?: string; new_limit?: number | null };

  // Notify the agent (best-effort). notify() writes the in-app bell entry AND
  // queues a gated web push, matching how the request-side notifies admins.
  try {
    if (result.agent_id) {
      await notify(svc, {
        userId: result.agent_id,
        type: 'system',
        title: body.decision === 'approved' ? 'Credit Increase Approved' : 'Credit Increase Decision',
        body: body.decision === 'approved'
          ? `Your New Credit Limit Is $${Number(result.new_limit || 0).toFixed(2)}.`
          : 'Your Credit Increase Request Was Not Approved At This Time.',
        url: '/wallet',
      });
    }
  } catch { /* notify must not block */ }

  // Audit (best-effort).
  try {
    await svc.from('admin_audit_log').insert({
      actor_id: gate.userId, action: 'credit_increase_decided',
      entity_type: 'credit_increase_request', entity_id: body.requestId,
      changes: { decision: body.decision, note: body.note ?? null, result },
    });
  } catch { /* audit must not block */ }

  return NextResponse.json({ ok: true, result });
}
