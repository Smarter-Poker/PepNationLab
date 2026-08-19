// Unified "I have paid this" endpoint.
//
// This SUBMITS A CLAIM; it does not settle anything. pay_invoice records the
// proof and parks the bill in pending_verification. The credit line is not
// released and the payee's wallet is not credited until the person who was
// supposed to receive the money confirms it arrived, via
// /api/agent/wallet/confirm-payment.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireAgent } from '@/lib/admin-auth';
import { rateLimit } from '@/lib/rate-limit';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';
import { safeError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  // Either of these is required. target_type lets the same endpoint handle
  // weekly_statements and agent_invoices uniformly.
  target_type: z.enum(['statement', 'agent_invoice']).optional(),
  target_id: z.string().uuid().optional(),
  // Backward compat: callers that still send statement_id continue to work.
  statement_id: z.string().uuid().optional(),
  handle: z.string().min(1).max(64),
  amount: z.number().positive().finite().max(1_000_000),
  // Proof is now MANDATORY. Payment used to settle the bill, release the
  // payer's credit line and credit the payee's spendable wallet on the payer's
  // word alone, while discarding this field entirely.
  proof_id: z.string().uuid(),
}).refine(
  (v) => !!(v.target_id || v.statement_id),
  { message: 'Missing target_id (or legacy statement_id).' }
);

/**
 * Map the RPC's sentinel exceptions to a status and a sentence a human can
 * read. Previously the raw Postgres message was returned verbatim on the
 * fall-through branch, so an unexpected error (a constraint name, a missing
 * column, "permission denied for table balance_transactions") went straight to
 * the browser - and the client rendered it as a toast reading
 * "Pay Failed: amount_mismatch".
 */
const SENTINELS: Array<{ match: string; status: number; message: string }> = [
  { match: 'amount_mismatch', status: 409, message: 'That Amount No Longer Matches This Bill. Refresh And Try Again.' },
  { match: 'proof_required', status: 400, message: 'Attach Proof Of Payment Before Submitting.' },
  { match: 'proof_invalid', status: 400, message: 'That Proof Does Not Match This Bill. Upload It Again.' },
  { match: 'already_submitted', status: 409, message: 'A Payment For This Bill Is Already Awaiting Confirmation.' },
  { match: 'already_paid', status: 409, message: 'This Bill Has Already Been Paid.' },
  { match: 'forbidden', status: 403, message: 'This Bill Does Not Belong To Your Account.' },
  { match: 'unauthorized', status: 401, message: 'Please Sign In Again.' },
  { match: 'target_not_found', status: 404, message: 'That Bill Could Not Be Found.' },
  { match: 'invalid_target_type', status: 400, message: 'Unrecognised Bill Type.' },
];

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  // This is the only money-moving POST on the wallet surface and it had
  // neither of the protections its siblings have. Each call takes a row lock
  // on the bill, on the payer, and on the SAME house payee row for every agent
  // on the platform - so an unthrottled loop here serialises everyone's
  // payments behind one contended row.
  const rl = await rateLimit({
    key: 'wallet_pay',
    limit: 10,
    windowSeconds: 60,
    identifier: gate.user.id,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too Many Payment Attempts. Wait A Moment Then Try Again.' },
      { status: 429 },
    );
  }

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e: any) { return NextResponse.json({ error: 'Invalid Payment Request.', details: e.errors }, { status: 400 }); }

  const targetType = body.target_type ?? 'statement';
  const targetId = body.target_id ?? body.statement_id!;

  // Idempotency: the DB already serialises concurrent calls (the bill is
  // locked FOR UPDATE and the second caller sees status='paid'), so a double
  // charge was never possible. The USER-visible failure was: a request times
  // out, the client retries, the retry 409s "already_paid", and the agent is
  // told their payment failed on a payment that actually succeeded - so they
  // pay again out-of-band.
  return withIdempotency({
    userId: gate.user.id,
    route: '/api/agent/wallet/pay',
    key: readIdempotencyKey(req as any),
    request: { targetType, targetId, amount: body.amount, handle: body.handle, proofId: body.proof_id },
    handler: async () => {
      const supabase = await createClient();

      // Ownership is enforced inside the SECURITY DEFINER function against
      // auth.uid(). Assert it here too so the route does not depend solely on
      // the RPC's admin bypass staying correct.
      const { data, error } = await supabase.rpc('pay_invoice', {
        p_target_type: targetType,
        p_target_id: targetId,
        p_handle: body.handle,
        p_amount: body.amount,
        p_proof_id: body.proof_id,
      });

      if (error) {
        const msg = error.message ?? '';
        const hit = SENTINELS.find((s) => msg.includes(s.match));
        if (hit) {
          return NextResponse.json({ error: hit.message, code: hit.match }, { status: hit.status });
        }
        // Anything unrecognised is a real fault: log it, tell the user nothing.
        return safeError('wallet.pay', error, 500, 'Payment Could Not Be Completed. Please Try Again.');
      }

      return NextResponse.json({ ok: true, result: data });
    },
  });
}
