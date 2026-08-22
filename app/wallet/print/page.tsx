import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import PrintButton from '@/components/wallet/PrintButton';
import { chicagoMidnightIso } from '@/lib/time-cst';

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Invoice | Pep Nation Lab',
  robots: { index: false, follow: true },
};

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n) || 0);

const fmtDate = (s: string | null | undefined): string => {
  if (!s) return '-';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? (s ?? '-') : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const STATUS_LABEL: Record<string, string> = {
  paid: 'Paid',
  pending_payment: 'Pending Payment',
  open: 'Open',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
};

interface SearchParams {
  type?: string;
  id?: string;
}

export default async function WalletPrintPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const type = params.type === 'agent_invoice' ? 'agent_invoice' : 'statement';
  const id = params.id ?? '';
  if (!id) redirect('/wallet');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const isAdmin = callerProfile?.role === 'admin';

  let row: any = null;
  let billsFrom = '';
  if (type === 'statement') {
    const { data } = await supabase
      .from('weekly_statements')
      .select('id, agent_id, week_start, week_end, total_cogs, total_shipping, total_owed, status, due_date, paid_at, payment_method, created_at')
      .eq('id', id)
      .maybeSingle();
    if (data && (isAdmin || data.agent_id === user.id)) row = data;
    billsFrom = 'Pep Nation Lab Admin';
  } else {
    const { data } = await supabase
      .from('agent_invoices')
      .select('id, agent_id, super_agent_id, week_start, week_end, total_cogs, total_shipping, total_owed, status, due_date, paid_at, payment_method, created_at')
      .eq('id', id)
      .maybeSingle();
    if (data && (isAdmin || data.agent_id === user.id || data.super_agent_id === user.id)) row = data;
    if (row?.super_agent_id) {
      const { data: superAgent } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', row.super_agent_id)
        .maybeSingle();
      billsFrom = superAgent?.full_name ? `Super Agent - ${superAgent.full_name}` : 'Super Agent';
    } else {
      billsFrom = 'Super Agent';
    }
  }

  if (!row) {
    return (
      <div style={{ padding: 40, fontFamily: 'Arial, sans-serif', color: '#222' }}>
        <h1 style={{ fontSize: 22 }}>Invoice Not Found</h1>
        <p>The Invoice You Requested Could Not Be Found, Or You Do Not Have Access To View It.</p>
      </div>
    );
  }

  const billedTo = await supabase
    .from('profiles')
    .select('full_name, username, email')
    .eq('id', row.agent_id)
    .maybeSingle();
  const billedToName = billedTo.data?.full_name || billedTo.data?.username || billedTo.data?.email || row.agent_id;

  const invoiceNumber = `${type === 'statement' ? 'STMT' : 'INV'}-${String(row.id).slice(0, 8).toUpperCase()}`;
  const cogs = Number(row.total_cogs || 0);
  const shipping = Number(row.total_shipping || 0);
  const owed = Number(row.total_owed || 0);

  // FETCH WEEKLY SALES DETAIL (PER-ORDER BREAKDOWN)
  //
  // The admin client is used here (not the RLS-bound `supabase` client above)
  // because linked orders can belong to a downline agent (super-agent
  // statements roll up their downlines' orders) or a sub-agent (agent
  // invoices bill a sub-agent's own orders). The standard "agent_id =
  // auth.uid()" RLS policy on `orders` blocks exactly those rows, which is
  // why this section previously rendered empty for any order not placed by
  // the caller themselves. Authorization is not widened: every order fetched
  // below is scoped to the statement/invoice `row` that was already
  // authorized above (via statement_orders keyed on row.id, or via
  // row.agent_id + the invoice's own billing window).
  const admin = createAdminClient();

  let orderRows: any[] = [];
  if (type === 'statement') {
    const { data: links } = await admin
      .from('statement_orders')
      .select('order_id')
      .eq('statement_id', row.id);
    const orderIds = (links || []).map((l: any) => l.order_id).filter(Boolean);
    if (orderIds.length > 0) {
      const { data: fetchedOrders } = await admin
        .from('orders')
        .select('id, created_at, agent_id, agent_approved_at, is_wholesale_restock, discount_amount')
        .in('id', orderIds);
      orderRows = fetchedOrders || [];
    }
  } else {
    // Same time-window and filters as the weekly invoice generator
    // (app/api/cron/invoices/route.ts): bill by agent_approved_at, falling
    // back to created_at for legacy orders with no approval timestamp, and
    // never include wholesale-restock self-buys (billed at checkout).
    const rangeStart = chicagoMidnightIso(row.week_start);
    const rangeEndExclusive = chicagoMidnightIso(addDays(row.week_start, 7));

    const { data: fetchedOrders } = await admin
      .from('orders')
      .select('id, created_at, agent_id, agent_approved_at, is_wholesale_restock, discount_amount, status')
      .eq('agent_id', row.agent_id)
      .neq('status', 'cancelled')
      .neq('status', 'pending_customer_payment')
      .neq('status', 'agent_approval_pending')
      .neq('is_wholesale_restock', true)
      .or(
        `and(agent_approved_at.gte.${rangeStart},agent_approved_at.lt.${rangeEndExclusive}),` +
        `and(agent_approved_at.is.null,created_at.gte.${rangeStart},created_at.lt.${rangeEndExclusive})`
      );
    orderRows = fetchedOrders || [];
  }

  // Batch-fetch order_items for every linked order in a single query
  // (never one query per order).
  const orderIdList = orderRows.map((o: any) => o.id);
  const itemsByOrder: Record<string, any[]> = {};
  if (orderIdList.length > 0) {
    const { data: items } = await admin
      .from('order_items')
      .select('order_id, quantity, unit_retail_price, unit_cost_price, unit_super_agent_cost')
      .in('order_id', orderIdList);
    for (const item of items || []) {
      const key = item.order_id as string;
      if (!itemsByOrder[key]) itemsByOrder[key] = [];
      itemsByOrder[key].push(item);
    }
  }

  // Resolve names for orders sold by a downline agent (anyone other than the
  // billed agent). Batched into a single query.
  const downlineIds = Array.from(new Set(
    orderRows.filter((o: any) => o.agent_id && o.agent_id !== row.agent_id).map((o: any) => o.agent_id as string)
  ));
  const sellerNames: Record<string, string> = {};
  if (downlineIds.length > 0) {
    const { data: sellers } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', downlineIds);
    for (const s of sellers || []) {
      sellerNames[s.id as string] = s.full_name || 'Downline Agent';
    }
  }

  // Build the Weekly Sales Detail rows from the BILLED party's perspective.
  // - Order sold by the billed agent themselves: Sold For = retail total,
  //   Your Cost = their own cost basis, Your Profit = Sold For - discount -
  //   Your Cost.
  // - Order sold by a downline agent: Sold For is informational (the
  //   downline's own retail total), Your Cost is what THIS bill charges for
  //   it, and Your Profit is only the markup spread the billed agent earns -
  //   the downline keeps the retail margin.
  // - Wholesale restock orders are inventory purchases, not sales: only Cost
  //   is shown.
  const salesRows = orderRows.map((order: any) => {
    const items = itemsByOrder[order.id] || [];
    const isWholesale = order.is_wholesale_restock === true;
    const isSelf = order.agent_id === row.agent_id;
    const discount = Number(order.discount_amount) || 0;

    let soldFor = 0;
    let yourCost = 0;
    let yourProfit = 0;

    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      const retail = Number(item.unit_retail_price) || 0;
      const cost = Number(item.unit_cost_price) || 0;
      const rawSuperCost = item.unit_super_agent_cost;
      const superCost = rawSuperCost === null || rawSuperCost === undefined || Number.isNaN(Number(rawSuperCost))
        ? cost
        : Number(rawSuperCost);

      soldFor += retail * qty;
      if (isSelf) {
        yourCost += cost * qty;
      } else {
        yourCost += superCost * qty;
        yourProfit += (cost - superCost) * qty;
      }
    }

    if (isSelf) {
      yourProfit = soldFor - discount - yourCost;
    }

    const marginPct = yourCost > 0 ? (yourProfit / yourCost) * 100 : null;
    const isDownlineSale = !isWholesale && !isSelf;

    return {
      id: order.id as string,
      date: order.agent_approved_at || order.created_at,
      sellerLabel: isWholesale ? 'Wholesale Restock' : (isSelf ? 'You' : (sellerNames[order.agent_id || ''] || 'Downline Agent')),
      isWholesale,
      isDownlineSale,
      soldFor: isWholesale ? null : soldFor,
      yourCost,
      yourProfit: isWholesale ? null : yourProfit,
      marginPct: isWholesale ? null : marginPct,
    };
  }).sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

  const hasDownlineSales = salesRows.some(r => r.isDownlineSale);

  const salesTotals = salesRows.reduce(
    (acc, r) => {
      acc.soldFor += r.soldFor || 0;
      acc.cost += r.yourCost || 0;
      acc.profit += r.yourProfit || 0;
      return acc;
    },
    { soldFor: 0, cost: 0, profit: 0 }
  );
  const salesBlendedMargin = salesTotals.cost > 0 ? (salesTotals.profit / salesTotals.cost) * 100 : null;

  return (
    <html lang="en">
      <head>
        <title>{invoiceNumber} - Pep Nation Lab</title>
        <style>{`
          @page { margin: 18mm; }
          @media print {
            .no-print { display: none !important; }
            body { background: #fff !important; }
          }
          body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; background: #fff; margin: 0; padding: 28px; }
          @media screen and (max-width: 600px) {
            body { padding: 16px; font-size: 14px; }
            h1 { font-size: 22px; }
            .meta-grid { grid-template-columns: 1fr !important; gap: 12px !important; margin-top: 20px !important; }
            .meta-box { padding: 12px 14px; }
            table { font-size: 13px; }
            table th, table td { padding: 7px 9px !important; }
            .footer { font-size: 10px; }
          }
          h1 { font-size: 26px; margin: 0 0 4px; letter-spacing: 0.5px; }
          h2 { font-size: 14px; margin: 0 0 12px; color: #555; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f3f4f6; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
          td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
          tbody tr { page-break-inside: avoid; }
          .right { text-align: right; }
          .total-row td { background: #f9fafb; font-size: 16px; font-weight: 700; border-top: 2px solid #1a1a1a; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 28px; }
          .meta-box { background: #f9fafb; border: 1px solid #e5e7eb; padding: 14px 16px; border-radius: 6px; }
          .meta-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
          .meta-value { font-size: 14px; color: #1a1a1a; font-weight: 600; }
          .status-pill { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
          .status-paid { background: #d1fae5; color: #065f46; }
          .status-open { background: #fef3c7; color: #92400e; }
          .status-disputed { background: #fee2e2; color: #991b1b; }
          .footer { margin-top: 36px; padding-top: 18px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280; }
          .print-btn { background: #00C4BC; color: #000; padding: 10px 18px; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 13px; }
          .section-title { font-size: 16px; margin: 32px 0 12px; color: #333; font-weight: 700; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
          .sales-note { color: #6b7280; font-size: 12px; margin-top: 10px; }
          .empty-note { color: #6b7280; font-size: 14px; margin-top: 14px; }
        `}</style>
      </head>
      <body>
        <div className="no-print" style={{ marginTop: 40, marginBottom: 20, display: 'flex', gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/wallet" style={{ color: '#555', textDecoration: 'none', fontSize: 13, alignSelf: 'center' }}>&#8592; Back To Wallet</a>
          <span style={{ flex: 1 }} />
          <PrintButton />
        </div>

        <h1>Pep Nation Lab</h1>
        <h2>Invoice Statement</h2>

        <div className="meta-grid">
          <div className="meta-box">
            <div className="meta-label">Invoice Number</div>
            <div className="meta-value">{invoiceNumber}</div>
            <div className="meta-label" style={{ marginTop: 12 }}>Bills From</div>
            <div className="meta-value">{billsFrom}</div>
          </div>
          <div className="meta-box">
            <div className="meta-label">Billed To</div>
            <div className="meta-value">{billedToName}</div>
            <div className="meta-label" style={{ marginTop: 12 }}>Status</div>
            <div className="meta-value">
              <span className={`status-pill ${
                row.status === 'paid' ? 'status-paid'
                : row.status === 'disputed' ? 'status-disputed'
                : 'status-open'
              }`}>{STATUS_LABEL[row.status] || row.status}</span>
            </div>
          </div>
          <div className="meta-box">
            <div className="meta-label">Week Of</div>
            <div className="meta-value">{fmtDate(row.week_start)} &rarr; {fmtDate(row.week_end)}</div>
          </div>
          <div className="meta-box">
            <div className="meta-label">{row.status === 'paid' ? 'Paid On' : 'Due Date'}</div>
            <div className="meta-value">{row.status === 'paid' ? fmtDate(row.paid_at) : fmtDate(row.due_date)}</div>
            {row.payment_method && (
              <>
                <div className="meta-label" style={{ marginTop: 12 }}>Payment Method</div>
                <div className="meta-value">{String(row.payment_method).replace('_', ' ').toUpperCase()}</div>
              </>
            )}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Cost Of Goods Sold (COGS)</td><td className="right">{money(cogs)}</td></tr>
            <tr><td>Shipping</td><td className="right">{money(shipping)}</td></tr>
            <tr className="total-row"><td>Total Owed</td><td className="right">{money(owed)}</td></tr>
          </tbody>
        </table>

        <div className="section-title">Weekly Sales Detail</div>
        {salesRows.length === 0 ? (
          <p className="empty-note">No Sales Recorded For This Week.</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Order</th>
                  <th>Sold By</th>
                  <th className="right">Sold For</th>
                  <th className="right">Cost Of Goods</th>
                  <th className="right">Profit</th>
                  <th className="right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {salesRows.map(r => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.date)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{r.id.slice(0, 8).toUpperCase()}</td>
                    <td>{r.sellerLabel}</td>
                    <td className="right">{r.soldFor === null ? '-' : money(r.soldFor)}</td>
                    <td className="right" style={{ color: '#6b7280' }}>{money(r.yourCost)}</td>
                    <td className="right" style={{ color: (r.yourProfit || 0) > 0 ? '#065f46' : 'inherit' }}>{r.yourProfit === null ? '-' : money(r.yourProfit)}</td>
                    <td className="right">{r.marginPct === null ? '-' : `${r.marginPct.toFixed(1)}%`}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td colSpan={3}>Totals For {salesRows.length} Order{salesRows.length !== 1 ? 's' : ''}</td>
                  <td className="right">{money(salesTotals.soldFor)}</td>
                  <td className="right">{money(salesTotals.cost)}</td>
                  <td className="right">{money(salesTotals.profit)}</td>
                  <td className="right">{salesBlendedMargin === null ? '-' : `${salesBlendedMargin.toFixed(1)}%`}</td>
                </tr>
              </tbody>
            </table>
            {hasDownlineSales && (
              <p className="sales-note">Downline Rows Show Your Markup Profit - The Retail Sale Belongs To The Downline Agent.</p>
            )}
          </>
        )}

        <div className="footer">
          <strong>Payment Instructions:</strong> Pay via Zelle, Venmo, CashApp, or Apple Pay using your preferred handle on file.
          Use Invoice Number <strong>{invoiceNumber}</strong> as the memo. Payment posts to your Wallet once recorded by the
          billing party. No late fees are applied. If you have enabled Auto-Pay, bills are settled automatically from your prepaid balance.
          <br /><br />
          Pep Nation Lab - Research Use Only - Not For Human Consumption
        </div>
      </body>
    </html>
  );
}
