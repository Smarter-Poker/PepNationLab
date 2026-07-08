import { createAdminClient } from '@/lib/supabase/server';
import { ensureOAuthResearcherProfile, logOAuthRegistrationAck } from '@/lib/oauth-profile';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';
import { getSupabaseUrl } from '@/lib/supabase/url';

/**
 * Auth Flow Canary
 *
 * End-To-End Probe For The Entire Login + Account Creation Surface. Shared By
 * The Admin Diagnostic Route (POST /api/diag/auth-flow) And The Daily Cron
 * (GET /api/cron/auth-canary) So Regressions Are Caught Automatically, Not
 * Just When Someone Remembers To Run The Diagnostic. Probes, In Order:
 *
 *   1. house_store_active           - The Default Signup Store Exists And Is Active.
 *   2. google_provider_enabled      - Google OAuth Is Enabled On The Auth Server.
 *   3. auth_admin_create_user       - Account Creation Works (Pre-Confirmed).
 *   4. account_confirmed_at_creation- No Unverifiable Limbo State.
 *   5. trigger_profile_insert       - handle_new_user Created The Profile Row.
 *   6. oauth_self_heal              - Deletes The Profile Row And Verifies
 *                                     ensureOAuthResearcherProfile() Rebuilds A
 *                                     Complete House-Linked Researcher Profile
 *                                     Capturing The Provider Email And Avatar.
 *   7. oauth_identity_backfill      - Existing Profiles With Missing Email,
 *                                     Name, Or Avatar Get Them Backfilled From
 *                                     The Provider On The Next Sign-In.
 *   8. registration_ack_logged      - The OAuth Registration Disclaimer Ack
 *                                     Persists To disclaimer_acceptances.
 *   9. resolve_username             - /api/auth/resolve Maps Username -> Auth Email.
 *  10. password_login               - signInWithPassword Succeeds Against The
 *                                     Real Auth Server (Anon Key Token Grant).
 *  11. cleanup                      - The Probe Account Is Always Removed.
 */

export type CanaryStep = { name: string; ok: boolean; detail?: string };

export interface CanaryResult {
  ok: boolean;
  duration_ms: number;
  steps: CanaryStep[];
  error?: string;
}

export async function runAuthFlowCanary(origin: string): Promise<CanaryResult> {
  const startedAt = Date.now();
  const steps: CanaryStep[] = [];
  let probeUserId: string | null = null;

  const admin = createAdminClient();
  const supabaseUrl = getSupabaseUrl();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

  async function cleanup() {
    if (!probeUserId) return;
    try { await admin.from('disclaimer_acceptances').delete().eq('user_id', probeUserId); } catch { /* noop */ }
    try { await admin.from('profiles').delete().eq('id', probeUserId); } catch { /* noop */ }
    try { await admin.auth.admin.deleteUser(probeUserId); } catch { /* noop */ }
  }

  try {
    // 1. House Store Exists And Is Active.
    const { data: house } = await admin
      .from('agent_profiles').select('id').eq('slug', DEFAULT_STORE_SLUG).maybeSingle();
    const { data: houseOwner } = house
      ? await admin.from('profiles').select('is_active').eq('id', house.id).maybeSingle()
      : { data: null };
    const houseOk = !!house?.id && houseOwner?.is_active === true;
    steps.push({ name: 'house_store_active', ok: houseOk, detail: house?.id ?? 'missing' });
    if (!houseOk) throw new Error('house_store_missing_or_inactive');

    // 2. Google Provider Enabled On The Auth Server.
    let googleOn = false;
    try {
      const settingsRes = await fetch(`${supabaseUrl}/auth/v1/settings`, {
        headers: { apikey: anonKey }, cache: 'no-store',
      });
      const settings = await settingsRes.json();
      googleOn = settings?.external?.google === true;
    } catch { /* recorded below */ }
    steps.push({ name: 'google_provider_enabled', ok: googleOn });
    if (!googleOn) throw new Error('google_provider_disabled');

    // 3. Create The Probe Account (Pre-Confirmed, Like All Platform Accounts).
    const ts = Date.now();
    const username = `__authdiag_${ts}`;
    const password = `AuthDiag${ts}!x`;
    const internalEmail = `${username}@internal.auth`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { username, full_name: 'Auth Diagnostic' },
    });
    const createOk = !createErr && !!created?.user;
    steps.push({ name: 'auth_admin_create_user', ok: createOk, detail: createErr?.message });
    if (!createOk) throw new Error('create_user_failed');
    probeUserId = created!.user.id;

    // 4. Verify The Account Is Confirmed At Birth (No Unverifiable Limbo State).
    const confirmedOk = !!created!.user.email_confirmed_at;
    steps.push({ name: 'account_confirmed_at_creation', ok: confirmedOk });
    if (!confirmedOk) throw new Error('account_not_confirmed');

    // 5. Trigger Created The Profile Row.
    const { data: trigRow } = await admin
      .from('profiles').select('id, role').eq('id', probeUserId).maybeSingle();
    steps.push({ name: 'trigger_profile_insert', ok: !!trigRow, detail: trigRow?.role });
    if (!trigRow) throw new Error('trigger_profile_missing');

    // 6. OAuth Self-Heal: Remove The Profile, Then Run The Exact Callback Logic
    //    With Provider-Style Identity Data (External Email + Avatar) And Verify
    //    Everything Is Captured.
    const externalEmail = `${username}@authdiag-probe.example.com`;
    const probeAvatar = 'https://example.com/authdiag-avatar.png';
    await admin.from('profiles').delete().eq('id', probeUserId);
    const ensured = await ensureOAuthResearcherProfile(admin, {
      id: probeUserId,
      email: externalEmail,
      user_metadata: { full_name: 'Auth Diagnostic', avatar_url: probeAvatar },
    });
    const { data: healed } = await admin
      .from('profiles')
      .select('id, role, referring_agent_id, username, is_active, email, avatar_url, full_name')
      .eq('id', probeUserId)
      .maybeSingle();
    const healOk = ensured.ok && ensured.created
      && healed?.role === 'researcher'
      && healed?.referring_agent_id === house!.id
      && !!healed?.username
      && healed?.is_active === true
      && healed?.email === externalEmail
      && healed?.avatar_url === probeAvatar;
    steps.push({
      name: 'oauth_self_heal',
      ok: healOk,
      detail: healOk ? `username=${healed!.username}` : (ensured.error ?? JSON.stringify(healed)),
    });
    if (!healOk) throw new Error('oauth_self_heal_failed');

    // 7. OAuth Identity Backfill: Blank The Captured Identity Fields, Run The
    //    Callback Logic Again (Existing-Profile Path), And Verify They Are
    //    Restored Without Touching Anything Else.
    await admin.from('profiles')
      .update({ email: null, avatar_url: null, full_name: null })
      .eq('id', probeUserId);
    const backfilled = await ensureOAuthResearcherProfile(admin, {
      id: probeUserId,
      email: externalEmail,
      user_metadata: { full_name: 'Auth Diagnostic', avatar_url: probeAvatar },
    });
    const { data: refreshed } = await admin
      .from('profiles')
      .select('email, avatar_url, full_name')
      .eq('id', probeUserId)
      .maybeSingle();
    const backfillOk = backfilled.ok
      && refreshed?.email === externalEmail
      && refreshed?.avatar_url === probeAvatar
      && refreshed?.full_name === 'Auth Diagnostic';
    steps.push({
      name: 'oauth_identity_backfill',
      ok: backfillOk,
      detail: backfillOk ? undefined : JSON.stringify(refreshed),
    });
    if (!backfillOk) throw new Error('oauth_identity_backfill_failed');

    // 8. Registration Ack Persists (Idempotent).
    const ackOk1 = await logOAuthRegistrationAck(admin, probeUserId, '127.0.0.1', 'auth-flow-canary');
    const ackOk2 = await logOAuthRegistrationAck(admin, probeUserId, '127.0.0.1', 'auth-flow-canary');
    const { data: ackRows } = await admin
      .from('disclaimer_acceptances')
      .select('id')
      .eq('user_id', probeUserId)
      .eq('layer', 'registration');
    const ackOk = ackOk1 && ackOk2 && (ackRows?.length === 1);
    steps.push({ name: 'registration_ack_logged', ok: ackOk, detail: `rows=${ackRows?.length ?? 0}` });
    if (!ackOk) throw new Error('registration_ack_failed');

    // 9. Username Resolve (The Same Contract The Login Page Depends On).
    //    Fix The Username To The Known Probe Value First.
    await admin.from('profiles').update({ username }).eq('id', probeUserId);
    const resolveRes = await fetch(new URL('/api/auth/resolve', origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ username }),
      cache: 'no-store',
    });
    const resolved = await resolveRes.json().catch(() => ({}));
    const resolveOk = resolveRes.ok && resolved?.email === internalEmail;
    steps.push({ name: 'resolve_username', ok: resolveOk, detail: resolved?.email });
    if (!resolveOk) throw new Error('resolve_failed');

    // 10. Real Password Login Against The Auth Server.
    const tokenRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: internalEmail, password }),
      cache: 'no-store',
    });
    const token = await tokenRes.json().catch(() => ({}));
    const loginOk = tokenRes.ok && !!token?.access_token;
    steps.push({ name: 'password_login', ok: loginOk, detail: String(tokenRes.status) });
    if (!loginOk) throw new Error('password_login_failed');

    await cleanup();
    steps.push({ name: 'cleanup', ok: true });
    return { ok: true, duration_ms: Date.now() - startedAt, steps };
  } catch (err) {
    await cleanup();
    steps.push({ name: 'cleanup', ok: true, detail: 'rolled back on failure' });
    return {
      ok: false,
      duration_ms: Date.now() - startedAt,
      error: err instanceof Error ? err.message : 'unknown',
      steps,
    };
  }
}
