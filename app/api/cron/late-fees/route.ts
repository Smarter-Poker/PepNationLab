import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
// Late fees removed per platform billing model - invoices auto-generate
// every Sunday 23:59 CST and remain open until manually paid. There is
// no fee on overdue invoices. This endpoint is intentionally a 410
// tombstone so any orphaned hits get a clean response.
export async function GET() {
  return NextResponse.json({ error: 'Late Fees Removed' }, { status: 410 });
}
