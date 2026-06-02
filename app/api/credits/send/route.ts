import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { isAgentAncestorOf } from '@/lib/agent-auth';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/credits/send
 *
 * Issue Lab Wallet (store) credit to a recipient account.
 *
 * Who may issue:
 *   - admin            → any account (platform-funded).
 *   - agent/super_agent/sub_agent → only accounts in their own downline
 *     (their researchers, their sub-agents, or a sub-agent's researcher).
 *
 * Funding model: the issuing agent funds the credit out of their own margin —
 * `store_credits.created_by` records the issuer so the checkout-redemption
 * settlement can reduce THAT agent's profit on the redeeming order. Admin-issued
 * credit is platform-funded (created_by = admin). No balance is moved at issue
 * time; the cost is realized when the recipient redeems at checkout.
 *
 * Body: { recipientId?: uuid, recipientEmail?: string, amount: number, note?: string }
 */

const MAX_CREDIT = 2000; // per-send safety cap

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
  if (amount > MAX_CREDIT) {
    return NextResponse.json({ error: `Credits Are Capped At $${MAX_CREDIT.toFixed(2)} Per Send.` }, { status: 400 });
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
  const isAdmin = issuer.role === 'admin';

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
    return NextResponse.json({ error: 'You Cannot Send Credit To Your Own Account.' }, { status: 400 });
  }

  // Authorization: admin can credit anyone; everyone else only their downline.
  let authorized = isAdmin;
  if (!authorized) {
    if (
      recipient.referring_agent_id === issuerId ||
      recipient.parent_agent_id === issuerId ||
      recipient.referring_sub_agent_id === issuerId
    ) {
      authorized = true;
    } else if (recipient.referring_agent_id) {
      // Super-agent issuing to a researcher who belongs to one of their agents.
      authorized = await isAgentAncestorOf(service, issuerId, recipient.referring_agent_id as string);
    }
    if (!authorized) {
      // Last check: the recipient is a sub-agent somewhere in the issuer's tree.
      authorized = await isAgentAncestorOf(service, issuerId, recipient.id as string);
    }
  }
  if (!authorized) {
    return NextResponse.json(
      { error: 'You Can Only Send Credit To Accounts In Your Own Network.' },
      { status: 403 },
    );
  }

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
