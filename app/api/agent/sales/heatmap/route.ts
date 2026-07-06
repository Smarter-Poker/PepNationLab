// R24 phase 6 - Sales heatmap. Buckets orders by (day_of_week, hour) over a range.
import { NextResponse } from 'next/server';
import { safeError } from '@/lib/api-error';
import { createServiceClient } from '@/lib/supabase/server';
import { parseRange } from '@/lib/sales-range';
import { requireAgent } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const { start, end } = parseRange(new URL(req.url).searchParams);
  const svc = await createServiceClient();
  const { data: orders, error } = await svc
    .from('orders')
    .select('created_at')
    .eq('agent_id', gate.user.id)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .neq('status', 'cancelled')
    .limit(50000);
  if (error) return safeError('sales.heatmap', error, 400);

  // 7 dows x 24 hours = 168 buckets
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  (orders ?? []).forEach((o: any) => {
    const d = new Date(o.created_at);
    grid[d.getUTCDay()][d.getUTCHours()] += 1;
  });
  const cells: any[] = [];
  for (let dow = 0; dow < 7; dow++) {
    for (let h = 0; h < 24; h++) {
      cells.push({ dow, hour: h, orders: grid[dow][h] });
    }
  }
  return NextResponse.json({ cells, total: (orders ?? []).length });
}
