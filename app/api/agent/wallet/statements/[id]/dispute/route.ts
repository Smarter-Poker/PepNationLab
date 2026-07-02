// Wallet - dispute a weekly statement. Records disputed_at + dispute_reason on
// the agent's own statement. Cannot dispute a paid statement. Admin reviews via
// the existing admin statements surface.
import { NextResponse } from 'next/server';
import { safeError } from '@/lib/api-error';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({ reason: z.string().min(3).max(1000) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;

  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e: any) { return NextResponse.json({ error: 'bad_request', details: e.errors }, { status: 400 }); }

  const svc = await createServiceClient();
  const { data: stmt } = await svc
    .from('weekly_statements')
    .select('id, agent_id, status, disputed_at')
    .eq('id', id)
    .maybeSingle();
  if (!stmt) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (stmt.agent_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (stmt.status === 'paid') return NextResponse.json({ error: 'already_paid' }, { status: 409 });
  if (stmt.disputed_at) return NextResponse.json({ error: 'already_disputed' }, { status: 409 });

  const { error } = await svc
    .from('weekly_statements')
    .update({ disputed_at: new Date().toISOString(), dispute_reason: body.reason })
    .eq('id', id)
    .eq('agent_id', user.id)
    .neq('status', 'paid');
  if (error) return safeError('wallet.dispute', error, 400);

  return NextResponse.json({ ok: true });
}
