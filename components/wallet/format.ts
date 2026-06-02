// Shared wallet formatting helpers so every wallet surface renders money,
// dates, and statuses identically. Date-only strings (YYYY-MM-DD) are pinned to
// local midnight so they don't slip a day in negative-offset timezones.

export const money = (n: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n) || 0);

export const fmtDate = (s: string | null | undefined): string => {
  if (!s) return '—';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s;
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? s
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const STATUS_LABEL: Record<string, string> = {
  paid: 'Paid',
  pending: 'Pending',
  pending_payment: 'Pending Payment',
  open: 'Open',
  settled: 'Settled',
  voided: 'Voided',
  disputed: 'Disputed',
  approved: 'Approved',
  denied: 'Denied',
  cancelled: 'Cancelled',
};

export const statusLabel = (s: string | null | undefined): string => {
  const k = (s || '').toLowerCase();
  return STATUS_LABEL[k] || k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—';
};
