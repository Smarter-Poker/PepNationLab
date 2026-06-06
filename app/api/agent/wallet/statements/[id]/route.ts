// Round 24 Wallet - statement detail
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = await createServiceClient();
  const { data: stmt } = await svc
    .from('weekly_statements')
    .select('id, agent_id, week_start, week_end, total_cogs, total_shipping, total_owed, status, paid_at, payment_method, due_date, disputed_at, dispute_reason')
    .eq('id', id)
    .single();
  if (!stmt) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // R24 hotfix: get_statement_detail requires auth.uid(); call via user-authed client.
  const { data: orders, error } = await supabase.rpc('get_statement_detail', { p_statement_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ statement: stmt, orders: orders ?? [] });
}
