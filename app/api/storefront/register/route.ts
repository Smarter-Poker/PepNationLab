
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
import { recordAttributionEvent } from '@/lib/attribution-log';
import { cookies } from 'next/headers';
import { verifyRefLock, REF_LOCK_COOKIE, REF_DISPLAY_COOKIE } from '@/lib/ref-lock';

/**
 * POST /api/storefront/register
 *
 * Self-registration endpoint for researchers arriving at an agent storefront.
 * Rate-limited to 10 registrations per hour per IP to prevent abuse.
 * Uses createAdminClient (raw supabase-js) to bypass RLS on profile writes.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  // to be a string obeying lib/password-policy. The previous hand checks called
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
  const { username, password, firstName, lastName, phone, code } = parsedBody.data;
  let agentSlug = parsedBody.data.agentSlug;
  let subAgentId = parsedBody.data.subAgentId ?? null;
  let referralCode = String(parsedBody.data.referralCode ?? '').trim();
  const email = normalizeEmail(parsedBody.data.email ?? '');

  // QR referral lock: the signed httpOnly cookie set by the middleware is the
  // AUTHORITATIVE attribution. When a valid lock exists it overrides whatever
  // the form submitted — the form body cannot change who gets signup credit.
  const cookieStore = await cookies();
  const refLock = await verifyRefLock(cookieStore.get(REF_LOCK_COOKIE)?.value);
  if (refLock) {
    referralCode = refLock.c;
    if (refLock.s) agentSlug = refLock.s;
    if (refLock.sa) subAgentId = refLock.sa;
  }
  // Where the attribution came from, for the audit trail. 'form' means the
  // visitor arrived with no lock and the storefront page supplied the slug.
  const attributionSource = refLock ? (refLock.k === 'url' ? 'storefront_url' : 'qr') : 'form';

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

    // ── Resolve the referring agent ──────────────────────────────────────────
    // Order of authority:
    //   1. the storefront slug (form body, or the lock's own slug)
    //   2. refLock.a — the owner id the middleware ALREADY resolved and signed
    //      at scan time. This is what rescues a lock whose referrer has no
    //      storefront of their own (s:null — a researcher's code, or an agent
    //      whose agent_profiles row is inactive). Before this, such a signup
    //      submitted an empty agentSlug and the whole registration 404'd with
    //      "Storefront Not Found Or Inactive.": a valid, credited scan turned
    //      into a dead signup form.
    //   3. the house store, so a real scan is NEVER dead-ended.
    // An explicitly submitted slug that does not resolve, with no lock backing
    // it, still 404s — that is a genuine bad link, not a lost scan.
    let referringAgentId: string | null = null;
    let referringSubAgentId: string | null = null;

    const isLiveAccount = async (id: string): Promise<boolean> => {
      if (!UUID_RE.test(id)) return false;
      const { data } = await admin
        .from('profiles')
        .select('id, is_active, deleted_at')
        .eq('id', id)
        .maybeSingle();
      // deleted_at matters as much as is_active: a soft-deleted agent keeps its
      // agent_profiles row, so a stale storefront link would otherwise still
      // credit an account that no longer exists to the rest of the app.
      return !!data && data.is_active === true &&
        (data as { deleted_at?: string | null }).deleted_at == null;
    };

    const resolveSlugOwner = async (slug: string): Promise<string | null> => {
      if (!slug) return null;
      const { data: ap, error: apErr } = await admin
        .from('agent_profiles')
        .select('id')
        .eq('slug', slug)
        // The storefront itself must be live, not just its owner's account.
        // The middleware already gates guest browsing on agent_profiles
        // .is_active; without the same gate here a deactivated storefront kept
        // collecting signups through any still-circulating QR code.
        .eq('is_active', true)
        .maybeSingle();
      if (apErr || !ap?.id) return null;
      return (await isLiveAccount(ap.id)) ? ap.id : null;
    };

    const submittedSlug = String(agentSlug ?? '').trim().toLowerCase();

    // FIRST: Signed cookie (refLock) is the server-side truth of who owns this session.
    // Minted by middleware on a QR scan or direct storefront visit.
    if (refLock?.a && (await isLiveAccount(refLock.a))) {
      referringAgentId = refLock.a;
      if (refLock.sa && (await isLiveAccount(refLock.sa))) {
        referringSubAgentId = refLock.sa;
      }
    }

    // SECOND: Explicit Referral Code from the form.
    // If refLock is absent (or invalid), the user might still have typed a code manually.
    if (!referringAgentId && referralCode && /^[a-z0-9_-]{2,80}$/i.test(referralCode)) {
      const refPattern = referralCode.replace(/([%_\\])/g, '\\$1');
      const { data: refRows } = await admin
        .from('profiles')
        .select('id, role, username, referral_code, is_active, is_sub_agent, parent_agent_id')
        .or(`username.ilike.${refPattern},referral_code.ilike.${refPattern}`)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('username', { ascending: true })
        .order('id', { ascending: true })
        .limit(5);

      const rows = (refRows ?? []) as Array<{
        id: string; role: string | null; username: string | null;
        referral_code: string | null; is_sub_agent: boolean | null;
        parent_agent_id: string | null;
      }>;
      const wanted = referralCode.toLowerCase();
      const refMatch =
        rows.find((r) => (r.referral_code ?? '').toLowerCase() === wanted) ??
        rows.find((r) => (r.username ?? '').toLowerCase() === wanted) ??
        rows[0] ??
        null;

      if (refMatch) {
        if (refMatch.role === 'agent' || refMatch.role === 'super_agent' || refMatch.role === 'admin') {
          referringAgentId = refMatch.id;
          referringSubAgentId = null;
        } else if (refMatch.is_sub_agent && refMatch.parent_agent_id) {
          referringAgentId = refMatch.parent_agent_id;
          referringSubAgentId = refMatch.id;
        }
      }
    }

    // THIRD: Fallback to the client's submitted agentSlug (what they were browsing).
    if (!referringAgentId && submittedSlug) {
      referringAgentId = await resolveSlugOwner(submittedSlug);
    }

    // FOURTH: Fallback to the default store (house).
    if (!referringAgentId) {
      referringAgentId = await resolveSlugOwner(DEFAULT_STORE_SLUG);
    }

    if (!referringAgentId) {
      return NextResponse.json({ error: 'Storefront Not Found Or Inactive.' }, { status: 404 });
    }

    // Sub-agent attribution from client payload.
    // Only applied if the server hasn't already resolved one via refLock or referralCode,
    // and only credited if the id is a real, live sub-agent whose parent is the resolved agent.
    if (!referringSubAgentId && subAgentId && UUID_RE.test(String(subAgentId))) {
      const { data: subAgent } = await admin
        .from('profiles')
        .select('id, is_sub_agent, parent_agent_id, is_active, deleted_at')
        .eq('id', subAgentId)
        .maybeSingle();
      if (
        subAgent &&
        subAgent.is_sub_agent &&
        subAgent.parent_agent_id === referringAgentId &&
        subAgent.is_active === true &&
        (subAgent as { deleted_at?: string | null }).deleted_at == null
      ) {
        referringSubAgentId = subAgent.id;
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
      // referring_agent_id / referring_sub_agent_id are DELIBERATELY absent.
      //
      // `handle_new_user` already created this row (AFTER INSERT on auth.users)
      // and `trg_00_ensure_researcher_house_agent` stamped referring_agent_id
      // with the house agent on the way in. Carrying our resolved agent in this
      // upsert therefore makes it an UPDATE house -> agent, which
      // `enforce_researcher_agent_binding` rejects with SQLSTATE 23000 — the
      // route then deletes the auth user and returns 500. That is why every
      // storefront signup resolving to a real agent has been failing since the
      // house-agent default landed. Binding happens below through the
      // sanctioned RPC instead.
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

    // Bind the resolved referring agent through the sanctioned RPC. This is the
    // ONLY write path that can move a fresh researcher off the house-agent
    // default without tripping enforce_researcher_agent_binding. It is scoped to
    // profiles younger than 15 minutes that are still on house/NULL, so it can
    // never re-point an established researcher.
    let bindOk = false;
    {
      const { data: bound, error: bindErr } = await admin.rpc('bind_storefront_referral', {
        p_user_id: newUserId,
        p_agent_id: referringAgentId,
        p_sub_agent_id: referringSubAgentId,
      });
      if (bindErr) {
        console.error('[storefront/register] bind_storefront_referral error:', bindErr);
      } else {
        bindOk = bound === true;
        if (!bindOk) {
          console.error(
            '[storefront/register] bind_storefront_referral did not bind',
            { user: newUserId, agent: referringAgentId, subAgent: referringSubAgentId }
          );
        }
      }
    }

    // Immutable attribution audit trail. acquisition_source stays 'storefront'
    // (an established CRM value); the PROVENANCE — QR scan vs typed storefront
    // URL vs plain form — plus the exact code, store and lock age land here, so
    // a commission dispute can be settled from data instead of from logs that
    // have already rolled off.
    await recordAttributionEvent(admin, {
      event: 'signup_attributed',
      channel: 'storefront_register',
      source: attributionSource,
      user_id: newUserId,
      agent_id: referringAgentId,
      sub_agent_id: referringSubAgentId,
      ref_code: referralCode || null,
      store_slug: submittedSlug || null,
      lock_minted_at: refLock?.t ? new Date(refLock.t).toISOString() : null,
      detail: { lock_kind: refLock?.k ?? null, lock_version: refLock?.v ?? 0, bound: bindOk },
    });

    await notifyNewResearcher(admin, referringAgentId, fullName).catch(() => { /* ignore */ });
    // The sub-agent who actually made the referral gets told too. Previously
    // only the parent agent was notified, so a sub-agent never learned their
    // own share link had converted.
    if (referringSubAgentId && referringSubAgentId !== referringAgentId) {
      await notifyNewResearcher(admin, referringSubAgentId, fullName).catch(() => { /* ignore */ });
    }

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
        path: `/${String(agentSlug ?? '').slice(0, 80)}`,
      });
    }

    // Signup referral code (best-effort, never fails the registration).
    // Resolves the referrer by username OR researcher referral code across every
    // role: researchers/sub-agents earn referral credits; agents/super-agents get
    // the new user assigned to their downline. Service-client only (EXECUTE on
    // apply_signup_referral is revoked from anon/authenticated).
    let referralResult: Record<string, unknown> | null = null;
    {
      if (referralCode) {
        try {
          const { data: refOut, error: refErr } = await admin.rpc('apply_signup_referral', {
            p_referee_id: newUserId,
            p_code: referralCode.slice(0, 50),
          });
          if (refErr) {
            // Fail LOUD: a referral RPC error (e.g. the apply_signup_referral
            // migration drift that silently sent signups to the house store)
            // must surface, never be swallowed. Signup still proceeds.
            console.error('[storefront/register] apply_signup_referral error:', refErr);
          } else if (refOut && typeof refOut === 'object') {
            referralResult = refOut as Record<string, unknown>;
            if ((refOut as { applied?: boolean }).applied === false) {
              console.warn('[storefront/register] referral code not applied:', refOut);
            }
            // Record the referee email on any referral row that was created.
            const refId = (refOut as { referral_id?: string }).referral_id;
            if (refId) {
              await admin
                .from('researcher_referrals')
                .update({ referee_email: email })
                .eq('id', refId);
            }
          }
        } catch (e) { console.error('[storefront/register] referral apply threw:', e); }
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
      promoCode: submittedSlug === DEFAULT_STORE_SLUG ? 'FIRST20' : undefined,
    }).catch(() => { /* ignore */ });

    const successRes = NextResponse.json({
      success: true,
      userId: newUserId,
      username: usernameClean,
      referral: referralResult,
      promo: promoResult,
      promoWarning,
    });
    // The QR lock's job is done once the account exists — clear both cookies
    // so a future signup on this device starts fresh. The attributes must match
    // the ones the middleware wrote or the browser keeps the original cookie.
    successRes.cookies.set(REF_LOCK_COOKIE, '', {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0,
    });
    successRes.cookies.set(REF_DISPLAY_COOKIE, '', {
      httpOnly: false, secure: true, sameSite: 'lax', path: '/', maxAge: 0,
    });
    return successRes;
  } catch (err) {
    console.error('[storefront/register] POST error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error.' },
      { status: 500 }
    );
  }
}
