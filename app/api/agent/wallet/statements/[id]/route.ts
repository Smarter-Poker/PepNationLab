// Round 24 Wallet - statement detail
import { NextResponse } from 'next/server';
import { safeError } from '@/lib/api-error';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = await createServiceClient();
  const { data: stmt } = await svc
    .from('weekly_statements')
    .select('id, agent_id, week_start, week_end, total_cogs, total_shipping, total_owed, status, paid_at, payment_method, due_date, disputed_at, dispute_reason')
    .eq('id', id)
    .maybeSingle();
  if (!stmt) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Ownership check: only the owning agent or an admin may view this statement.
  const { data: profile } = await svc
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (stmt.agent_id !== user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // R24 hotfix: get_statement_detail requires auth.uid(); call via user-authed client.
  const { data: orders, error } = await supabase.rpc('get_statement_detail', { p_statement_id: id });
  if (error) return safeError('wallet.statement', error, 400);

  return NextResponse.json({ statement: stmt, orders: orders ?? [] });
}
