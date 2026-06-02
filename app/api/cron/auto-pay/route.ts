import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/cron/auto-pay
 *
 * Settles open / pending weekly statements for PREPAID agents who opted into
 * Auto-Pay (profiles.auto_pay_enabled) and whose prepaid_balance covers the
 * statement total. The atomic SECURITY DEFINER RPC auto_pay_due_statements
 * debits the balance, marks the statement paid (payment_method='auto_pay'),
 * and writes the balance_transactions ledger row — per statement, locking the
 * profile so concurrent runs are safe. Returns the number paid.
 *
 * Schedule (vercel.json): 0 13 * * *  (daily 13:00 UTC).
 */
export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  try {
    const svc = await createServiceClient();
    const { data, error } = await svc.rpc('auto_pay_due_statements');
    if (error) {
      console.error('[cron/auto-pay] auto_pay_due_statements failed:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, paid: Number(data ?? 0) });
  } catch (e) {
    console.error('[cron/auto-pay] threw:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
