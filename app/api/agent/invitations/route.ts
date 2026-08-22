export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

// Agent Invitations API.
//
// Wires the previously-orphaned public.agent_invitations table (RLS: admins
// manage all, super_agents manage their own agent invites). A super_agent or
// admin mints a one-time token that lets a recipient self-provision an account
// with a pre-decided role, tier and account type. Redemption runs through the
// public /api/agent-invitations/redeem route.
//
// Uses the service-role client and enforces the role gate in code so the
// behavior matches the table's RLS exactly.

const VALID_ROLES = ['agent', 'super_agent'] as const;
const VALID_TIERS = ['tier_1', 'tier_2', 'tier_3'] as const;
const VALID_ACCOUNT_TYPES = ['credit', 'prepaid'] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://pepnationlab.com').replace(/\/$/, '');
}

// GET /api/agent/invitations -- list the caller's own invitations.
export async function GET(_req: NextRequest) {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_super_agent')
    .eq('id', gate.user.id)
    .maybeSingle();

  const isAdmin = profile?.role === 'admin';
  const isSuperAgent = profile?.role === 'super_agent' || profile?.is_super_agent === true;
  if (!isAdmin && !isSuperAgent) {
    return NextResponse.json(
      { error: 'Only Super Agents And Admins Can Manage Invitations.' },
      { status: 403 },
    );
  }

  let query = supabase
    .from('agent_invitations')
    .select('id, email, full_name, intended_role, intended_tier, intended_account_type, expires_at, redeemed_at, redeemed_by, created_at, metadata, token')
    .order('created_at', { ascending: false })
    .limit(500);

  // Admins see everything; super agents see only their own (matches RLS).
  if (!isAdmin) query = query.eq('invited_by', gate.user.id);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Could Not Load Invitations.' }, { status: 500 });
  }

  const base = appUrl();
  const now = Date.now();
  const rows = (data ?? []).map((r: any) => {
    const revoked = r.metadata?.revoked === true;
    const redeemed = !!r.redeemed_at && !revoked;
    const expired = !redeemed && !revoked && new Date(r.expires_at).getTime() < now;
    const status = revoked ? 'revoked' : redeemed ? 'redeemed' : expired ? 'expired' : 'pending';
    return {
      id: r.id,
      email: r.email,
      full_name: r.full_name,
      intended_role: r.intended_role,
      intended_tier: r.intended_tier,
      intended_account_type: r.intended_account_type,
      expires_at: r.expires_at,
      redeemed_at: r.redeemed_at,
      created_at: r.created_at,
      status,
      // Only expose the shareable link while the invite is still usable.
      invite_url: status === 'pending' ? `${base}/invite/${r.token}` : null,
    };
  });

  return NextResponse.json({ data: rows });
}

// POST /api/agent/invitations -- mint a new invitation.
export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_super_agent, id')
    .eq('id', gate.user.id)
    .maybeSingle();

  const isAdmin = profile?.role === 'admin';
  const isSuperAgent = profile?.role === 'super_agent' || profile?.is_super_agent === true;
  if (!isAdmin && !isSuperAgent) {
    return NextResponse.json(
      { error: 'Only Super Agents And Admins Can Send Invitations.' },
      { status: 403 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid Request Body.' }, { status: 400 });
  }

  const email = String(body?.email ?? '').trim().toLowerCase();
  const fullName = body?.full_name ? String(body.full_name).trim().slice(0, 120) : null;
  const intendedRole = String(body?.intended_role ?? 'agent');
  const intendedTier = body?.intended_tier ? String(body.intended_tier) : null;
  const intendedAccountType = body?.intended_account_type ? String(body.intended_account_type) : null;
  const creditLimit = body?.intended_credit_limit != null ? Number(body.intended_credit_limit) : null;
  const prepaidBalance = body?.intended_prepaid_balance != null ? Number(body.intended_prepaid_balance) : null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A Valid Email Is Required.' }, { status: 400 });
  }
  if (!VALID_ROLES.includes(intendedRole as any)) {
    return NextResponse.json({ error: 'Invalid Role.' }, { status: 400 });
  }
  // Super agents may only invite agents (matches the RLS WITH CHECK); admins may invite either.
  if (!isAdmin && intendedRole !== 'agent') {
    return NextResponse.json({ error: 'Super Agents May Only Invite Agents.' }, { status: 403 });
  }
  if (intendedTier && !VALID_TIERS.includes(intendedTier as any)) {
    return NextResponse.json({ error: 'Invalid Tier.' }, { status: 400 });
  }
  if (intendedAccountType && !VALID_ACCOUNT_TYPES.includes(intendedAccountType as any)) {
    return NextResponse.json({ error: 'Invalid Account Type.' }, { status: 400 });
  }
  if (creditLimit != null && (!Number.isFinite(creditLimit) || creditLimit < 0)) {
    return NextResponse.json({ error: 'Invalid Credit Limit.' }, { status: 400 });
  }
  if (prepaidBalance != null && (!Number.isFinite(prepaidBalance) || prepaidBalance < 0)) {
    return NextResponse.json({ error: 'Invalid Prepaid Balance.' }, { status: 400 });
  }

  // Block a duplicate pending invite or an existing account for this email.
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existingUser) {
    return NextResponse.json({ error: 'An Account With That Email Already Exists.' }, { status: 409 });
  }
  const { data: openInvite } = await supabase
    .from('agent_invitations')
    .select('id')
    .eq('email', email)
    .is('redeemed_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (openInvite) {
    return NextResponse.json({ error: 'A Pending Invitation For That Email Already Exists.' }, { status: 409 });
  }

  const token = randomBytes(24).toString('base64url');
  // Super agents provision sub-agents under themselves; admins mint unparented
  // agents unless they pass an explicit parent.
  const parentAgentId = isSuperAgent && !isAdmin
    ? gate.user.id
    : (body?.parent_agent_id ? String(body.parent_agent_id) : null);

  const { data: inserted, error } = await supabase
    .from('agent_invitations')
    .insert({
      token,
      email,
      full_name: fullName,
      intended_role: intendedRole,
      intended_tier: intendedTier,
      intended_account_type: intendedAccountType,
      intended_credit_limit: creditLimit,
      intended_prepaid_balance: prepaidBalance,
      parent_agent_id: parentAgentId,
      invited_by: gate.user.id,
    })
    .select('id, token, email, intended_role, expires_at')
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: 'Could Not Create The Invitation.' }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      id: inserted.id,
      email: inserted.email,
      intended_role: inserted.intended_role,
      expires_at: inserted.expires_at,
      invite_url: `${appUrl()}/invite/${inserted.token}`,
    },
  }, { status: 201 });
}
