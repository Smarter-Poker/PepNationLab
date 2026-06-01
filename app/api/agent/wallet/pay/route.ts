// Round 24 Wallet — Pay Now endpoint
// Calls pay_weekly_statement RPC atomically.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  statement_id: z.string().uuid(),
  handle: z.string().min(1).max(64),
  amount: z.number().positive(),
  proof_id: z.string().uuid().nullable().optional(),
});

export async function POST(req: Request) {
  try { assertSameOrigin(req); }
  catch { return NextResponse.json({ error: 'csrf' }, { status: 403 }); }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e: any) { return NextResponse.json({ error: 'bad_request', details: e.errors }, { status: 400 }); }

  const svc = createServiceClient();
  const { data, error } = await svc.rpc('pay_weekly_statement', {
    p_statement_id: body.statement_id,
    p_handle: body.handle,
    p_amount: body.amount,
    p_proof_id: body.proof_id ?? null,
  });
  if (error) {
    const code = error.message?.includes('amount_mismatch') ? 409
      : error.message?.includes('forbidden') ? 403
      : error.message?.includes('statement_not_payable') ? 409
      : 400;
    return NextResponse.json({ error: error.message }, { status: code });
  }
  return NextResponse.json({ ok: true, result: data });
}
