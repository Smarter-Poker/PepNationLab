// R24 phase 6 - Sales heatmap. Buckets orders by (day_of_week, hour) over a range.
import { NextResponse } from 'next/server';
import { safeError } from '@/lib/api-error';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { parseRange } from '@/lib/sales-range';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { start, end } = parseRange(new URL(req.url).searchParams);
  const svc = await createServiceClient();
  const { data: orders, error } = await svc
    .from('orders')
    .select('created_at')
    .eq('agent_id', user.id)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .neq('status', 'cancelled')
    .limit(50000);
  if (error) return safeError('sales.heatmap', error, 400);

  // 7 dows x 24 hours = 168 buckets
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  (orders ?? []).forEach((o: { created_at: string | Date }) => {
    const d = new Date(o.created_at);
    grid[d.getUTCDay()][d.getUTCHours()] += 1;
  });
  const cells: Record<string, unknown>[] = [];
  for (let dow = 0; dow < 7; dow++) {
    for (let h = 0; h < 24; h++) {
      cells.push({ dow, hour: h, orders: grid[dow][h] });
    }
  }
  return NextResponse.json({ cells, total: (orders ?? []).length });
}
