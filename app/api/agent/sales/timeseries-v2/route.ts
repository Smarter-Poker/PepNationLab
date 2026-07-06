import { NextResponse } from 'next/server';
import { safeError } from '@/lib/api-error';
import { createClient } from '@/lib/supabase/server';
import { parseRange } from '@/lib/sales-range';
import { requireAgent } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;
  const supabase = await createClient();
  const { start, end } = parseRange(new URL(req.url).searchParams);
  // R24 hotfix: user-authed client
  const { data, error } = await supabase.rpc('agent_sales_timeseries', {
    p_agent_id: gate.user.id,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });
  if (error) return safeError('sales.timeseries-v2', error, 400);
  return NextResponse.json({ points: data ?? [] });
}
