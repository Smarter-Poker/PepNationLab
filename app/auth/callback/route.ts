export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ensureOAuthResearcherProfile, logOAuthRegistrationAck } from '@/lib/oauth-profile';
import { notifyNewResearcher } from '@/lib/notify';
import { getClientIp } from '@/lib/rate-limit';
import { safeRelativePath } from '@/lib/safe-redirect';

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
  const agentRef = url.searchParams.get('agentRef') ?? undefined;
  const subAgentRef = url.searchParams.get('subAgentRef') ?? undefined;
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

  try {
    const admin = createAdminClient();

    const ensured = await ensureOAuthResearcherProfile(admin, user, agentRef, subAgentRef);

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
    }

    // Notify the agent that a new researcher signed up under their storefront.
    // The regular signup + agent-created paths already do this via
    // notifyNewResearcher; the Google OAuth path previously notified no one, so
    // agents/super-agents never heard about self-serve Google signups. Fires
    // only for a brand-new account (ensured.created) and reads the FINAL
    // referring_agent_id (after ensureOAuthResearcherProfile's house-link +
    // fresh-referral upgrade). Best-effort: never blocks the sign-in.
    if (ensured.created) {
      try {
        const { data: newProfile } = await admin
          .from('profiles')
          .select('referring_agent_id, full_name')
          .eq('id', user.id)
          .maybeSingle();
        if (newProfile?.referring_agent_id && newProfile.referring_agent_id !== user.id) {
          await notifyNewResearcher(
            admin,
            newProfile.referring_agent_id,
            newProfile.full_name || 'A New Researcher',
          );
        }
      } catch (e) {
        console.error('[auth/callback] new-researcher notify failed (non-fatal):', e);
      }
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

  return NextResponse.redirect(new URL(redirectTo, url.origin));
}
