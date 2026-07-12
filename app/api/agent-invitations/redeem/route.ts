
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

// Public invitation redemption. No session required (the recipient has no
// account yet) -- the one-time token is the credential. Rate-limited by IP.
//
// GET  /api/agent-invitations/redeem?token=... -> validate + return inviter info
// POST /api/agent-invitations/redeem            -> set password, provision account

const PASSWORD_MIN = 8;

function inviteStatus(row: any): 'pending' | 'redeemed' | 'revoked' | 'expired' {
  if (row.metadata?.revoked === true) return 'revoked';
  if (row.redeemed_at) return 'redeemed';
  if (new Date(row.expires_at).getTime() < Date.now()) return 'expired';
  return 'pending';
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim();
  if (!token) return NextResponse.json({ error: 'Missing Token.' }, { status: 400 });

  const rl = await rateLimit({ key: 'invite_redeem_get', limit: 30, windowSeconds: 60, identifier: getClientIp(req) });
  if (!rl.allowed) return NextResponse.json({ error: 'Too Many Requests.' }, { status: 429 });

  const supabase = createAdminClient();
  const { data: invite } = await supabase
    .from('agent_invitations')
    .select('email, full_name, intended_role, intended_tier, expires_at, redeemed_at, metadata, invited_by')
    .eq('token', token)
    .maybeSingle();

  if (!invite) return NextResponse.json({ valid: false, reason: 'not_found' }, { status: 404 });

  const status = inviteStatus(invite);
  if (status !== 'pending') {
    return NextResponse.json({ valid: false, reason: status });
  }

  // Best-effort inviter display name (never leak email).
  let invitedByName: string | null = null;
  if (invite.invited_by) {
    const { data: inviter } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', invite.invited_by)
      .maybeSingle();
    invitedByName = inviter?.full_name ?? null;
  }

  return NextResponse.json({
    valid: true,
    email: invite.email,
    full_name: invite.full_name,
    intended_role: invite.intended_role,
    intended_tier: invite.intended_tier,
    expires_at: invite.expires_at,
    invited_by_name: invitedByName,
  });
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit({ key: 'invite_redeem_post', limit: 10, windowSeconds: 3600, identifier: getClientIp(req) });
  if (!rl.allowed) return NextResponse.json({ error: 'Too Many Requests. Please Try Again Later.' }, { status: 429 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid Request Body.' }, { status: 400 });
  }

  const token = String(body?.token ?? '').trim();
  const password = String(body?.password ?? '');
  const fullNameInput = body?.full_name ? String(body.full_name).trim().slice(0, 120) : null;

  if (!token) return NextResponse.json({ error: 'Missing Token.' }, { status: 400 });
  if (password.length < PASSWORD_MIN) {
    return NextResponse.json({ error: `Password Must Be At Least ${PASSWORD_MIN} Characters.` }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Atomically CLAIM the invite: only one request can flip a pending, unexpired
  // row to redeemed_at = NOW(). If zero rows come back, the token was already
  // used, revoked or expired -- never double-provision.
  const claimedAt = new Date().toISOString();
  const { data: invite, error: claimError } = await supabase
    .from('agent_invitations')
    .update({ redeemed_at: claimedAt })
    .eq('token', token)
    .is('redeemed_at', null)
    .gt('expires_at', claimedAt)
    .select('id, email, full_name, intended_role, intended_tier, intended_account_type, intended_credit_limit, intended_prepaid_balance, parent_agent_id, invited_by, metadata')
    .maybeSingle();

  if (claimError) {
    return NextResponse.json({ error: 'Could Not Process The Invitation.' }, { status: 500 });
  }
  if (!invite) {
    return NextResponse.json({ error: 'This Invitation Is No Longer Valid.' }, { status: 410 });
  }
  if (invite.metadata?.revoked === true) { // @ts-ignore
    // Revoked rows already carry redeemed_at; the guard above would normally
    // exclude them, but guard against a race where revoke landed first.
    return NextResponse.json({ error: 'This Invitation Was Revoked.' }, { status: 410 });
  }

  // Helper to release the claim if provisioning fails, so the invite stays usable.
  const releaseClaim = async () => {
    await supabase
      .from('agent_invitations')
      .update({ redeemed_at: null })
      .eq('id', invite.id)
      .eq('redeemed_at', claimedAt);
  };

  // Reject if an account already exists for this email.
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', invite.email)
    .maybeSingle();
  if (existing) {
    await releaseClaim();
    return NextResponse.json({ error: 'An Account With That Email Already Exists. Please Sign In.' }, { status: 409 });
  }

  const fullName = fullNameInput || invite.full_name || null;

  // Create the auth user (email pre-confirmed -- the invite proves ownership).
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role: 'agent' }
  });

  if (authError || !authData?.user) {
    await releaseClaim();
    return NextResponse.json({ error: 'Could Not Create The Account.' }, { status: 500 });
  }

  const userId = authData.user.id;
  const isSubAgent = invite.intended_role === 'agent' && !!invite.parent_agent_id;

  // Provision the profile with the invitation's pre-decided attributes. The
  // on_auth_user_created trigger seeds a researcher row; upgrade it here. This
  // runs as the service role, so the protect_profile_columns trigger (which
  // only pins columns for the 'authenticated' role) does not block these writes.
  const profilePatch: Record<string, any> = {
    role: invite.intended_role,
    full_name: fullName,
    parent_agent_id: invite.parent_agent_id,
    is_sub_agent: isSubAgent,
    is_super_agent: invite.intended_role === 'super_agent',
    created_by_role: 'agent_invite',
    created_by_agent_id: invite.invited_by,
  };
  if (invite.intended_tier) profilePatch.tier = invite.intended_tier;
  if (invite.intended_account_type) profilePatch.account_type = invite.intended_account_type;
  if (invite.intended_credit_limit != null) profilePatch.credit_limit = invite.intended_credit_limit;
  if (invite.intended_prepaid_balance != null) profilePatch.prepaid_balance = invite.intended_prepaid_balance;

  const { error: profileError } = await supabase
    .from('profiles')
    .update(profilePatch)
    .eq('id', userId);

  if (profileError) {
    // Roll back the auth user and release the claim so the invite can be retried.
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    await releaseClaim();
    return NextResponse.json({ error: 'Could Not Finish Setting Up The Account.' }, { status: 500 });
  }

  // Finalize: stamp who redeemed it.
  await supabase
    .from('agent_invitations')
    .update({ redeemed_by: userId })
    .eq('id', invite.id);

  return NextResponse.json({
    ok: true,
    email: invite.email,
    role: invite.intended_role,
    message: 'Your Account Is Ready. Please Sign In.',
  });
}
