export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sanitizeUsername } from '@/lib/usernames';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';

/**
 * GET /auth/callback
 *
 * OAuth Callback For Google Sign-In. Exchanges The Auth Code For A Session,
 * Then Guarantees The Profile Is Complete: Every New OAuth Account Is A
 * Researcher Linked To The House Storefront (Daniel Bekavac's Store) So All
 * Sales And Pricing Derive From That Store.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const rawRedirect = url.searchParams.get('redirect') ?? '/dashboard';
  // Prevent Open Redirect: Relative Paths Only.
  const redirectTo = /^\/(?!\/|\\)/.test(rawRedirect) ? rawRedirect : '/dashboard';

  const loginUrl = new URL('/login', url.origin);

  if (!code) {
    loginUrl.searchParams.set('error', 'oauth_failed');
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { data: exchangeData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !exchangeData?.user) {
    console.error('[auth/callback] Code exchange failed:', exchangeError);
    loginUrl.searchParams.set('error', 'oauth_failed');
    return NextResponse.redirect(loginUrl);
  }

  const user = exchangeData.user;

  try {
    const admin = createAdminClient();

    // Resolve The House Store.
    const { data: houseStore } = await admin
      .from('agent_profiles')
      .select('id')
      .eq('slug', DEFAULT_STORE_SLUG)
      .maybeSingle();

    // Load The Profile Created By The on_auth_user_created Trigger.
    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, username, referring_agent_id, is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      loginUrl.searchParams.set('error', 'account_disabled');
      return NextResponse.redirect(loginUrl);
    }

    const updates: Record<string, unknown> = {};

    // Link Brand-New OAuth Researchers To The House Store. Never Overwrite An
    // Existing Referral (Agents, Admins, And Storefront Researchers Keep Theirs).
    if (profile && !profile.referring_agent_id && profile.role === 'researcher' && houseStore?.id) {
      updates.referring_agent_id = houseStore.id;
    }

    // Derive A Username From The Google Email If The Profile Has None.
    if (profile && !profile.username && user.email) {
      const base = sanitizeUsername(user.email.split('@')[0]).slice(0, 24) || 'researcher';
      let candidate = base;
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: taken } = await admin
          .from('profiles')
          .select('id')
          .eq('username', candidate)
          .maybeSingle();
        if (!taken || taken.id === user.id) break;
        candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
      }
      updates.username = candidate;
    }

    if (profile && Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error: updateError } = await admin
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      if (updateError) {
        console.error('[auth/callback] Profile update failed:', updateError);
      }
    }
  } catch (err) {
    // Non-Fatal: The Session Is Valid Even If Linking Fails; Log For Follow-Up.
    console.error('[auth/callback] Post-login profile linking error:', err);
  }

  return NextResponse.redirect(new URL(redirectTo, url.origin));
}
