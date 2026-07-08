import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLLECTED = new Set([
  'approved_ship',
  'approved_pickup',
  'in_fulfillment',
  'shipped',
  'delivered',
]);

function csvEscape(s: unknown): string {
  if (s === null || s === undefined) return '';
  const t = String(s);
  if (t.includes('"') || t.includes(',') || t.includes('\n')) {
    return `"${t.replace(/"/g, '""')}"`;
  }
  return t;
}

/**
 * GET /api/agent/researchers/export
 *
 * One-shot CSV export of the agent's researcher list. Mirrors the columns
 * shown in the table plus a Tags column (semicolon-separated). Used for
 * accounting, tax filing, or migrating to an external CRM.
 */
export async function GET() {
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;
  const agentId = gate.user.id;
  const svc = await createServiceClient();

  try {
    const { data: researchers } = await svc
      .from('profiles')
      .select('id, full_name, username, email, phone, created_at, last_sign_in_at, acquisition_source')
      .eq('referring_agent_id', agentId)
      .eq('role', 'researcher')
      .order('created_at', { ascending: false });

    const list = researchers ?? [];

    const { data: orders } = await svc
      .from('orders')
      .select('buyer_id, total, status, created_at')
      .eq('agent_id', agentId);

    const { data: tags } = await svc
      .from('agent_researcher_tags')
      .select('researcher_id, tag')
      .eq('agent_id', agentId);

    const aggByBuyer = new Map<string, { count: number; spent: number; last: string | null }>();
    for (const o of orders ?? []) {
      if (o.status === 'cancelled' || !o.buyer_id) continue;
      const buyerId = o.buyer_id as string;
      const a = aggByBuyer.get(buyerId) ?? { count: 0, spent: 0, last: null };
      a.count += 1;
      if (COLLECTED.has(o.status as string)) a.spent += Number(o.total ?? 0);
      const created = o.created_at as string;
      if (!a.last || created > a.last) a.last = created;
      aggByBuyer.set(buyerId, a);
    }

    const tagsByResearcher = new Map<string, string[]>();
    for (const t of tags ?? []) {
      const arr = tagsByResearcher.get(t.researcher_id as string) ?? [];
      arr.push(t.tag as string);
      tagsByResearcher.set(t.researcher_id as string, arr);
    }

    const header = [
      'Researcher ID',
      'Full Name',
      'Username',
      'Email',
      'Phone',
      'Joined',
      'Last Login',
      'Orders',
      'Lifetime Value (USD)',
      'Last Order',
      'Tags',
      'Acquisition Source',
    ];

    const rows = list.map((r) => {
      const a = aggByBuyer.get(r.id as string) ?? { count: 0, spent: 0, last: null };
      const t = tagsByResearcher.get(r.id as string) ?? [];
      return [
        r.id,
        r.full_name ?? '',
        r.username ?? '',
        r.email ?? '',
        (r as { phone?: string }).phone ?? '',
        (r.created_at as string)?.slice(0, 10) ?? '',
        (r.last_sign_in_at as string | null)?.slice(0, 19) ?? '',
        a.count,
        a.spent.toFixed(2),
        a.last ? a.last.slice(0, 10) : '',
        t.join('; '),
        r.acquisition_source ?? '',
      ];
    });

    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const filename = `pepnationlab-researchers-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[researchers/export] error:', err);
    return NextResponse.json({ error: 'Failed To Export Researchers' }, { status: 500 });
  }
}
