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
  /**
   * True When This Is A BRAND-NEW OAuth Account Whose Google Email Already
   * Belongs To Another Profile (The enforce_unique_account_email Trigger
   * Would Reject The Row). The Caller Deletes The Just-Created Auth User And
   * Sends The Person To Log In With Their Existing Account. NEVER Set For An
   * Existing Profile - Established Accounts Must Not Be Deleted.
   */
  emailConflict: boolean;
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
 *   6. agentSlug (From The /signup Referral Step Or A QR Scan, Forwarded As
 *      The Top-Level agentRef Callback Param): Resolves To That Agent When
 *      The Slug Exists AND The Agent's Account Is Active; Otherwise Falls
 *      Back To The House Store. Signup Is Never Blocked By A Bad Slug.
 *      CRITICAL: The trg_00_ensure_researcher_house_agent DB Trigger House-
 *      Links Every New Researcher Row The Moment handle_new_user Creates It,
 *      So By The Time The OAuth Callback Runs The Profile Is ALREADY House-
 *      Linked. A House Link On A Profile Created Within The Last 15 Minutes
 *      Is Therefore Treated As The Trigger Default And Upgraded To The Named
 *      Agent Via The Sanctioned oauth_link_fresh_referral RPC, While Any
 *      Older Referral - House Or Named - Is NEVER Changed.
 *   7. subAgentId (QR ?sa= Capture, Forwarded As subAgentRef): Credited Only
 *      When It Is A Real Sub-Agent Of The Resolved Referring Agent, Matching
 *      POST /api/storefront/register Exactly.
 */

/**
 * How Long After Profile Creation A House-Store Referral Still Counts As The
 * DB Trigger's Placeholder (Upgradeable By agentRef) Rather Than A Settled
 * Attribution. Generous Enough For The Google Round-Trip, Short Enough That
 * Established House Researchers Can Never Be Poached Via A Stale ?ref= Link.
 * The Same Window Is Enforced Inside The oauth_link_fresh_referral RPC.
 */
const FRESH_SIGNUP_WINDOW_MS = 15 * 60 * 1000;

export async function ensureOAuthResearcherProfile(
  admin: AdminClient,
  user: OAuthUserLike,
  agentSlug?: string,
  subAgentId?: string,
): Promise<EnsureProfileResult> {
  const result: EnsureProfileResult = {
    ok: false,
    disabled: false,
    created: false,
    linkedHouseStore: false,
    username: null,
    emailConflict: false,
  };

  try {
    const { data: houseStore } = await admin
      .from('agent_profiles')
      .select('id')
      .eq('slug', DEFAULT_STORE_SLUG)
      .maybeSingle();

    // If the user provided a referral agent slug (from QR code or manual entry),
    // look up that agent. Fall back to house store if not found, invalid, or
    // INACTIVE - the same gate POST /api/storefront/register applies, so a
    // deactivated storefront can never keep collecting new researchers through
    // a stale QR code or share link.
    let namedAgentId: string | null = null;
    if (agentSlug && /^[a-z0-9_-]{2,80}$/i.test(agentSlug)) {
      const { data: namedAgent } = await admin
        .from('agent_profiles')
        .select('id')
        .eq('slug', agentSlug.toLowerCase())
        .maybeSingle();
      if (namedAgent?.id) {
        // Activity gate mirrors /api/storefront/register: the agent's ACCOUNT
        // row (profiles.is_active) controls whether they accept new signups.
        const { data: agentAccount } = await admin
          .from('profiles')
          .select('id, is_active')
          .eq('id', namedAgent.id)
          .maybeSingle();
        if (agentAccount?.is_active === true) {
          namedAgentId = namedAgent.id;
        }
      }
    }
    const referringAgentId: string | null = namedAgentId ?? houseStore?.id ?? null;

    // Optional sub-agent attribution (QR ?sa= capture, forwarded through the
    // OAuth round-trip as subAgentRef). Only honored when the id is a real
    // sub-agent whose parent is the resolved referring agent - the exact
    // validation POST /api/storefront/register performs - so a forged or
    // stale id can never misattribute a signup.
    let referringSubAgentId: string | null = null;
    if (
      subAgentId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subAgentId) &&
      referringAgentId
    ) {
      const { data: subAgent } = await admin
        .from('profiles')
        .select('id, is_sub_agent, parent_agent_id')
        .eq('id', subAgentId)
        .maybeSingle();
      if (subAgent && subAgent.is_sub_agent && subAgent.parent_agent_id === referringAgentId) {
        referringSubAgentId = subAgentId;
      }
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, username, referring_agent_id, referring_sub_agent_id, is_active, email, full_name, first_name, last_name, avatar_url, created_at')
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

    // Duplicate-Email Probe: mirrors the enforce_unique_account_email DB
    // trigger (effective email = contact_email || email, case-insensitive).
    // Only queried when we would actually WRITE the email (new profile or
    // email backfill) so routine sign-ins cost nothing extra.
    let emailOwnedElsewhere = false;
    if (realEmail && (!profile || !profile.email)) {
      const pat = realEmail.replace(/([%_\\])/g, '\\$1');
      const { data: emailOwner } = await admin
        .from('profiles')
        .select('id')
        .or(`email.ilike.${pat},contact_email.ilike.${pat}`)
        .neq('id', user.id)
        .limit(1)
        .maybeSingle();
      emailOwnedElsewhere = !!emailOwner;
    }

    if (!profile) {
      if (emailOwnedElsewhere) {
        // Brand-New OAuth Account, But The Google Email Already Belongs To An
        // Existing Account. Report It - The Callback Deletes The Just-Created
        // Auth User And Redirects To Login (error=account_exists).
        result.emailConflict = true;
        result.ok = true;
        return result;
      }
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
        referring_agent_id: referringAgentId,
        referring_sub_agent_id: referringSubAgentId,
        disclaimer_v1_accepted: false,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

      if (insertErr) {
        // Fallback: the unique-email trigger rejected the row in the race
        // window between the probe above and this insert.
        if (insertErr.code === '23505' && /email/i.test(insertErr.message ?? '')) {
          result.emailConflict = true;
          result.ok = true;
          return result;
        }
        result.error = `self_heal_insert_failed: ${insertErr.message}`;
        return result;
      }
      result.created = true;
      result.linkedHouseStore = referringAgentId === (houseStore?.id ?? null);
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

    // Referral assignment. Two cases may set it:
    //   (a) No referral at all (defensive - trg_00_ensure_researcher_house_agent
    //       normally house-links every researcher row at insert).
    //   (b) FRESH-SIGNUP UPGRADE: the row was created moments ago by
    //       handle_new_user and immediately house-linked by the DB trigger.
    //       Without this branch the agentRef captured on /signup could NEVER
    //       take effect for Google signups - the house link would already
    //       exist and the never-overwrite guard would block it. A house link
    //       older than FRESH_SIGNUP_WINDOW_MS is settled attribution and is
    //       never touched; a NAMED agent referral is never touched at any age.
    const houseId = houseStore?.id ?? null;
    const createdAtMs = profile.created_at ? Date.parse(String(profile.created_at)) : NaN;
    const isFreshSignup =
      Number.isFinite(createdAtMs) && Date.now() - createdAtMs < FRESH_SIGNUP_WINDOW_MS;
    const trustsTriggerHouseLink =
      profile.referring_agent_id === houseId && isFreshSignup;

    if (!profile.referring_agent_id && referringAgentId) {
      updates.referring_agent_id = referringAgentId;
      // Sub-agent attribution travels WITH the referral: it is only ever set
      // on the same write that establishes referring_agent_id, so an existing
      // account's attribution can never be reassigned afterward.
      if (referringSubAgentId && !profile.referring_sub_agent_id) {
        updates.referring_sub_agent_id = referringSubAgentId;
      }
      result.linkedHouseStore = referringAgentId === houseId;
    } else if (trustsTriggerHouseLink && namedAgentId && namedAgentId !== houseId) {
      // The enforce_researcher_agent_binding DB guard forbids changing a
      // non-null referral through a plain UPDATE. oauth_link_fresh_referral
      // is the sanctioned, service-role-only RPC: it re-checks the fresh-
      // signup window AND the house-placeholder state inside the database,
      // so no app bug can ever widen this into referral poaching.
      const { data: upgraded, error: rpcErr } = await admin.rpc('oauth_link_fresh_referral', {
        p_user_id: user.id,
        p_agent_id: namedAgentId,
        p_sub_agent_id: referringSubAgentId,
      });
      if (rpcErr) {
        // Non-fatal: the account stays house-linked; never block a signup.
        console.error('[oauth-profile] fresh referral upgrade failed:', rpcErr.message);
      }
      result.linkedHouseStore = upgraded !== true;
    }

    if (!profile.username) {
      updates.username = await deriveUniqueUsername(admin, user);
    }
    result.username = (updates.username as string) ?? profile.username ?? null;

    // Backfill Identity Data The OAuth Provider Already Gave Us. Existing
    // Non-Null Values Are NEVER Overwritten - This Only Fills Gaps So Users
    // Are Not Asked For Information We Already Captured At Sign-In.
    // Skip The Email Backfill When Another Account Owns This Address - The
    // Unique-Email Trigger Would Reject The Whole Update (And An EXISTING
    // Account Must Never Be Flagged emailConflict, Which Deletes The User).
    if (!profile.email && realEmail && !emailOwnedElsewhere) {
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
