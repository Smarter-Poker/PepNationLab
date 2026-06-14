// Round 24 Sales - Tax-Ready CSV per state.
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('unauthorized', { status: 401 });
  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get('year') ?? String(new Date().getFullYear()), 10);
  const svc = await createServiceClient();
  const { data, error } = await svc.rpc('agent_sales_tax_summary', { p_agent_id: user.id, p_year: year });
  if (error) return safeError('sales.export.tax', error, 400);
  const header = 'State,Orders,Gross Revenue USD\n';
  const rows = (data ?? []).map((r: any) =>
    `${r.state},${r.orders_count},${(Number(r.gross_revenue_cents) / 100).toFixed(2)}`
  );
  const csv = header + rows.join('\n') + '\n';
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="tax-summary-${year}.csv"`,
    },
  });
}
