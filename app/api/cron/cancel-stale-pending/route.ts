import { NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/cron/cancel-stale-pending - PERMANENTLY DISABLED (2026-07-19)
 *
 * Platform rule: orders are NEVER cancelled automatically. Ever.
 *
 * Stale orders are now handled by the order-attention engine in
 * /api/cron/reminders, which escalates unconfirmed orders to the agent,
 * their upline super agent, and admins (24h / 48h / 72h ladder) instead of
 * destroying the order. The cancel_stale_pending_orders RPC has also been
 * neutralized to a no-op in the database
 * (migration 20260719120000_order_notifications_and_escalation.sql).
 *
 * Kept as a stub (removed from vercel.json) so any stray invocation gets a
 * clear response instead of a 404 - and can never cancel anything.
 */
export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  return NextResponse.json({
    ok: true,
    disabled: true,
    cancelled: 0,
    reason: 'Auto-Cancellation Is Permanently Disabled. Stale Orders Escalate Via /api/cron/reminders Instead.',
  });
}
