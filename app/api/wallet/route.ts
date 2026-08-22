import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { resolveEffectiveUserId } from '@/lib/impersonation';
import { safeError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

// Authed money route: balances and transaction history. Must never be cached
// by the browser, CDN, or any shared proxy - success or error alike.
const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

/**
 * GET /api/wallet
 *
 * Unified "Lab Wallet" snapshot for the CURRENTLY LOGGED-IN user, whatever their
 * role. The platform has two underlying ledgers and this route merges them into
 * one wallet view so a single <WalletCard/> can render for researchers, sub-agents,
 * agents, super-agents, and admins:
 *
 *   - store_credits        - legacy researcher store credit (vestigial; balance = SUM(amount)).
 *   - prepaid_balance      - the unified wallet balance for every role, with the
 *                            balance_transactions ledger (transfers, charges, payouts).
 *
 * Every read is hard-scoped to the caller's own id (user_id / agent_id). The
 * service client is used only so the aggregates are not affected by RLS edge
 * cases - it never reads another user's rows.
 */

type WalletTxn = {
  id: string;
  ledger: 'wallet' | 'credit';
  type: string;
  signedAmount: number;
  balanceAfter: number | null;
  description: string;
  createdAt: string;
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Please Sign In.' }, { status: 401, headers: NO_STORE });
  }

  const service = await createServiceClient();

  // Honor an active admin "View As" session so the wallet reflects the agent
  // being viewed, not the admin's own $100k balance.
  const { effectiveUserId } = await resolveEffectiveUserId(user.id);

  const { data: profile } = await service
    .from('profiles')
    .select('role, account_type, prepaid_balance, credit_limit, credit_used')
    .eq('id', effectiveUserId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'Profile Not Found.' }, { status: 404, headers: NO_STORE });
  }

  const role = (profile.role as string) || 'researcher';
  const accountType = (profile.account_type as string | null) ?? null;
  const prepaidBalance = num(profile.prepaid_balance);
  // Only surface a credit line to accounts explicitly set to account_type='credit'.
  // All profiles have a credit_limit DB column (default $100k) as an internal
  // ceiling, but prepaid agents must NOT see it as an available credit line.
  const creditLimit =
    accountType === 'credit' && profile.credit_limit != null
      ? num(profile.credit_limit)
      : null;

  // ── Legacy store credit (vestigial) ───────────────────────────────
  const { data: scRows, error: scError } = await service
    .from('store_credits')
    .select('id, amount, balance_before, balance_after, type, description, created_at')
    .eq('user_id', effectiveUserId)
    .order('created_at', { ascending: false })
    .limit(500);

  if (scError) {
    return safeError('wallet.store_credits', scError, 500, 'Could Not Load Your Wallet. Please Try Again.');
  }

  const storeCredit = (scRows ?? []).reduce((acc, r) => acc + num(r.amount), 0);

  // ── Unified wallet ledger (all roles) ──────────────────────────
  const { data: btRows, error: btError } = await service
    .from('balance_transactions')
    .select('id, type, amount, balance_before, balance_after, description, created_at')
    .eq('agent_id', effectiveUserId)
    .order('created_at', { ascending: false })
    .limit(500);

  if (btError) {
    return safeError('wallet.balance_transactions', btError, 500, 'Could Not Load Your Wallet. Please Try Again.');
  }

  // ── Credit line usage (for credit-line agents) ────────────────────
  // profiles.credit_used is AUTHORITATIVE: it is the running counter that
  // charge_order_credit_line enforces against credit_limit, i.e. the number
  // that actually decides whether an order is refused.
  //
  // This used to sum weekly_statements where status='pending_payment', which
  // disagreed with it on every axis - it missed 'open' statements, missed
  // agent_invoices entirely, and missed every approved-but-not-yet-billed
  // order. The practical effect was that /wallet showed an agent MORE
  // available credit than they had, while /api/agent/wallet/summary (which
  // reads credit_used) showed the truth. Two screens, two numbers, no label
  // saying either was an estimate.
  const creditUsed =
    (creditLimit != null && creditLimit > 0) || accountType === 'credit'
      ? num(profile.credit_used)
      : 0;
  const creditAvailable =
    creditLimit != null ? Math.max(0, Math.round((creditLimit - creditUsed) * 100) / 100) : null;

  // ── Merge both ledgers into one chronological history ─────────────────
  const creditTxns: WalletTxn[] = (scRows ?? []).map((r) => ({
    id: `sc_${r.id}`,
    ledger: 'credit',
    type: (r.type as string) || 'credit',
    signedAmount: num(r.amount),
    balanceAfter: r.balance_after != null ? num(r.balance_after) : null,
    description: (r.description as string) || 'Store Credit',
    createdAt: r.created_at as string,
  }));

  const NEGATIVE_BT_TYPES = new Set([
    'debit',
    'order_charge',
    'restock_charge',
    'withdrawal',
    'payout',
    'statement_payment',
    'transfer_out',
    'transfer_out_credit',
  ]);
  const walletTxns: WalletTxn[] = (btRows ?? []).map((r) => {
    const type = (r.type as string) || '';
    // A credit-line transfer bills the credit line, so the prepaid-balance
    // snapshots don't move (delta 0) - the true debit is the full amount.
    // For everything else prefer the exact ledger delta when it is non-zero,
    // otherwise derive the sign from the transaction type.
    const hasSnaps = r.balance_before != null && r.balance_after != null;
    const delta = hasSnaps ? num(r.balance_after) - num(r.balance_before) : null;
    const signed =
      type === 'transfer_out_credit'
        ? -num(r.amount)
        : delta != null && delta !== 0
          ? delta
          : (NEGATIVE_BT_TYPES.has(type) ? -1 : 1) * num(r.amount);
    return {
      id: `bt_${r.id}`,
      ledger: 'wallet',
      type: (r.type as string) || 'adjustment',
      signedAmount: Math.round(signed * 100) / 100,
      balanceAfter: r.balance_after != null ? num(r.balance_after) : null,
      description: (r.description as string) || 'Wallet Transaction',
      createdAt: r.created_at as string,
    };
  });

  const transactions = [...creditTxns, ...walletTxns]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 100);

  const primaryLedger: 'credit' | 'wallet' = role === 'researcher' ? 'credit' : 'wallet';

  return NextResponse.json({
    role,
    accountType,
    primaryLedger,
    storeCredit: Math.round(storeCredit * 100) / 100,
    prepaidBalance: Math.round(prepaidBalance * 100) / 100,
    creditLimit,
    creditUsed: Math.round(creditUsed * 100) / 100,
    creditAvailable,
    transactions,
  }, { headers: NO_STORE });
}
