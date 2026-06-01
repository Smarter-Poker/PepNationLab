// Round 24 Wallet — credit increase request
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  requested_limit: z.number().positive().max(1_000_000),
  reason: z.string().min(3).max(500),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const svc = createServiceClient();
  const { data } = await svc
    .from('credit_increase_requests')
    .select('id, current_limit, requested_limit, reason, status, decided_at, decision_note, created_at')
    .eq('agent_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  return NextResponse.json({ requests: data ?? [] });
}

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

  // Daily rate-limit: max 3 pending requests per day
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await svc
    .from('credit_increase_requests')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', user.id)
    .gte('created_at', oneDayAgo);
  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const { data: profile } = await svc.from('profiles').select('credit_limit').eq('id', user.id).single();
  const current = Number(profile?.credit_limit ?? 0);

  if (body.requested_limit <= current) {
    return NextResponse.json({ error: 'must_be_higher_than_current' }, { status: 400 });
  }

  const { data, error } = await svc
    .from('credit_increase_requests')
    .insert({
      agent_id: user.id,
      current_limit: current,
      requested_limit: body.requested_limit,
      reason: body.reason,
      status: 'pending',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, request: data });
}
