// Invoice v2 - unified Pay Now endpoint.
// Calls pay_invoice(target_type, target_id, handle, amount, proof_id) which
// marks the invoice paid AND credits the payee's prepaid_balance.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

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
  amount: z.number().positive(),
  proof_id: z.string().uuid().nullable().optional(),
}).refine(
  (v) => !!(v.target_id || v.statement_id),
  { message: 'Missing target_id (or legacy statement_id).' }
);

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ { return NextResponse.json({ error: 'bad_request', details: e.errors }, { status: 400 }); }

  const targetType = body.target_type ?? 'statement';
  const targetId = body.target_id ?? body.statement_id!;

  const { data, error } = await supabase.rpc('pay_invoice', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_handle: body.handle,
    p_amount: body.amount,
    p_proof_id: body.proof_id ?? null,
  });

  if (error) {
    const msg = error.message ?? '';
    const code = msg.includes('amount_mismatch') ? 409
      : msg.includes('forbidden') ? 403
      : msg.includes('unauthorized') ? 401
      : msg.includes('already_paid') ? 409
      : msg.includes('target_not_found') ? 404
      : msg.includes('invalid_target_type') ? 400
      : 400;
    return NextResponse.json({ error: msg }, { status: code });
  }
  return NextResponse.json({ ok: true, result: data });
}
