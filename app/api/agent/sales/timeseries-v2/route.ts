import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseRange } from '@/lib/sales-range';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { start, end } = parseRange(new URL(req.url).searchParams);
  // R24 hotfix: user-authed client
  const { data, error } = await supabase.rpc('agent_sales_timeseries', {
    p_agent_id: user.id,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ points: data ?? [] });
}
