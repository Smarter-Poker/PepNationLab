import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PrintButton from '@/components/wallet/PrintButton';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Invoice | Pep Nation Lab',
  robots: { index: false, follow: false },
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
        `}</style>
      </head>
      <body>
        <div className="no-print" style={{ marginBottom: 20, display: 'flex', gap: 8 }}>
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

        <div className="footer">
          <strong>Payment Instructions:</strong> Pay via Zelle, Venmo, CashApp, or Apple Pay using your preferred handle on file.
          Use Invoice Number <strong>{invoiceNumber}</strong> as the memo. Payment posts to your Wallet once recorded by the
          billing party. No automated billing or late fees are applied.
          <br /><br />
          Pep Nation Lab - Research Use Only - Not For Human Consumption
        </div>
      </body>
    </html>
  );
}
