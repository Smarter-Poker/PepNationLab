import { NextResponse } from 'next/server';
import { safeError } from '@/lib/api-error';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function currentMonthBoundary() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const svc = await createServiceClient();
  const { start } = currentMonthBoundary();
  const { data } = await svc
    .from('agent_sales_goals')
    .select('id, period_start, period_end, target_cents, created_at')
    .eq('agent_id', user.id)
    .eq('period_start', start)
    .maybeSingle();
  return NextResponse.json({ goal: data ?? null });
}

const PostBody = z.object({ target_cents: z.number().int().positive().max(100_000_000_000) });

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: z.infer<typeof PostBody>;
  try { body = PostBody.parse(await req.json()); }
  catch (e: any) { return NextResponse.json({ error: 'bad_request', details: e.errors }, { status: 400 }); }
  const { start, end } = currentMonthBoundary();
  const svc = await createServiceClient();
  const { data, error } = await svc
    .from('agent_sales_goals')
    .upsert({
      agent_id: user.id,
      period_start: start,
      period_end: end,
      target_cents: body.target_cents,
    }, { onConflict: 'agent_id,period_start' })
    .select()
    .maybeSingle();
  if (error) return safeError('sales.goal', error, 400);
  return NextResponse.json({ ok: true, goal: data });
}
