import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
// Superseded. Auto-pay is LIVE at /api/cron/auto-pay-invoices (see vercel.json); this stub only exists so any stale scheduler entry pointing here fails loudly instead of silently doing nothing.
// Invoices auto-generate every Sunday 23:59 CST, agents pay them by hand
// via Zelle/Venmo/CashApp + upload proof. This endpoint is a 410 tombstone
// so any stale cron entry or manual hit gets a clean response.
export async function GET() {
  return NextResponse.json({ error: 'Auto-Pay Removed' }, { status: 410 });
}
