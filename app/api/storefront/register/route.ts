
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sanitizeUsername } from '@/lib/usernames';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { notifyNewResearcher } from '@/lib/notify';
import { emailConfigured, sendWelcomeEmail } from '@/lib/email';
import { hashCode, isValidEmail, normalizeEmail, CODE_PURPOSE_SIGNUP, MAX_CODE_ATTEMPTS } from '@/lib/verification';
import { StorefrontRegisterSchema } from '@/lib/schemas/auth';
import { recordServerAnalyticsEvent } from '@/lib/server-analytics';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';

/**
 * POST /api/storefront/register
 *
 * Self-registration endpoint for researchers arriving at an agent storefront.
 * Rate-limited to 10 registrations per hour per IP to prevent abuse.
 * Uses createAdminClient (raw supabase-js) to bypass RLS on profile writes.
 */

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  // Rate limiting by IP - use the shared persistent store (Supabase-backed) so
  // the limit holds across Vercel serverless invocations. An in-process Map
  // was previously used here but is always empty on cold starts, making the
  // limit completely ineffective.
  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'storefront_register',
    limit: 10,
    windowSeconds: 3600, // 1 hour
    identifier: ip,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too Many Registrations. Please Try Again Later.' },
      { status: 429 }
    );
  }

  const rawBody: unknown = await req.json().catch(() => ({}));

  // Schema-locked body. The password rule matters most: it is now REQUIRED
  // to be a string of 8-128 chars. The previous hand checks called
  // `password.length`, so a non-string JSON value (e.g. a bare number)
  // skipped both bounds entirely and went straight to auth.createUser.
  const parsedBody = StorefrontRegisterSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    const first = parsedBody.error.issues[0];
    const message =
      first?.path?.[0] === 'password'
        ? first.message
        : 'Username, Password, First Name, And Last Name Are Required.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const { agentSlug, username, password, firstName, lastName, phone, code } = parsedBody.data;
  const subAgentId = parsedBody.data.subAgentId ?? null;
  const email = normalizeEmail(parsedBody.data.email ?? '');

  // A real email is required for all public signups.
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'A Valid Email Address Is Required.' }, { status: 400 });
  }

  const usernameClean = sanitizeUsername(username);
  if (!usernameClean || usernameClean.length < 2) {
    return NextResponse.json(
      { error: 'Username Must Be At Least 2 Characters (Letters, Numbers, Underscores).' },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();

    // First, resolve the referring agent from the storefront slug
    let referringAgentId: string | null = null;
    let referringSubAgentId: string | null = null;

    const { data: agentProfile, error: agentErr } = await admin
      .from('agent_profiles')
      .select('id')
      .eq('slug', agentSlug)
      .maybeSingle();

    if (!agentErr && agentProfile) {
      const { data: agentUser } = await admin
        .from('profiles')
        .select('id, is_active')
        .eq('id', agentProfile.id)
        .maybeSingle();

      if (agentUser?.is_active) {
        referringAgentId = agentProfile.id;
        
        // Check sub-agent attribution if slug resolved successfully
        if (subAgentId) {
          const { data: subAgent } = await admin
            .from('profiles')
            .select('id, is_sub_agent, parent_agent_id')
            .eq('id', subAgentId)
            .maybeSingle();
          if (subAgent && subAgent.is_sub_agent && subAgent.parent_agent_id === referringAgentId) {
            referringSubAgentId = subAgentId;
          }
        }
      }
    }

    if (!referringAgentId) {
      return NextResponse.json({ error: 'Storefront Not Found Or Inactive.' }, { status: 404 });
    }

    // SECOND: Override with explicit Referral Code if provided and valid.
    // This pre-resolves it so the initial INSERT has the correct ID, bypassing
    // the enforce_researcher_agent_binding trigger error that blocks apply_signup_referral.
    const referralCode = String(parsedBody.data.referralCode ?? '').trim();
    if (referralCode) {
      const { data: refMatch } = await admin
        .from('profiles')
        .select('id, role, is_active, is_sub_agent, parent_agent_id')
        .or(`username.ilike.${referralCode},referral_code.ilike.${referralCode}`)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (refMatch) {
        if (refMatch.role === 'agent' || refMatch.role === 'super_agent') {
          referringAgentId = refMatch.id;
          referringSubAgentId = null;
        } else if (refMatch.is_sub_agent && refMatch.parent_agent_id) {
          referringAgentId = refMatch.parent_agent_id;
          referringSubAgentId = refMatch.id;
        }
      }
    }

    // Check username uniqueness - use .eq() not .ilike() (underscore is a LIKE wildcard).
    const { data: existingUser } = await admin
      .from('profiles')
      .select('id')
      .eq('username', usernameClean)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: 'That Username Is Already Taken.' }, { status: 400 });
    }

    // One email = one account. Block a second signup (e.g. under a different
    // agent) with an email already in use. The DB trigger enforce_unique_account_email
    // is the authoritative guard; this returns a clear message first.
    const { data: emailTaken } = await admin.rpc('account_email_exists', { p_email: email });
    if (emailTaken === true) {
      return NextResponse.json(
        { error: 'An Account Already Exists For This Email. Please Log In Instead.' },
        { status: 409 }
      );
    }

    // ── Email verification ────────────────────────────────────────────────────────
    // When the email sender is configured, a valid single-use code (issued by
    // /api/auth/request-code) is required and the email is marked verified.
    // When it is NOT configured yet, the account is still created with the email
    // stored but unverified, so signups never break before email is wired.
    const verificationRequired = emailConfigured();
    let emailVerified = false;
    if (verificationRequired) {
      if (!code || !/^\d{6}$/.test(String(code))) {
        return NextResponse.json({ error: 'Please Enter The 6-Digit Verification Code Sent To Your Email.' }, { status: 400 });
      }
      const { data: codeRow } = await admin
        .from('email_verification_codes')
        .select('id, code_hash, attempts, expires_at, consumed')
        .eq('email', email)
        .eq('purpose', CODE_PURPOSE_SIGNUP)
        .eq('consumed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!codeRow) {
        return NextResponse.json({ error: 'No Active Code. Please Request A New Verification Code.' }, { status: 400 });
      }
      if (new Date(codeRow.expires_at).getTime() < Date.now()) {
        return NextResponse.json({ error: 'Your Code Has Expired. Please Request A New One.' }, { status: 400 });
      }
      if ((codeRow.attempts ?? 0) >= MAX_CODE_ATTEMPTS) {
        return NextResponse.json({ error: 'Too Many Incorrect Attempts. Please Request A New Code.' }, { status: 429 });
      }
      const matches = hashCode(String(code), email) === codeRow.code_hash;
      if (!matches) {
        await admin
          .from('email_verification_codes')
          .update({ attempts: (codeRow.attempts ?? 0) + 1 })
          .eq('id', codeRow.id);
        return NextResponse.json({ error: 'Incorrect Code. Please Try Again.' }, { status: 400 });
      }
      await admin.from('email_verification_codes').update({ consumed: true }).eq('id', codeRow.id);
      emailVerified = true;
    }

    const internalEmail = `${usernameClean}@internal.auth`;
    const fullName = `${String(firstName).trim()} ${String(lastName).trim()}`;

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { username: usernameClean, full_name: fullName },
      app_metadata: { role: 'researcher' } // Storefront registration creates a researcher
    });

    if (authError || !authData?.user) {
      console.error('[storefront/register] auth.admin.createUser error:', authError);
      return NextResponse.json(
        { error: authError?.message || 'Failed To Create Account. Please Try Again.' },
        { status: 500 }
      );
    }

    const newUserId = authData.user.id;

    const profilePayload: Record<string, unknown> = {
      id: newUserId,
      email: null,
      contact_email: email,
      email_verified: emailVerified,
      username: usernameClean,
      full_name: fullName,
      first_name: String(firstName).trim(),
      last_name: String(lastName).trim(),
      phone: phone ? String(phone).trim() : null,
      role: 'researcher',
      referring_agent_id: referringAgentId,
      referring_sub_agent_id: referringSubAgentId,
      acquisition_source: 'storefront',
      disclaimer_v1_accepted: false,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { error: profileError } = await admin
      .from('profiles')
      //  Database schema mismatch from generated types
      .upsert(profilePayload, { onConflict: 'id' });

    if (profileError) {
      console.error('[storefront/register] profile upsert error:', profileError);
      await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json(
        { error: `Account Setup Failed. Please Try Again.` },
        { status: 500 }
      );
    }

    await notifyNewResearcher(admin, referringAgentId, fullName).catch(() => { /* ignore */ });

    // Server-authoritative signup analytics: joins the anonymous browse
    // session/visitor to the conversion without storing the new user id in the
    // event stream. Best-effort: never fails the registration.
    {
      const rb = (rawBody ?? {}) as { sessionId?: unknown; visitorId?: unknown };
      await recordServerAnalyticsEvent(admin, {
        agent_id: referringAgentId,
        event_type: 'signup',
        session_id: typeof rb.sessionId === 'string' ? rb.sessionId : null,
        visitor_id: typeof rb.visitorId === 'string' ? rb.visitorId : null,
        path: `/${String(agentSlug).slice(0, 80)}`,
      });
    }

    // Signup referral code (best-effort, never fails the registration).
    // Resolves the referrer by username OR researcher referral code across every
    // role: researchers/sub-agents earn referral credits; agents/super-agents get
    // the new user assigned to their downline. Service-client only (EXECUTE on
    // apply_signup_referral is revoked from anon/authenticated).
    let referralResult: Record<string, unknown> | null = null;
    {
      const referralCode = String(parsedBody.data.referralCode ?? '').trim();
      if (referralCode) {
        try {
          const { data: refOut, error: refErr } = await admin.rpc('apply_signup_referral', {
            p_referee_id: newUserId,
            p_code: referralCode.slice(0, 50),
          });
          if (!refErr && refOut && typeof refOut === 'object') {
            referralResult = refOut as Record<string, unknown>;
            // Record the referee email on any referral row that was created.
            const refId = (refOut as { referral_id?: string }).referral_id;
            if (refId) {
              await admin
                .from('researcher_referrals')
                .update({ referee_email: email })
                .eq('id', refId);
            }
          }
        } catch { /* invalid code -- signup proceeds regardless */ }
      }
    }

    // Signup promo code (best-effort). Grants a first-time perk (store credit or
    // a first-order coupon). A bad/expired code never blocks signup; the message
    // is surfaced so the client can show a soft warning.
    let promoResult: Record<string, unknown> | null = null;
    let promoWarning: string | null = null;
    {
      const promoCode = String(parsedBody.data.promoCode ?? '').trim();
      if (promoCode) {
        try {
          const { data: promoOut, error: promoErr } = await admin.rpc('redeem_signup_promo', {
            p_user_id: newUserId,
            p_code: promoCode.slice(0, 40),
          });
          if (promoErr) {
            promoWarning = promoErr.message || 'Promo Code Could Not Be Applied.';
          } else if (promoOut && typeof promoOut === 'object') {
            promoResult = promoOut as Record<string, unknown>;
          }
        } catch (e: unknown) {
          promoWarning = (e instanceof Error ? e.message : null) || 'Promo Code Could Not Be Applied.';
        }
      }
    }

    // Welcome email (best-effort, non-blocking). No-op if the sender is not
    // configured; only meaningful once email is live. House-store signups get
    // the extended welcome carrying the first-order promo code (owner rule
    // 2026-07-14); agent-storefront signups keep the plain welcome so house
    // marketing never lands on an agent's customer uninvited.
    sendWelcomeEmail({
      to: email,
      fullName,
      username: usernameClean,
      promoCode: agentSlug === DEFAULT_STORE_SLUG ? 'FIRST20' : undefined,
    }).catch(() => { /* ignore */ });

    return NextResponse.json({
      success: true,
      userId: newUserId,
      username: usernameClean,
      referral: referralResult,
      promo: promoResult,
      promoWarning,
    });
  } catch (err) {
    console.error('[storefront/register] POST error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error.' },
      { status: 500 }
    );
  }
}
