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

  // Resolve the recipient.
  let recipientQuery = service
    .from('profiles')
    .select('id, role, full_name, email, referring_agent_id, parent_agent_id, referring_sub_agent_id');
  recipientQuery = recipientIdRaw
    ? recipientQuery.eq('id', recipientIdRaw)
    : recipientQuery.ilike('email', recipientEmailRaw);
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
    ? `Credit From ${issuerName}: ${note}`
    : `Credit From ${issuerName}`;

  // Issue the credit atomically.
  const { data: newBalance, error: issueErr } = await service.rpc('issue_store_credit', {
    p_user_id: recipient.id,
    p_amount: amount,
    p_created_by: issuerId,
    p_description: description,
  });
  if (issueErr) {
    console.error('issue_store_credit failed:', issueErr.message);
    return NextResponse.json({ error: 'Failed To Issue Credit. Please Try Again.' }, { status: 500 });
  }

  // Audit trail (best-effort).
  try {
    await service.from('admin_audit_log').insert({
      actor_id: issuerId,
      action: 'credit_issued',
      entity_type: 'profile',
      entity_id: recipient.id,
      changes: {
        amount,
        funded_by: isAdmin ? 'platform' : 'agent',
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
      title: 'Lab Wallet Credit Received',
      body: `You Received $${amount.toFixed(2)} In Lab Wallet Credit From ${issuerName}.`,
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
    recipient: { id: recipient.id, name: recipient.full_name || recipient.email },
  });
}
