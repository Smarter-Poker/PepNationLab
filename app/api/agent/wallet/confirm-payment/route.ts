import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { safeError } from '@/lib/api-error';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * "Did you receive this payment?"
 *
 * The second half of the payment chain. pay_invoice now only records a CLAIM
 * (proof attached, bill parked in pending_verification); nothing settles and no
 * wallet is credited until the person who was supposed to receive the money
 * says here that it arrived.
 *
 * GET  - bills awaiting MY confirmation (upline super agent, or admin for
 *        house statements), with signed links to the submitted proof.
 * POST - approve or reject one.
 */

const Body = z.object({
  target_type: z.enum(['statement', 'agent_invoice']),
  target_id: z.string().uuid(),
  approve: z.boolean(),
  note: z.string().max(500).optional(),
});

export async function GET() {
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;

  const svc = await createServiceClient();
  const { data: me } = await svc.from('profiles').select('role').eq('id', gate.user.id).maybeSingle();
  const isAdmin = me?.role === 'admin';

  // Invoices where I am the upline being paid.
  const { data: invoices, error: invErr } = await svc
    .from('agent_invoices')
    .select('id, agent_id, week_start, week_end, total_owed, status, payment_method, payment_proof_id, payment_submitted_at')
    .eq('super_agent_id', gate.user.id)
    .eq('status', 'pending_verification')
    .order('payment_submitted_at', { ascending: true });

  if (invErr) return safeError('wallet.confirm.list_invoices', invErr, 500);

  // House statements are confirmed by admins.
  let statements: any[] = [];
  if (isAdmin) {
    const { data: stmts, error: stmtErr } = await svc
      .from('weekly_statements')
      .select('id, agent_id, week_start, week_end, total_owed, status, payment_method, payment_proof_id, payment_submitted_at')
      .eq('status', 'pending_verification')
      .order('payment_submitted_at', { ascending: true });
    if (stmtErr) return safeError('wallet.confirm.list_statements', stmtErr, 500);
    statements = stmts ?? [];
  }

  const rows = [
    ...(invoices ?? []).map((r: any) => ({ ...r, target_type: 'agent_invoice' as const })),
    ...statements.map((r: any) => ({ ...r, target_type: 'statement' as const })),
  ];

  // Names + a short-lived link to the evidence, so the confirmer can actually
  // look at what they are approving.
  const agentIds = Array.from(new Set(rows.map((r) => r.agent_id)));
  const nameById = new Map<string, string>();
  if (agentIds.length > 0) {
    const { data: profiles } = await svc.from('profiles').select('id, full_name, email').in('id', agentIds);
    for (const p of profiles ?? []) {
      nameById.set(p.id as string, (p.full_name as string) || (p.email as string) || 'Agent');
    }
  }

  const enriched = await Promise.all(
    rows.map(async (r) => {
      let proofUrl: string | null = null;
      if (r.payment_proof_id) {
        const { data: proof } = await svc
          .from('payment_proofs').select('storage_key').eq('id', r.payment_proof_id).maybeSingle();
        if (proof?.storage_key) {
          const { data: signed } = await svc.storage
            .from('payment-proofs').createSignedUrl(proof.storage_key as string, 600);
          proofUrl = signed?.signedUrl ?? null;
        }
      }
      return { ...r, payer_name: nameById.get(r.agent_id) ?? 'Agent', proof_url: proofUrl };
    }),
  );

  const total = enriched.reduce((sum, r) => sum + (Number(r.total_owed) || 0), 0);

  return NextResponse.json({
    awaiting: enriched,
    count: enriched.length,
    total: Math.round(total * 100) / 100,
  });
}

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;

  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;

  const rl = await rateLimit({ key: 'wallet_confirm_payment', limit: 30, windowSeconds: 60, identifier: gate.user.id });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too Many Requests. Wait A Moment Then Try Again.' }, { status: 429 });
  }

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch { return NextResponse.json({ error: 'Invalid Request.' }, { status: 400 }); }

  // Authorization lives inside confirm_invoice_payment against auth.uid(): only
  // the payee or an admin may confirm, and the payer never can. Call it with
  // the user-scoped client so auth.uid() is the real caller.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('confirm_invoice_payment', {
    p_target_type: body.target_type,
    p_target_id: body.target_id,
    p_approve: body.approve,
    p_note: body.note ?? null,
  });

  if (error) {
    const msg = error.message ?? '';
    const map: Array<[string, number, string]> = [
      ['not_awaiting_confirmation', 409, 'This Bill Is Not Waiting For Confirmation.'],
      ['already_paid', 409, 'This Bill Has Already Been Settled.'],
      ['forbidden', 403, 'Only The Account Receiving This Payment Can Confirm It.'],
      ['unauthorized', 401, 'Please Sign In Again.'],
      ['target_not_found', 404, 'That Bill Could Not Be Found.'],
      ['invalid_target_type', 400, 'Unrecognised Bill Type.'],
    ];
    const hit = map.find(([code]) => msg.includes(code));
    if (hit) return NextResponse.json({ error: hit[2], code: hit[0] }, { status: hit[1] });
    return safeError('wallet.confirm_payment', error, 500, 'Could Not Record That Confirmation. Please Try Again.');
  }

  // Tell the payer either way - a rejection especially, since their bill goes
  // back to unpaid and they need to know why.
  try {
    const svc = await createServiceClient();
    const payerId = (data as any)?.payer as string | undefined;
    if (payerId) {
      await notify(svc, {
        userId: payerId,
        type: 'system',
        title: body.approve ? 'Payment Confirmed' : 'Payment Not Confirmed',
        body: body.approve
          ? 'Your payment was confirmed received. The bill is settled and your credit line has been released.'
          : `Your payment could not be confirmed${body.note ? `: ${body.note}` : ''}. The bill is unpaid again - please check and resubmit.`,
        url: '/wallet?tab=invoices',
      });
    }
  } catch { /* best-effort: the money move is already committed */ }

  return NextResponse.json({ ok: true, result: data });
}
