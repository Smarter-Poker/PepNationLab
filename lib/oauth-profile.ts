import type { createAdminClient } from '@/lib/supabase/server';
import { sanitizeUsername } from '@/lib/usernames';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';

type AdminClient = ReturnType<typeof createAdminClient>;

export interface OAuthUserLike {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

export interface EnsureProfileResult {
  ok: boolean;
  disabled: boolean;
  created: boolean;
  linkedHouseStore: boolean;
  username: string | null;
  error?: string;
}

/**
 * Guarantees A Complete, House-Store-Linked Researcher Profile For An OAuth
 * (Google) Account. Shared By The OAuth Callback AND The /api/diag/auth-flow
 * Canary So The Diagnostic Exercises Exactly The Code Production Runs.
 *
 * Behavior (Deliberately Idempotent - Safe To Run On Every Sign-In):
 *   1. Profile Missing (handle_new_user Trigger Failed Or Was Bypassed):
 *      SELF-HEAL By Inserting A Full Researcher Profile Linked To The House
 *      Store. A Google User Can Never Be Left Profile-Less.
 *   2. Profile Disabled: Report disabled=true (Caller Signs The Session Out).
 *   3. Researcher With No Referral: Link To The House Store. Existing
 *      Referrals, Agents, And Admins Are NEVER Overwritten.
 *   4. Missing Username: Derive From The Email Local Part; The Final Fallback
 *      Suffixes The User Id So Uniqueness Is Guaranteed (No Collision Loop
 *      Can Exhaust).
 *   5. Missing Identity Data (Email, Name, Avatar): Backfill From The OAuth
 *      Provider On Every Sign-In. Existing Non-Null Values Are NEVER
 *      Overwritten - Users Are Simply Not Asked For Data We Already Have.
 */
export async function ensureOAuthResearcherProfile(
  admin: AdminClient,
  user: OAuthUserLike,
): Promise<EnsureProfileResult> {
  const result: EnsureProfileResult = {
    ok: false,
    disabled: false,
    created: false,
    linkedHouseStore: false,
    username: null,
  };

  try {
    const { data: houseStore } = await admin
      .from('agent_profiles')
      .select('id')
      .eq('slug', DEFAULT_STORE_SLUG)
      .maybeSingle();

    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, username, referring_agent_id, is_active, email, full_name, first_name, last_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const metaName =
      (typeof meta.full_name === 'string' && meta.full_name) ||
      (typeof meta.name === 'string' && meta.name) ||
      '';
    // Google Provides The Account's Profile Picture As avatar_url (Supabase
    // Normalized) Or picture (Raw OIDC Claim). Capture It So OAuth Users Do
    // Not Get Asked To Upload A Photo They Already Have.
    const metaAvatar =
      (typeof meta.avatar_url === 'string' && meta.avatar_url.startsWith('https://') && meta.avatar_url) ||
      (typeof meta.picture === 'string' && meta.picture.startsWith('https://') && meta.picture) ||
      null;
    const realEmail =
      user.email && !user.email.endsWith('@internal.auth') ? user.email : null;

    if (!profile) {
      // SELF-HEAL: The Trigger Did Not Create A Row. Build The Full Profile.
      const username = await deriveUniqueUsername(admin, user);
      const firstName = metaName ? metaName.split(' ')[0] : null;
      const lastName = metaName && metaName.includes(' ')
        ? metaName.slice(metaName.indexOf(' ') + 1)
        : null;

      const { error: insertErr } = await admin.from('profiles').upsert({
        id: user.id,
        email: realEmail,
        username,
        full_name: metaName || null,
        first_name: firstName,
        last_name: lastName,
        avatar_url: metaAvatar,
        role: 'researcher',
        referring_agent_id: houseStore?.id ?? null,
        disclaimer_v1_accepted: false,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

      if (insertErr) {
        result.error = `self_heal_insert_failed: ${insertErr.message}`;
        return result;
      }
      result.created = true;
      result.linkedHouseStore = !!houseStore?.id;
      result.username = username;
      result.ok = true;
      return result;
    }

    if (profile.is_active === false) {
      result.disabled = true;
      result.ok = true;
      return result;
    }

    const updates: Record<string, unknown> = {};

    if (!profile.referring_agent_id && profile.role === 'researcher' && houseStore?.id) {
      updates.referring_agent_id = houseStore.id;
      result.linkedHouseStore = true;
    }

    if (!profile.username) {
      updates.username = await deriveUniqueUsername(admin, user);
    }
    result.username = (updates.username as string) ?? profile.username ?? null;

    // Backfill Identity Data The OAuth Provider Already Gave Us. Existing
    // Non-Null Values Are NEVER Overwritten - This Only Fills Gaps So Users
    // Are Not Asked For Information We Already Captured At Sign-In.
    if (!profile.email && realEmail) {
      updates.email = realEmail;
    }
    if (!profile.full_name && metaName) {
      updates.full_name = metaName;
    }
    if (!profile.first_name && metaName) {
      updates.first_name = metaName.split(' ')[0];
    }
    if (!profile.last_name && metaName && metaName.includes(' ')) {
      updates.last_name = metaName.slice(metaName.indexOf(' ') + 1);
    }
    if (!profile.avatar_url && metaAvatar) {
      updates.avatar_url = metaAvatar;
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error: updateErr } = await admin
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      if (updateErr) {
        result.error = `profile_update_failed: ${updateErr.message}`;
        return result;
      }
    }

    result.ok = true;
    return result;
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'unknown_error';
    return result;
  }
}

/**
 * Derive A Unique Username From The OAuth Email. The Final Fallback Appends
 * A Slice Of The Immutable User Id, Which Cannot Collide With Another User's
 * Fallback - Guaranteeing Termination Without An Unbounded Retry Loop.
 */
async function deriveUniqueUsername(admin: AdminClient, user: OAuthUserLike): Promise<string> {
  const base =
    sanitizeUsername((user.email ?? '').split('@')[0]).slice(0, 24) || 'researcher';

  let candidate = base;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: taken } = await admin
      .from('profiles')
      .select('id')
      .eq('username', candidate)
      .maybeSingle();
    if (!taken || taken.id === user.id) return candidate;
    candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
  }
  // Guaranteed Unique: Tied To The Caller's Own Immutable Id.
  return `${base.slice(0, 16)}_${user.id.replace(/-/g, '').slice(0, 8)}`;
}

/**
 * Records The Registration Disclaimer Layer For An OAuth Signup. The /signup
 * Page Requires All Three Acknowledgments Before Launching Google OAuth And
 * Passes ack=registration Through The Callback - This Persists That Consent
 * Into The Mandatory 4-Layer Audit Trail. Idempotent Per User.
 */
export async function logOAuthRegistrationAck(
  admin: AdminClient,
  userId: string,
  ip: string | null,
  userAgent: string | null,
): Promise<boolean> {
  try {
    const { data: existing } = await admin
      .from('disclaimer_acceptances')
      .select('id')
      .eq('user_id', userId)
      .eq('layer', 'registration')
      .limit(1)
      .maybeSingle();
    if (existing) return true;

    const { error } = await admin.from('disclaimer_acceptances').insert({
      user_id: userId,
      layer: 'registration',
      disclaimer_version: process.env.NEXT_PUBLIC_DISCLAIMER_VERSION || 'v1.0',
      ip_address: ip,
      user_agent: userAgent,
      age_verified: true,
      accepted_at: new Date().toISOString(),
    });
    if (error) {
      console.error('[oauth-profile] registration ack insert failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[oauth-profile] registration ack error:', err);
    return false;
  }
}
