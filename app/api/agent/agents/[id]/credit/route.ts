import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/agents/[id]/credit
 *
 * A Super Agent (or admin) credits a downline FULL agent's prepaid Lab Wallet.
 * Backed by the atomic SECURITY DEFINER `super_credit_agent_balance` RPC, which
 * adds the funds and records a 'bonus' balance_transactions row so the credit
 * shows in the agent's wallet history.
 *
 * Body: { amount: number, note?: string }
 */

const MAX_CREDIT = 5000; // per-send safety cap

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;
    const callerId = gate.user.id;
    const { id } = await ctx.params;

    const limited = await rateLimit({
      key: 'agent_credit',
      limit: 30,
      windowSeconds: 60,
      identifier: callerId,
    });
    if (!limited.allowed) {
      return NextResponse.json({ error: 'Too Many Requests. Please Wait And Try Again.' }, { status: 429 });
    }

    const supabase = await createServiceClient();

    const { data: caller } = await supabase
      .from('profiles')
      .select('role, is_super_agent, full_name, email')
      .eq('id', callerId)
      .single();
    const isAdmin = caller?.role === 'admin';
    if (!caller || (!caller.is_super_agent && !isAdmin)) {
      return NextResponse.json(
        { error: 'Forbidden. Only Super Agents Can Credit Agent Accounts.' },
        { status: 403 },
      );
    }

    const { data: target } = await supabase
      .from('profiles')
      .select('id, parent_agent_id, full_name, account_type')
      .eq('id', id)
      .single();
    if (!target) {
      return NextResponse.json({ error: 'Agent Account Not Found.' }, { status: 404 });
    }
    if (!isAdmin && target.parent_agent_id !== callerId) {
      return NextResponse.json({ error: 'This Agent Is Not In Your Network.' }, { status: 403 });
    }
    // Wallet credit only spends on prepaid accounts; a credit-line agent draws
    // against their credit limit, so a prepaid credit would sit inert. Reject it
    // and steer the caller to raise the credit limit instead.
    if (target.account_type === 'credit') {
      return NextResponse.json(
        { error: 'This Agent Is On A Credit Line. Raise Their Credit Limit Instead Of Adding Wallet Credit.' },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const amount = Math.round((Number(body?.amount) || 0) * 100) / 100;
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 200) : '';

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter A Credit Amount Greater Than $0.' }, { status: 400 });
    }
    if (amount > MAX_CREDIT) {
      return NextResponse.json({ error: `Credits Are Capped At $${MAX_CREDIT.toFixed(2)} Per Send.` }, { status: 400 });
    }

    const issuerName = caller.full_name || (caller.email ? String(caller.email).split('@')[0] : 'Super Agent');
    const description = note ? `Credit From ${issuerName}: ${note}` : `Credit From ${issuerName}`;

    const { data: newBalance, error: rpcErr } = await supabase.rpc('super_credit_agent_balance', {
      p_agent_id: id,
      p_amount: amount,
      p_created_by: callerId,
      p_description: description,
    });
    if (rpcErr) {
      console.error('super_credit_agent_balance failed:', rpcErr.message);
      return NextResponse.json({ error: 'Failed To Issue Credit. Please Try Again.' }, { status: 500 });
    }

    // Audit (best-effort).
    try {
      await supabase.from('admin_audit_log').insert({
        actor_id: callerId,
        action: 'agent_credited',
        entity_type: 'profile',
        entity_id: id,
        changes: { amount, note: note || null },
      });
    } catch {
      /* audit failures never block the credit */
    }

    // Notify the agent (best-effort).
    try {
      await supabase.from('notifications').insert({
        user_id: id,
        title: 'Wallet Credit Received',
        body: `You Received $${amount.toFixed(2)} In Wallet Credit From ${issuerName}.`,
        type: 'system',
        url: '/dashboard',
      });
    } catch {
      /* notification is non-critical */
    }

    return NextResponse.json({
      success: true,
      amount,
      newBalance: typeof newBalance === 'number' ? newBalance : Number(newBalance) || null,
    });
  } catch (err) {
    console.error('[POST agent-credit] error:', err);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
