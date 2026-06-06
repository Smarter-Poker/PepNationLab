// Admin Agent Payments - record a weekly-bill payment / send credit to an agent
// or super-agent account. Prepaid agents get their prepaid_balance topped up;
// credit-line agents have their running credit_used paid down. Backed by the
// atomic SECURITY DEFINER admin_credit_account RPC. A full payoff marks the
// agent's open weekly statements Paid In Full (handled inside the RPC).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const svc = await createServiceClient();
  const { data: agents } = await svc
    .from('profiles')
    .select('id, full_name, email, role, is_super_agent, account_type, prepaid_balance, credit_limit, credit_used')
    .in('role', ['agent', 'super_agent'])
    .order('full_name', { ascending: true });

  const ids = (agents ?? []).map((a) => a.id);
  const owedByAgent = new Map<string, number>();
  if (ids.length > 0) {
    const { data: stmts } = await svc
      .from('weekly_statements')
      .select('agent_id, total_owed')
      .in('agent_id', ids)
      .in('status', ['open', 'pending_payment']);
    for (const s of stmts ?? []) {
      owedByAgent.set(s.agent_id, (owedByAgent.get(s.agent_id) ?? 0) + Number(s.total_owed || 0));
    }
  }

  const rows = (agents ?? []).map((a) => ({
    id: a.id,
    full_name: a.full_name,
    email: a.email,
    role: a.role,
    is_super_agent: a.is_super_agent,
    account_type: a.account_type,
    prepaid_balance: Number(a.prepaid_balance || 0),
    credit_limit: Number(a.credit_limit || 0),
    credit_used: Number(a.credit_used || 0),
    open_owed: Math.round((owedByAgent.get(a.id) ?? 0) * 100) / 100,
  }));

  return NextResponse.json({ agents: rows });
}

const Body = z.object({
  agentId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000),
  note: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e: any) { return NextResponse.json({ error: 'bad_request', details: e.errors }, { status: 400 }); }

  const amount = Math.round(body.amount * 100) / 100;
  const description = body.note && body.note.trim()
    ? `Admin Payment: ${body.note.trim().slice(0, 180)}`
    : 'Weekly Bill Payment';

  const svc = await createServiceClient();
  const { data, error } = await svc.rpc('admin_credit_account', {
    p_agent_id: body.agentId,
    p_amount: amount,
    p_created_by: gate.userId,
    p_description: description,
  });
  if (error) {
    console.error('[admin/payments] admin_credit_account failed:', error.message);
    return NextResponse.json({ error: 'Failed To Record Payment. Please Try Again.' }, { status: 500 });
  }

  // Audit (best-effort).
  try {
    await svc.from('admin_audit_log').insert({
      actor_id: gate.userId, action: 'agent_payment_recorded',
      entity_type: 'profile', entity_id: body.agentId,
      changes: { amount, note: body.note ?? null, result: data },
    });
  } catch { /* audit must not block */ }

  // Notify the agent (best-effort).
  try {
    await svc.from('notifications').insert({
      user_id: body.agentId,
      title: 'Payment Applied To Your Account',
      body: `A Payment Of $${amount.toFixed(2)} Was Applied By The Lab.`,
      type: 'system',
      url: '/wallet',
    });
  } catch { /* notify must not block */ }

  return NextResponse.json({ ok: true, result: data });
}
