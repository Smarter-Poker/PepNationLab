import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

/**
 * Agent invitation management.
 *
 * GET — list invites the caller can see.
 *   Admins see all rows. Super agents see only invites they minted (and the
 *   invites they minted may only target `agent` role, enforced at insert).
 *
 * POST — mint a fresh invite. Body is validated server-side; the resulting
 *   token is base64url(crypto.randomBytes(24)) which is ~32 chars, has 192
 *   bits of entropy, and is URL-safe so it survives copy/paste through email
 *   clients and chat apps. The invite URL is built absolutely from
 *   NEXT_PUBLIC_APP_URL so it works regardless of where the admin is viewing
 *   the dashboard from.
 *
 * Email is disabled platform-wide — the admin shares the URL out-of-band.
 */

interface InvitePayload {
  email?: unknown;
  full_name?: unknown;
  intended_role?: unknown;
  intended_tier?: unknown;
  intended_account_type?: unknown;
  intended_credit_limit?: unknown;
  intended_prepaid_balance?: unknown;
  parent_agent_id?: unknown;
}

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function appOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://pepnationlab.com';
}

async function callerProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('id, role, is_super_agent')
    .eq('id', user.id)
    .maybeSingle();
  return { user, profile };
}

export async function GET() {
  const { user, profile } = await callerProfile();
  if (!user || !profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const isAdmin = profile.role === 'admin';
  const isSuperAgent = profile.role === 'super_agent' || profile.is_super_agent === true;
  if (!isAdmin && !isSuperAgent) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = await createServiceClient();
  let query = service
    .from('agent_invitations')
    .select('id, token, email, full_name, intended_role, intended_tier, intended_account_type, intended_credit_limit, intended_prepaid_balance, parent_agent_id, invited_by, expires_at, redeemed_at, redeemed_by, created_at, metadata')
    .order('created_at', { ascending: false })
    .limit(200);

  if (!isAdmin) {
    query = query.eq('invited_by', user.id);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  const origin = appOrigin();
  const items = (data ?? []).map((row) => ({
    ...row,
    invite_url: `${origin}/invite/${row.token}`,
    status: deriveStatus(row),
  }));

  return NextResponse.json({ items });
}

function deriveStatus(row: {
  redeemed_at: string | null;
  expires_at: string;
  metadata: { revoked?: boolean } | null;
}): 'pending' | 'redeemed' | 'revoked' | 'expired' {
  if (row.metadata && row.metadata.revoked === true) return 'revoked';
  if (row.redeemed_at) return 'redeemed';
  if (new Date(row.expires_at).getTime() < Date.now()) return 'expired';
  return 'pending';
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, profile } = await callerProfile();
  if (!user || !profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const isAdmin = profile.role === 'admin';
  const isSuperAgent = profile.role === 'super_agent' || profile.is_super_agent === true;
  if (!isAdmin && !isSuperAgent) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: InvitePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid Email Required.' }, { status: 400 });
  }

  const full_name = typeof body.full_name === 'string' ? body.full_name.trim().slice(0, 200) : null;

  const role = body.intended_role === 'super_agent' ? 'super_agent' : 'agent';
  // Super agents can only create `agent` invites.
  if (!isAdmin && role !== 'agent') {
    return NextResponse.json({ error: 'Only Admins May Mint Super-Agent Invites.' }, { status: 403 });
  }

  const validTiers = new Set(['tier_1', 'tier_2', 'tier_3']);
  const tier = validTiers.has(String(body.intended_tier)) ? String(body.intended_tier) : null;

  const validAcct = new Set(['credit', 'prepaid']);
  const accountType = validAcct.has(String(body.intended_account_type)) ? String(body.intended_account_type) : null;

  const creditLimit = body.intended_credit_limit != null && body.intended_credit_limit !== '' ? Number(body.intended_credit_limit) : null;
  const prepaidBalance = body.intended_prepaid_balance != null && body.intended_prepaid_balance !== '' ? Number(body.intended_prepaid_balance) : null;
  if (creditLimit != null && (!Number.isFinite(creditLimit) || creditLimit < 0)) {
    return NextResponse.json({ error: 'Invalid Credit Limit.' }, { status: 400 });
  }
  if (prepaidBalance != null && (!Number.isFinite(prepaidBalance) || prepaidBalance < 0)) {
    return NextResponse.json({ error: 'Invalid Prepaid Balance.' }, { status: 400 });
  }

  // Parent agent rules:
  //  - Super agents always invite into their own sub-tree.
  //  - Admins may set any parent_agent_id (or null for top-level).
  let parentAgentId: string | null = null;
  if (isAdmin) {
    if (body.parent_agent_id && isUuid(body.parent_agent_id)) {
      parentAgentId = body.parent_agent_id;
    } else if (body.parent_agent_id === null || body.parent_agent_id === '' || body.parent_agent_id === undefined) {
      parentAgentId = null;
    } else if (body.parent_agent_id) {
      return NextResponse.json({ error: 'Invalid Parent Agent.' }, { status: 400 });
    }
  } else {
    parentAgentId = user.id;
  }

  const token = crypto.randomBytes(24).toString('base64url');

  const service = await createServiceClient();
  const { data: inserted, error } = await service
    .from('agent_invitations')
    .insert({
      token,
      email,
      full_name,
      intended_role: role,
      intended_tier: tier,
      intended_account_type: accountType,
      intended_credit_limit: creditLimit,
      intended_prepaid_balance: prepaidBalance,
      parent_agent_id: parentAgentId,
      invited_by: user.id,
      metadata: {},
    })
    .select('id, token, email, full_name, intended_role, intended_tier, intended_account_type, intended_credit_limit, intended_prepaid_balance, parent_agent_id, invited_by, expires_at, created_at, metadata')
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  // Audit log (admin only — super-agent invites are scoped by RLS anyway).
  if (isAdmin) {
    await service.from('admin_audit_log').insert({
      actor_id: user.id,
      action: 'invite_created',
      entity_type: 'agent_invitation',
      entity_id: inserted.id,
      changes: { email, intended_role: role, intended_tier: tier },
    });
  }

  const origin = appOrigin();
  return NextResponse.json({
    ...inserted,
    invite_url: `${origin}/invite/${inserted.token}`,
    status: 'pending',
  });
}
