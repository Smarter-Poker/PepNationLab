import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sanitizeUsername, validateUsername } from '@/lib/usernames';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * Redeem an agent invitation token.
 *
 * This route runs without an authenticated caller — the invitation token IS
 * the credential. We rate-limit by IP (5/hour) so an attacker can't brute
 * force valid tokens (192 bits of entropy makes that pointless anyway, but
 * defence in depth).
 *
 * Side effects, in order:
 *   1. Validate the token (must exist, not be redeemed, not be expired, not
 *      be revoked).
 *   2. Sanitize + validate the username.
 *   3. Create the auth user with the invite's email and the supplied password
 *      via the service role (so we can pre-confirm the email).
 *   4. Upsert the `profiles` row with the intended role / tier / accounting
 *      fields from the invite. Mark site-entry disclaimer as already accepted
 *      since the invite implies prior knowledge.
 *   5. For agents and super_agents, create an `agent_profiles` row with a
 *      slug derived from the username; if it collides we tack on a short
 *      random suffix. The storefront stays inactive (is_active=false) until
 *      the agent completes setup.
 *   6. Mark the invite redeemed.
 *
 * The client then signs in with email+password and lands on the dashboard.
 */

const PASSWORD_MIN = 8;

interface RedeemPayload {
  token?: unknown;
  password?: unknown;
  username?: unknown;
  full_name?: unknown;
}

function slugFromUsername(u: string): string {
  return u.replace(/_/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 32) || 'agent';
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

export async function POST(req: NextRequest) {
  // Rate-limit BEFORE doing any DB work.
  const ip = getClientIp({ headers: req.headers });
  const rl = await rateLimit({
    key: 'invite_redeem',
    limit: 5,
    windowSeconds: 60 * 60,
    identifier: ip,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too Many Attempts. Please Wait And Try Again.' },
      { status: 429 }
    );
  }

  let body: RedeemPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid Request.' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const rawUsername = typeof body.username === 'string' ? body.username : '';
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim().slice(0, 200) : null;

  if (!token) {
    return NextResponse.json({ error: 'Invite Token Required.' }, { status: 400 });
  }
  if (!password || password.length < PASSWORD_MIN) {
    return NextResponse.json({ error: `Password Must Be At Least ${PASSWORD_MIN} Characters.` }, { status: 400 });
  }

  const username = sanitizeUsername(rawUsername);
  const usernameCheck = validateUsername(username);
  if (!usernameCheck.valid) {
    return NextResponse.json({ error: usernameCheck.error ?? 'Invalid Username.' }, { status: 400 });
  }

  const service = await createServiceClient();

  // 1. Validate the token.
  const { data: invite, error: lookupErr } = await service
    .from('agent_invitations')
    .select('id, email, full_name, intended_role, intended_tier, intended_account_type, intended_credit_limit, intended_prepaid_balance, parent_agent_id, invited_by, expires_at, redeemed_at, metadata')
    .eq('token', token)
    .maybeSingle();

  if (lookupErr || !invite) {
    return NextResponse.json({ error: 'Invite Link Is Invalid Or Has Expired.' }, { status: 404 });
  }
  if (invite.redeemed_at) {
    return NextResponse.json({ error: 'Invite Link Is Invalid Or Has Expired.' }, { status: 410 });
  }
  if ((invite.metadata as { revoked?: boolean } | null)?.revoked === true) {
    return NextResponse.json({ error: 'Invite Link Is Invalid Or Has Expired.' }, { status: 410 });
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Invite Link Is Invalid Or Has Expired.' }, { status: 410 });
  }

  // 2. Username uniqueness pre-check.
  const { data: existingUsername } = await service
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (existingUsername) {
    return NextResponse.json({ error: 'Username Already Taken.' }, { status: 409 });
  }

  const email = invite.email.toLowerCase();
  const finalFullName = fullName || invite.full_name || null;

  // 3. Create the auth user via service role.
  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: finalFullName,
      username,
      from_invitation: invite.id,
    },
  });

  if (createErr || !created?.user) {
    const msg = (createErr?.message || '').toLowerCase();
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
      return NextResponse.json({ error: 'An Account With That Email Already Exists. Please Sign In.' }, { status: 409 });
    }
    return NextResponse.json({ error: createErr?.message || 'Failed To Create Account.' }, { status: 500 });
  }

  const newUserId = created.user.id;

  // 4. Upsert the profile.
  const role = invite.intended_role === 'super_agent' ? 'super_agent' : 'agent';
  const profileUpdate: Record<string, unknown> = {
    id: newUserId,
    email,
    full_name: finalFullName,
    username,
    role,
    is_active: true,
    disclaimer_v1_accepted: true,
    disclaimer_accepted_at: new Date().toISOString(),
  };
  if (invite.intended_tier) profileUpdate.tier = invite.intended_tier;
  if (invite.intended_account_type) profileUpdate.account_type = invite.intended_account_type;
  if (invite.intended_credit_limit != null) profileUpdate.credit_limit = invite.intended_credit_limit;
  if (invite.intended_prepaid_balance != null) profileUpdate.prepaid_balance = invite.intended_prepaid_balance;
  if (invite.parent_agent_id) {
    profileUpdate.parent_agent_id = invite.parent_agent_id;
    profileUpdate.referring_agent_id = invite.parent_agent_id;
  }
  if (role === 'super_agent') {
    profileUpdate.is_super_agent = true;
  }

  const { error: profileErr } = await service
    .from('profiles')
    .upsert(profileUpdate, { onConflict: 'id' });

  if (profileErr) {
    // eslint-disable-next-line no-console
    console.error('[invite/redeem] profile upsert failed', profileErr);
    return NextResponse.json({ error: 'Failed To Finalize Account.' }, { status: 500 });
  }

  // 5. Seed storefront row.
  let assignedSlug: string | null = null;
  const baseSlug = slugFromUsername(username);
  for (const candidate of [baseSlug, `${baseSlug}-${randomSuffix()}`]) {
    const { error: storefrontErr } = await service
      .from('agent_profiles')
      .insert({
        id: newUserId,
        slug: candidate,
        display_name: finalFullName || username,
        is_active: false,
        primary_color: '#00C4BC',
      });
    if (!storefrontErr) {
      assignedSlug = candidate;
      break;
    }
    const msg = (storefrontErr.message || '').toLowerCase();
    if (!msg.includes('reserved') && !msg.includes('unique') && !msg.includes('duplicate') && !msg.includes('check constraint')) {
      // eslint-disable-next-line no-console
      console.error('[invite/redeem] storefront insert failed', storefrontErr);
      break;
    }
  }

  // 6. Mark the invite redeemed.
  const { error: markErr } = await service
    .from('agent_invitations')
    .update({ redeemed_at: new Date().toISOString(), redeemed_by: newUserId })
    .eq('id', invite.id);

  if (markErr) {
    // eslint-disable-next-line no-console
    console.error('[invite/redeem] mark redeemed failed', markErr);
  }

  return NextResponse.json({
    success: true,
    role,
    email,
    needs_setup: true,
    slug: assignedSlug,
  });
}
