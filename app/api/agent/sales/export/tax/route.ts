// Round 24 Sales - Tax-Ready CSV per state.
import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { safeError } from '@/lib/api-error';
import { requireAgentOrAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;
  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get('year') ?? String(new Date().getFullYear()), 10);
  const svc = await createServiceClient();
  const { data, error } = await svc.rpc('agent_sales_tax_summary', { p_agent_id: gate.user.id, p_year: year });
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
