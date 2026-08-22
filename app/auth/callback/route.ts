export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ensureOAuthResearcherProfile, logOAuthRegistrationAck } from '@/lib/oauth-profile';
import { notifyNewResearcher } from '@/lib/notify';
import { getClientIp } from '@/lib/rate-limit';
import { safeRelativePath } from '@/lib/safe-redirect';
import { cookies } from 'next/headers';
import { verifyRefLock, REF_LOCK_COOKIE, REF_DISPLAY_COOKIE } from '@/lib/ref-lock';

/**
 * GET /auth/callback
 *
 * OAuth Callback For Google Sign-In. Exchanges The Auth Code For A Session,
 * Then Guarantees The Profile Is Complete Via The Shared, Canary-Tested
 * ensureOAuthResearcherProfile() Helper: Every New OAuth Account Is A
 * Researcher Linked To The House Storefront, Profiles Are Self-Healed If The
 * Database Trigger Ever Fails, And The Registration Disclaimer Acknowledgment
 * Collected On /signup (ack=registration) Is Persisted To The Mandatory
 * 4-Layer Audit Trail.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const ack = url.searchParams.get('ack');
  // agentRef is set by the signup page when the user entered an agent username
  // or arrived via a QR code scan. subAgentRef carries the QR ?sa= sub-agent
  // capture. Both travel as TOP-LEVEL callback params (built by
  // lib/oauth-callback-url.ts) so they survive the OAuth round-trip
  // independently of the inner redirect URL - do NOT move them inside the
  // redirect value; url.searchParams.get() cannot see nested params.
  let agentRef = url.searchParams.get('agentRef') ?? undefined;
  let subAgentRef = url.searchParams.get('subAgentRef') ?? undefined;
  // The URL param is a single opaque string - it may be a username, a referral
  // code OR a storefront slug - so it is fed into BOTH namespace slots, which
  // reproduces the historical "code first, slug second" resolution exactly.
  let refCode = agentRef;
  // QR referral lock: the signed httpOnly cookie set by the middleware is the
  // AUTHORITATIVE attribution. When a valid lock exists it overrides the
  // URL-threaded params — the client cannot change who gets signup credit.
  //
  // The lock carries the two values SEPARATELY and they must stay separate:
  //   refLock.c -> the referral code (profiles.username / referral_code)
  //   refLock.s -> the storefront slug (agent_profiles.slug)
  // Passing the slug through the code slot credits whichever agent happens to
  // own that string as a username, which is a real collision in live data.
  const cookieStore = await cookies();
  const refLock = await verifyRefLock(cookieStore.get(REF_LOCK_COOKIE)?.value);
  if (refLock) {
    agentRef = refLock.s ?? undefined;
    refCode = refLock.c;
    subAgentRef = refLock.sa ?? undefined;
  }
  // Prevent Open Redirect: same-origin relative paths only; also strips embedded
  // control characters that browsers collapse into scheme-relative navigation.
  const redirectTo = safeRelativePath(url.searchParams.get('redirect'));

  const loginUrl = new URL('/login', url.origin);

  if (!code) {
    loginUrl.searchParams.set('error', 'oauth_failed');
    return NextResponse.redirect(loginUrl);
  }

  let exchangeData;
  let supabase;

  try {
    supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data?.session || !data?.user) {
      console.error('[auth/callback] Code exchange failed:', error);
      loginUrl.searchParams.set('error', 'oauth_failed');
      return NextResponse.redirect(loginUrl);
    }

    exchangeData = data;
  } catch (err) {
    console.error('[auth/callback] Unexpected error during code exchange:', err);
    loginUrl.searchParams.set('error', 'oauth_failed');
    return NextResponse.redirect(loginUrl);
  }

  const user = exchangeData.user;
  // Set once profile creation/attribution succeeds — the QR lock cookies are
  // then cleared on the success redirect (their job is done).
  let clearRefLockCookies = false;

  try {
    const admin = createAdminClient();

    const ensured = await ensureOAuthResearcherProfile(admin, user, agentRef, subAgentRef, refCode);

    if (ensured.emailConflict) {
      // The Google email already belongs to another account. Block this second
      // account: remove the just-created OAuth user, end the session, and send
      // the person to log in with their existing account.
      try { await admin.auth.admin.deleteUser(user.id); } catch { /* best effort */ }
      await supabase.auth.signOut();
      loginUrl.searchParams.set('error', 'account_exists');
      return NextResponse.redirect(loginUrl);
    }

    if (ensured.linkToUserId) {
      // The Google email belongs to an existing, verified researcher account.
      // Log the person into THAT account (mint its session on this response)
      // and delete this duplicate OAuth user. ANY failure falls back to the
      // safe duplicate block so a user is never stranded or mis-linked.
      try {
        const { data: existingAuth } = await admin.auth.admin.getUserById(ensured.linkToUserId);
        const existingEmail = existingAuth?.user?.email;
        if (!existingEmail) throw new Error('existing account has no auth email');
        const { data: linkGen, error: genErr } = await admin.auth.admin.generateLink({
          type: 'magiclink',
          email: existingEmail,
        });
        const tokenHash = linkGen?.properties?.hashed_token;
        if (genErr || !tokenHash) throw new Error(genErr?.message || 'link_generation_failed');
        const { error: verifyErr } = await supabase.auth.verifyOtp({
          type: 'magiclink',
          token_hash: tokenHash,
        });
        if (verifyErr) throw new Error(verifyErr.message);
        // The session now belongs to the existing account; drop the duplicate
        // OAuth user (cascades its email-null placeholder profile).
        try { await admin.auth.admin.deleteUser(user.id); } catch { /* best effort */ }
        return NextResponse.redirect(new URL(redirectTo, url.origin));
      } catch (linkErr) {
        console.error('[auth/callback] account link failed; blocking as duplicate:', linkErr);
        try { await admin.auth.admin.deleteUser(user.id); } catch { /* best effort */ }
        await supabase.auth.signOut();
        loginUrl.searchParams.set('error', 'account_exists');
        return NextResponse.redirect(loginUrl);
      }
    }

    if (ensured.disabled) {
      await supabase.auth.signOut();
      loginUrl.searchParams.set('error', 'account_disabled');
      return NextResponse.redirect(loginUrl);
    }

    if (!ensured.ok) {
      // Session Is Still Valid - Log Loudly For Follow-Up, Never Strand The User.
      console.error('[auth/callback] ensureOAuthResearcherProfile failed:', ensured.error);
    } else if (refLock) {
      // Attribution settled on this account under the locked referrer.
      clearRefLockCookies = true;
    }

    // Notify the agent that a new researcher signed up under their storefront.
    // IMPORTANT: this must NOT be gated on ensured.created alone - for a real
    // Google signup the profile row is created by the handle_new_user DB
    // trigger BEFORE this callback runs, so ensureOAuthResearcherProfile takes
    // the existing-profile path and `created` stays false (it is only true in
    // the rare self-heal case; that gate silently suppressed EVERY real signup
    // notification). Treat any account whose profile row is under 15 minutes
    // old as a fresh signup, and dedup via the notifications table so a quick
    // sign-out/sign-in never double-pings the agent. Best-effort: never blocks
    // the sign-in.
    try {
      const { data: newProfile } = await admin
        .from('profiles')
        .select('referring_agent_id, full_name, username, created_at')
        .eq('id', user.id)
        .maybeSingle();
      const createdAtMs = newProfile?.created_at ? Date.parse(String(newProfile.created_at)) : NaN;
      const isFreshAccount =
        ensured.created ||
        (Number.isFinite(createdAtMs) && Date.now() - createdAtMs < 15 * 60 * 1000);
      if (
        isFreshAccount &&
        newProfile?.referring_agent_id &&
        newProfile.referring_agent_id !== user.id
      ) {
        const researcherName = newProfile.full_name || newProfile.username || 'A New Researcher';
        const { data: already } = await admin
          .from('notifications')
          .select('id')
          .eq('user_id', newProfile.referring_agent_id)
          .eq('type', 'new_researcher')
          .eq('title', `New Researcher: ${researcherName}`)
          .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();
        if (!already) {
          await notifyNewResearcher(admin, newProfile.referring_agent_id, researcherName);
        }
      }
    } catch (e) {
      console.error('[auth/callback] new-researcher notify failed (non-fatal):', e);
    }

    // Persist The Registration Acknowledgment Collected On /signup Before The
    // Google Redirect (Mandatory 4-Layer Disclaimer Audit Trail, Layer 2).
    if (ack === 'registration') {
      await logOAuthRegistrationAck(
        admin,
        user.id,
        getClientIp(req),
        req.headers.get('user-agent'),
      );
    }
  } catch (err) {
    // Non-Fatal: The Session Is Valid Even If Linking Fails; Log For Follow-Up.
    console.error('[auth/callback] Post-login profile linking error:', err);
  }

  const successRes = NextResponse.redirect(new URL(redirectTo, url.origin));
  if (clearRefLockCookies) {
    successRes.cookies.set(REF_LOCK_COOKIE, '', { maxAge: 0, path: '/' });
    successRes.cookies.set(REF_DISPLAY_COOKIE, '', { maxAge: 0, path: '/' });
  }
  return successRes;
}
