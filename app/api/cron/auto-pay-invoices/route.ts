import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/cron/auto-pay-invoices (daily, 20:30 UTC - ninety minutes before
 * the settlement reminders fire, so anything auto-paid never gets nagged)
 *
 * Makes the wallet's Auto-Pay toggle REAL. The setting existed and persisted
 * (profiles.auto_pay_enabled) but its consumer cron was removed, so enabling
 * it did nothing - a dead switch promising "When Enabled And Your Prepaid
 * Balance Covers A Statement, It Is Paid Automatically Before The Due Date."
 *
 * For every open weekly statement / super-agent invoice whose payer has
 * Auto-Pay ON and a prepaid balance covering the full amount, the
 * auto_pay_invoice RPC atomically: debits the payer's prepaid balance,
 * marks the bill paid (payment_method 'auto_pay'), releases the payer's
 * credit line if they are a credit account, and credits the payee's wallet.
 * Partial payments are never attempted.
 */
export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partitionKey = new Date().toISOString().slice(0, 10);
  const claim = await claimCronRun('auto_pay_invoices', partitionKey);
  if (!claim) {
    return Response.json({ skipped: true, reason: 'already_ran_today' });
  }

  let paid = 0;
  let skippedBalance = 0;
  let failures = 0;
  let errorNote: string | null = null;

  try {
    const svc = createAdminClient();

    const [{ data: stmts }, { data: invoices }] = await Promise.all([
      svc
        .from('weekly_statements')
        .select('id, agent_id, total_owed')
        .eq('status', 'pending_payment')
        .gt('total_owed', 0)
        .limit(200),
      svc
        .from('agent_invoices')
        .select('id, agent_id, total_owed')
        .eq('status', 'open')
        .gt('total_owed', 0)
        .limit(200),
    ]);

    const bills = [
      ...(stmts ?? []).map((s) => ({ type: 'statement' as const, id: s.id, payerId: s.agent_id, owed: Number(s.total_owed) || 0 })),
      ...(invoices ?? []).map((i) => ({ type: 'agent_invoice' as const, id: i.id, payerId: i.agent_id, owed: Number(i.total_owed) || 0 })),
    ];

    const payerIds = [...new Set(bills.map((b) => b.payerId).filter(Boolean))];
    const payerById = new Map<string, { auto_pay_enabled: boolean; prepaid_balance: number; full_name: string | null }>();
    if (payerIds.length > 0) {
      const { data: payers } = await svc
        .from('profiles')
        .select('id, auto_pay_enabled, prepaid_balance, full_name')
        .in('id', payerIds);
      for (const p of payers ?? []) {
        payerById.set(p.id, {
          auto_pay_enabled: p.auto_pay_enabled === true,
          prepaid_balance: Number(p.prepaid_balance) || 0,
          full_name: p.full_name ?? null,
        });
      }
    }

    for (const bill of bills) {
      const payer = bill.payerId ? payerById.get(bill.payerId) : null;
      if (!payer?.auto_pay_enabled) continue;
      if (payer.prepaid_balance < bill.owed) { skippedBalance++; continue; }

      // The RPC re-validates EVERYTHING under row locks (bill unpaid,
      // auto-pay still on, balance still sufficient), so the pre-filter
      // above is only an optimization, never the safety.
      const { data: result, error: rpcErr } = await svc.rpc('auto_pay_invoice', {
        p_target_type: bill.type,
        p_target_id: bill.id,
      });
      if (rpcErr) {
        failures++;
        console.error('[auto-pay] rpc failed:', bill.type, bill.id, rpcErr.message);
        continue;
      }
      const r = result as { ok?: boolean; skipped?: string; payee?: string | null; amount?: number } | null;
      if (!r?.ok) {
        if (r?.skipped === 'insufficient_balance') skippedBalance++;
        continue;
      }
      paid++;

      const amountFmt = `$${bill.owed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      try {
        await notify(svc, {
          userId: bill.payerId,
          type: 'payment_confirmed',
          title: 'Auto-Pay: Your Bill Was Paid',
          body: `Auto-Pay Settled Your ${bill.type === 'statement' ? 'Weekly Statement' : 'Invoice'} Of ${amountFmt} From Your Prepaid Balance.`,
          url: '/wallet',
        });
        if (r.payee) {
          await notify(svc, {
            userId: r.payee,
            type: 'payment_confirmed',
            title: 'Auto-Pay: Payment Received',
            body: `${payer.full_name || 'A Downline Agent'} Auto-Paid Their ${bill.type === 'statement' ? 'Weekly Statement' : 'Invoice'} Of ${amountFmt}. Your Wallet Was Credited.`,
            url: '/wallet',
          });
        }
      } catch (err) {
        console.error('[auto-pay] notify failed:', err);
      }
    }
  } catch (err: unknown) {
    errorNote = err instanceof Error ? err.message.slice(0, 300) : 'unknown_error';
  }

  const summary = `paid=${paid} skippedBalance=${skippedBalance} failures=${failures}${errorNote ? ` err=${errorNote}` : ''}`;
  await finishCronRun(claim.id, errorNote ? 'failed' : 'succeeded', summary);

  return Response.json({ ok: !errorNote, paid, skippedBalance, failures, error: errorNote });
}
