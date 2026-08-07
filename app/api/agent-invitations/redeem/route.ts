
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { generateStorefrontQr } from '@/lib/qr-storefront';
import { seedStorefrontFromHousePrices } from '@/lib/seed-storefront';
import { validateStoreSlug } from '@/lib/store-slug';
import { randomBytes } from 'crypto';
import { validatePassword } from '@/lib/password-policy';

// Public invitation redemption. No session required (the recipient has no
// account yet) -- the one-time token is the credential. Rate-limited by IP.
//
// GET  /api/agent-invitations/redeem?token=... -> validate + return inviter info
// POST /api/agent-invitations/redeem            -> set password, provision account


function inviteStatus(row: any): 'pending' | 'redeemed' | 'revoked' | 'expired' {
  if (row.metadata?.revoked === true) return 'revoked';
  if (row.redeemed_at) return 'redeemed';
  if (new Date(row.expires_at).getTime() < Date.now()) return 'expired';
  return 'pending';
}

// Storefront slug derivation for an invited account.
//
// An invited agent is created from an email address alone and never gets a
// `profiles.username`, so unlike /api/admin/agents -- where an admin types the
// slug into the creation form -- there is nothing here a human already chose.
// We build a candidate from the invitee's name, falling back to the email
// local-part, and squeeze it into the shape lib/store-slug.ts allows so the
// agent_profiles_slug_shape CHECK and the edge middleware (proxy.ts) both
// accept it. Collision handling is the caller's job.
function deriveSlugBase(fullName: string | null, email: string): string {
  const raw = (fullName && fullName.trim()) || email.split('@')[0] || 'agent';
  const base = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // spaces, dots and punctuation all collapse to hyphens
    .replace(/^-+/, '')          // a slug MUST start with an alphanumeric
    .slice(0, 40)                // leave room for a '-<n>' collision suffix
    .replace(/-+$/, '');
  // 'agent' is the same last-resort base the provision_agent_storefront()
  // database function uses, so the SQL path and this one degrade identically.
  return base.length >= 2 ? base : 'agent';
}

// Render and store the storefront QR for an agent that already has an
// agent_profiles row but no cached QR image.
//
// This is the normal state after the database provisions a storefront: the
// profiles_provision_storefront_after_role_change trigger inserts the row with
// a slug and display_name, but it is pure SQL and cannot rasterise a QR code,
// so qr_code_data is left NULL. Only a Node path like this one can fill it in.
async function backfillStorefrontQr(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  refCode: string | null,
): Promise<void> {
  const { data: row } = await supabase
    .from('agent_profiles')
    .select('slug, qr_code_data')
    .eq('id', userId)
    .maybeSingle();

  // Nothing to do when the row is missing entirely (the caller handles that) or
  // when a QR is already cached -- a stored code is never regenerated, because
  // the agent may already have it printed on cards.
  if (!row?.slug || row.qr_code_data) return;

  const qrCodeData = await generateStorefrontQr(row.slug, refCode ?? row.slug);
  // generateStorefrontQr returns null instead of throwing when rendering fails.
  // Bail out rather than writing that null: the storefront works fine without a
  // cached code, and a later redemption/backfill can still supply one.
  if (!qrCodeData) return;

  await supabase
    .from('agent_profiles')
    .update({ qr_code_data: qrCodeData })
    .eq('id', userId)
    .is('qr_code_data', null); // never clobber a value a concurrent writer just stored
}

// Give a freshly-redeemed agent a complete, scannable storefront.
//
// Before this existed, redeeming an invitation set profiles.role and stopped
// there, which left two different broken states depending on the invited role:
//
//   intended_role = 'agent'        the profiles_provision_storefront_after_role_change
//                                  trigger fires and creates the agent_profiles
//                                  row, but qr_code_data stays NULL forever --
//                                  the agent has a storefront they can never
//                                  hand out a QR code for.
//   intended_role = 'super_agent'  that trigger's WHEN clause only matches
//                                  new.role = 'agent', so it never fires at all:
//                                  no agent_profiles row, no slug, and nothing
//                                  for the middleware to route /<slug> to.
//
// Every other agent-creation path in the app (/api/admin/agents,
// /api/agent/agents) provisions a full storefront; this route was the outlier.
// The whole function is idempotent: it is safe to re-run against an account
// that is already provisioned, and it never renumbers an existing slug.
async function provisionStorefront(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  fullName: string | null,
  email: string,
  refCode: string | null,
): Promise<void> {
  // Idempotency first. The database trigger may have inserted the row
  // milliseconds ago, and a retried redemption must never mint a second
  // storefront or move an agent to a different slug.
  const { data: existing } = await supabase
    .from('agent_profiles')
    .select('slug')
    .eq('id', userId)
    .maybeSingle();

  if (existing?.slug) {
    await backfillStorefrontQr(supabase, userId, refCode);
    return;
  }

  // No row yet. Walk collisions the same way provision_agent_storefront() does:
  // base, base-2, base-3, ... validateStoreSlug enforces both the shape and the
  // reserved-segment list, so a slug like `admin` or `checkout` -- which would
  // hand the agent a QR code aimed at an app route and a storefront nobody can
  // reach -- can never be persisted here.
  const base = deriveSlugBase(fullName, email);
  let slug: string | null = null;
  for (let attempt = 1; attempt <= 25; attempt++) {
    const candidate = attempt === 1 ? base : `${base.slice(0, 38)}-${attempt}`;
    if (validateStoreSlug(candidate) !== null) continue;
    const { data: taken } = await supabase
      .from('agent_profiles')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (!taken) {
      slug = candidate;
      break;
    }
  }
  if (!slug) {
    // Pathological collision run. Mirror the database function's escape hatch:
    // a short random suffix, which is effectively certain to be free.
    slug = `${base.slice(0, 30)}-${randomBytes(3).toString('hex')}`;
  }

  // Carries ?ref= so a scan mints a HARD first-scan-wins referral lock rather
  // than the replaceable soft lock a bare storefront URL produces, and renders
  // black-on-white so phone cameras can actually decode it.
  // See lib/qr-storefront.ts.
  const qrCodeData: string | null = await generateStorefrontQr(slug, refCode ?? slug);

  const row: Record<string, any> = {
    id: userId,
    slug,
    // agent_profiles.display_name is NOT NULL. Match the fallback chain in
    // provision_agent_storefront() so an invited agent and a trigger-provisioned
    // one end up with the same name.
    display_name: (fullName && fullName.trim()) || 'Agent',
    is_active: true,
  };
  // Only send qr_code_data when a code actually rendered, so a failed render can
  // never write NULL over a value some other path already stored.
  if (qrCodeData) row.qr_code_data = qrCodeData;

  const { error: insertError } = await supabase.from('agent_profiles').insert(row);
  if (insertError) {
    // 23505 = unique violation: the database trigger or a concurrent retry
    // inserted the row between our existence check above and this insert. That
    // is a success as far as we are concerned -- the storefront exists -- so
    // just make sure whoever won did not leave the QR NULL.
    if ((insertError as { code?: string }).code === '23505') {
      await backfillStorefrontQr(supabase, userId, refCode);
      return;
    }
    throw insertError;
  }

  try {
    // Seed the new storefront with the HOUSE (admin) store's retail prices as
    // the default "set price"; falls back to rookie house-tier pricing for any
    // product the house store has not priced. Agent can change prices later.
    await seedStorefrontFromHousePrices(supabase, userId);
  } catch (provisionErr) {
    console.error('[agent-invitations/redeem] storefront price seeding failed (non-fatal):', provisionErr);
  }
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
  const pwError = validatePassword(password);
  if (pwError) {
    return NextResponse.json({ error: pwError }, { status: 400 });
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
  // An invited account is never a sub-agent.
  //
  // This was `intended_role === 'agent' && !!invite.parent_agent_id`, which is
  // true for EVERY super-agent-issued invitation: /api/agent/invitations stamps
  // parent_agent_id = the inviting super agent's own id on every invite it
  // mints, and a super agent may only invite intended_role = 'agent'. The
  // profile UPDATE below then broke two separate database rules and always
  // failed:
  //
  //   - block_subagent_under_superagent() RAISEs 'Super-agents cannot own
  //     sub-agents' whenever is_sub_agent is true and the parent is a super
  //     agent, which is precisely this case; and
  //   - the profiles_sub_agent_must_have_commission CHECK requires both
  //     commission_pct and commission_active_since on any sub-agent row, and an
  //     invitation carries neither.
  //
  // Either one surfaced only as the generic 'Could Not Finish Setting Up The
  // Account.' 500 below, after which the auth user was deleted and the claim
  // released -- a completely dead invitation flow with no usable diagnostic.
  //
  // parent_agent_id is still written to the profile, so the billing/downline
  // chain is preserved. This matches /api/agent/agents, which likewise creates
  // FULL agents beneath a super agent with is_sub_agent: false and
  // parent_agent_id set to that super agent.
  const isSubAgent = false;

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

  // Hard-lock: keep credit limit and auto-approve behavior in sync with account type
  if (profilePatch.account_type === 'prepaid' || profilePatch.account_type === null) {
    profilePatch.credit_limit = null;
    profilePatch.auto_approve_orders = false;
    profilePatch.max_auto_approve_limit = null;
  } else if (profilePatch.account_type === 'credit') {
    profilePatch.auto_approve_orders = true;
    profilePatch.max_auto_approve_limit = profilePatch.credit_limit || null;
  }

  // Select the referral identifiers back from the same statement (no extra
  // round trip) -- the storefront QR needs one so a scan mints a hard referral
  // lock. See lib/qr-storefront.ts for why a QR without ?ref= loses attribution.
  const { data: updatedProfile, error: profileError } = await supabase
    .from('profiles')
    .update(profilePatch)
    .eq('id', userId)
    .select('username, referral_code')
    .maybeSingle();

  if (profileError) {
    // Roll back the auth user and release the claim so the invite can be retried.
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    await releaseClaim();
    return NextResponse.json({ error: 'Could Not Finish Setting Up The Account.' }, { status: 500 });
  }

  // Provision the storefront now that the profile carries its final role.
  //
  // Deliberately non-fatal: the one-time token has already been consumed and the
  // account is usable, so a storefront hiccup must not delete a working auth
  // user or strand the invitee with a burnt invitation. Anything missed here is
  // recoverable -- re-running this provisioning is idempotent.
  const refCode = updatedProfile?.referral_code || updatedProfile?.username || null;
  if (invite.intended_role === 'agent' || invite.intended_role === 'super_agent') {
    try {
      await provisionStorefront(supabase, userId, fullName, invite.email, refCode);
    } catch (storefrontErr) {
      console.error('[agent-invitations/redeem] storefront provisioning failed (non-fatal):', storefrontErr);
    }
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
