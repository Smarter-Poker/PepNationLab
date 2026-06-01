import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/wallet
 *
 * Unified "Lab Wallet" snapshot for the CURRENTLY LOGGED-IN user, whatever their
 * role. The platform has two underlying ledgers and this route merges them into
 * one wallet view so a single <WalletCard/> can render for researchers, sub-agents,
 * agents, super-agents, and admins:
 *
 *   - store_credits        — researcher-facing store credit (referral rewards land
 *                            here; redeemable at checkout). Balance = SUM(amount).
 *   - prepaid_balance      — agent / super-agent / sub-agent wholesale + commission
 *                            wallet, with the balance_transactions ledger.
 *
 * Every read is hard-scoped to the caller's own id (user_id / agent_id). The
 * service client is used only so the aggregates are not affected by RLS edge
 * cases — it never reads another user's rows.
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
    return NextResponse.json({ error: 'Unauthorized. Please Sign In.' }, { status: 401 });
  }

  const service = await createServiceClient();

  const { data: profile } = await service
    .from('profiles')
    .select('role, account_type, prepaid_balance, credit_limit')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'Profile Not Found.' }, { status: 404 });
  }

  const role = (profile.role as string) || 'researcher';
  const accountType = (profile.account_type as string | null) ?? null;
  const prepaidBalance = num(profile.prepaid_balance);
  const creditLimit = profile.credit_limit != null ? num(profile.credit_limit) : null;

  // ── Store credit (researcher Lab Wallet credit) ────────────────────────
  // amount is signed (+ issue/release, - redeem). Sum ALL rows for the true
  // balance; fetch a bounded window for the history list.
  const { data: scRows } = await service
    .from('store_credits')
    .select('id, amount, balance_before, balance_after, type, description, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500);

  const storeCredit = (scRows ?? []).reduce((acc, r) => acc + num(r.amount), 0);

  // ── Prepaid balance ledger (agent / super / sub wallet) ──────────────────
  const { data: btRows } = await service
    .from('balance_transactions')
    .select('id, type, amount, balance_before, balance_after, description, created_at')
    .eq('agent_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500);

  // ── Credit line usage (for account_type='credit' agents) ─────────────────
  // Approximated as the sum of weekly statements still awaiting payment. The
  // precise in-flight projection lives in the checkout route; this is the
  // settled-but-unpaid figure that drives the "available credit" display.
  let creditUsed = 0;
  if (accountType === 'credit') {
    const { data: stmts } = await service
      .from('weekly_statements')
      .select('total_owed')
      .eq('agent_id', user.id)
      .eq('status', 'pending_payment');
    creditUsed = (stmts ?? []).reduce((acc, s) => acc + num(s.total_owed), 0);
  }
  const creditAvailable =
    creditLimit != null ? Math.max(0, Math.round((creditLimit - creditUsed) * 100) / 100) : null;

  // ── Merge both ledgers into one chronological history ────────────────────
  const creditTxns: WalletTxn[] = (scRows ?? []).map((r) => ({
    id: `sc_${r.id}`,
    ledger: 'credit',
    type: (r.type as string) || 'credit',
    // store_credits.amount is already signed.
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
  ]);
  const walletTxns: WalletTxn[] = (btRows ?? []).map((r) => {
    // Prefer the exact ledger delta when both snapshots are present; otherwise
    // derive the sign from the transaction type (amount is stored positive).
    const hasSnaps = r.balance_before != null && r.balance_after != null;
    const delta = hasSnaps ? num(r.balance_after) - num(r.balance_before) : null;
    const signed =
      delta != null
        ? delta
        : (NEGATIVE_BT_TYPES.has((r.type as string) || '') ? -1 : 1) * num(r.amount);
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

  // Which balance is the headline for this role?
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
  });
}
