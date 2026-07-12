
// Admin Dispute Queue - list disputed weekly statements and resolve them.
// Resolving records dispute_resolved_at/resolution + an admin note (atomic RPC
// resolve_statement_dispute). Unresolved disputes are surfaced first.
import { NextRequest, NextResponse } from 'next/server';
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
  const { data: stmts } = await svc
    .from('weekly_statements')
    .select('id, agent_id, week_start, week_end, total_owed, status, disputed_at, dispute_reason, dispute_resolved_at, dispute_resolution')
    .not('disputed_at', 'is', null)
    .order('disputed_at', { ascending: false })
    .limit(200);

  const ids = Array.from(new Set((stmts ?? []).map((s) => s.agent_id)));
  const nameById = new Map<string, { full_name: string | null; email: string }>();
  if (ids.length > 0) {
    const { data: profs } = await svc.from('profiles').select('id, full_name, email').in('id', ids);
    for (const p of profs ?? []) nameById.set(p.id, { full_name: p.full_name, email: p.email }); // @ts-ignore
  }

  const rows = (stmts ?? []).map((s) => {
    const p = nameById.get(s.agent_id);
    return {
      ...s,
      total_owed: Number(s.total_owed || 0),
      agent_name: p?.full_name || p?.email || 'Agent',
      agent_email: p?.email || '',
      resolved: !!s.dispute_resolved_at,
    };
  });

  // Unresolved first.
  rows.sort((a, b) => {
    if (!a.resolved && b.resolved) return -1;
    if (a.resolved && !b.resolved) return 1;
    return (b.disputed_at ? new Date(b.disputed_at as string).getTime() : 0) - (a.disputed_at ? new Date(a.disputed_at as string).getTime() : 0);
  });

  return NextResponse.json({ disputes: rows });
}

const Body = z.object({
  statementId: z.string().uuid(),
  resolution: z.string().max(120).optional(),
  note: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e: any) { return NextResponse.json({ error: 'bad_request', details: e.errors }, { status: 400 }); }

  const svc = await createServiceClient();
  const { error } = await svc.rpc('resolve_statement_dispute', {
    p_statement_id: body.statementId,
    p_resolution: body.resolution?.trim() || 'resolved',
    p_admin: gate.userId,
    p_note: body.note?.trim() || null, // @ts-ignore
  });
  if (error) {
    const msg = error.message?.includes('already_resolved') ? 'This Dispute Was Already Resolved.'
      : error.message?.includes('not_disputed') ? 'This Statement Is Not Disputed.'
      : error.message?.includes('not_found') ? 'Statement Not Found.'
      : 'Failed To Resolve. Please Try Again.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Fetch the agent to notify (best-effort).
  try {
    const { data: stmt } = await svc.from('weekly_statements').select('agent_id').eq('id', body.statementId).maybeSingle();
    if (stmt?.agent_id) {
      await svc.from('notifications').insert({
        user_id: stmt.agent_id,
        title: 'Statement Dispute Resolved',
        body: 'The Lab Reviewed And Resolved Your Statement Dispute.',
        type: 'system',
        url: '/wallet',
      });
    }
  } catch { /* notify must not block */ }

  // Audit (best-effort).
  try {
    await svc.from('admin_audit_log').insert({
      actor_id: gate.userId, action: 'statement_dispute_resolved',
      entity_type: 'weekly_statement', entity_id: body.statementId,
      changes: { resolution: body.resolution ?? 'resolved', note: body.note ?? null },
    });
  } catch { /* audit must not block */ }

  return NextResponse.json({ ok: true });
}
