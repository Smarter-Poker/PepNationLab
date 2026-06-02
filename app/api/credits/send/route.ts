import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/credits/send
 *
 * Send real wallet funds to a recipient account.
 *
 * Who may send: admin, super_agent, agent, or sub_agent (researchers cannot send).
 * No network or amount restriction — any valid sender may send to ANY account as
 * long as their wallet balance (or credit line) covers it. wallet_transfer is the
 * sole funds gate.
 *
 * Money model: wallet_transfer debits the sender (their wallet balance, or — for
 * credit-line agents — billed to their credit line so they owe it on their weekly
 * statement) and credits the recipient's wallet, recording a transaction on BOTH
 * sides. Every movement is real money and fully audited.
 *
 * Body: { recipientId?: uuid, recipientEmail?: string, amount: number, note?: string }
 */

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;
  const issuerId = gate.user.id;

  // Light abuse guard.
  const limited = await rateLimit({
    key: 'credit_send',
    limit: 20,
    windowSeconds: 60,
    identifier: issuerId,
  });
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Too Many Requests. Please Wait And Try Again.' }, { status: 429 });
  }

  // requireAgent uses the auth client to gate; use the service client for the
  // hierarchy reads + the SECURITY DEFINER RPC.
  await createClient(); // ensure the auth context is initialised consistently
  const service = await createServiceClient();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid Request Body.' }, { status: 400 });
  }

  const recipientIdRaw = typeof body?.recipientId === 'string' ? body.recipientId.trim() : '';
  const recipientEmailRaw = typeof body?.recipientEmail === 'string' ? body.recipientEmail.trim().toLowerCase() : '';
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 200) : '';

  const amount = Math.round((Number(body?.amount) || 0) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Enter A Credit Amount Greater Than $0.' }, { status: 400 });
  }
  if (!recipientIdRaw && !recipientEmailRaw) {
    return NextResponse.json({ error: 'A Recipient Is Required.' }, { status: 400 });
  }

  // Resolve the issuer's role.
  const { data: issuer } = await service
    .from('profiles')
    .select('id, role, full_name, email')
    .eq('id', issuerId)
    .maybeSingle();
  if (!issuer) {
    return NextResponse.json({ error: 'Issuer Profile Not Found.' }, { status: 404 });
  }

  // Resolve the recipient by id, email, or username. Researchers created by an
  // agent often sign in with a username (no real email), so accept either.
  let recipientQuery = service
    .from('profiles')
    .select('id, role, full_name, email, username, referring_agent_id, parent_agent_id, referring_sub_agent_id');
  if (recipientIdRaw) {
    recipientQuery = recipientQuery.eq('id', recipientIdRaw);
  } else if (recipientEmailRaw.includes('@')) {
    recipientQuery = recipientQuery.ilike('email', recipientEmailRaw);
  } else {
    recipientQuery = recipientQuery.ilike('username', recipientEmailRaw);
  }
  const { data: recipient } = await recipientQuery.maybeSingle();

  if (!recipient) {
    return NextResponse.json({ error: 'Recipient Account Not Found.' }, { status: 404 });
  }
  if (recipient.id === issuerId) {
    return NextResponse.json({ error: 'You Cannot Send Funds To Your Own Account.' }, { status: 400 });
  }

  // No network restriction: any valid sender may send to any account. The only
  // gate is funds availability, enforced atomically inside wallet_transfer.

  const issuerName = issuer.full_name || (issuer.email ? String(issuer.email).split('@')[0] : 'Your Team');
  const description = note
    ? `${issuerName}: ${note}`
    : `From ${issuerName}`;

  // Move the funds atomically: debit the sender (their wallet balance, or — for
  // credit-line agents — billed to their credit line so they owe it on their
  // weekly statement) and credit the recipient's wallet. Records a transaction
  // on BOTH sides. Admin sends are debited from the admin wallet too.
  const { data: transfer, error: transferErr } = await service.rpc('wallet_transfer', {
    p_sender: issuerId,
    p_recipient: recipient.id,
    p_amount: amount,
    p_note: description,
  });
  if (transferErr) {
    // The RPC raises check_violation for self-send / bad amount / insufficient
    // funds or credit — surface those as a clean 400 to the sender.
    const msg = String(transferErr.message || '');
    const isGuard = /check_violation|Insufficient|Cannot Send|Greater Than Zero|Not Found/i.test(msg);
    console.error('wallet_transfer failed:', msg);
    return NextResponse.json(
      { error: isGuard ? msg.replace(/^.*?:\s*/, '') || 'Transfer Rejected.' : 'Failed To Send Funds. Please Try Again.' },
      { status: isGuard ? 400 : 500 },
    );
  }
  const newBalance =
    transfer && typeof transfer === 'object' && 'recipient_balance' in (transfer as Record<string, unknown>)
      ? Number((transfer as Record<string, unknown>).recipient_balance)
      : null;

  // Audit trail (best-effort).
  try {
    await service.from('admin_audit_log').insert({
      actor_id: issuerId,
      action: 'wallet_transfer',
      entity_type: 'profile',
      entity_id: recipient.id,
      changes: {
        amount,
        drew_from: (transfer as Record<string, unknown>)?.drew_from ?? null,
        issuer_role: issuer.role,
        recipient_role: recipient.role,
        note: note || null,
      },
    });
  } catch {
    /* audit failures never block the credit */
  }

  // Notify the recipient (best-effort).
  try {
    await service.from('notifications').insert({
      user_id: recipient.id,
      title: 'Funds Received',
      body: `You Received $${amount.toFixed(2)} In Your Wallet From ${issuerName}.`,
      type: 'system',
      url: '/wallet',
    });
  } catch {
    /* notification is non-critical */
  }

  return NextResponse.json({
    success: true,
    amount,
    newBalance: typeof newBalance === 'number' ? newBalance : Number(newBalance) || null,
    recipient: { id: recipient.id, name: recipient.full_name || recipient.email },
  });
}
