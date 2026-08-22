import type { createAdminClient } from '@/lib/supabase/server';
import { sanitizeUsername } from '@/lib/usernames';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';
import { STORE_SLUG_RE } from '@/lib/store-slug';
import { recordAttributionEvent } from '@/lib/attribution-log';

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
  /**
   * When set, this Google sign-in's email belongs to an existing ACTIVE,
   * email-verified researcher account (id given here). The callback logs the
   * person into THAT account and deletes this just-created OAuth user, so no
   * duplicate is ever persisted. Agent/admin, inactive, or unverified owners
   * fall back to emailConflict (block) instead of being auto-linked.
   */
  linkToUserId: string | null;
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
 *   6. Referral Resolution Uses TWO SEPARATE, NEVER-CROSSED NAMESPACES:
 *        refCode   -> profiles.username / profiles.referral_code
 *        agentSlug -> agent_profiles.slug
 *      refCode Wins When Both Are Supplied. A Storefront Slug Resolved In
 *      The Username Namespace Credits The WRONG Agent Whenever The Two
 *      Collide (Live Example: The Store `scooters` Is Owned By Username
 *      `adam`, While A DIFFERENT Agent Owns The Store `adam`), Which Is
 *      Exactly The Misattribution This Split Prevents. A Caller Holding
 *      Only One Value Passes It In BOTH Slots, Reproducing The Historical
 *      "Code First, Slug Second" Order Exactly. Either Path Requires The
 *      Agent's Account To Be Active And Not Deleted; Otherwise It Falls
 *      Back To The House Store. Signup Is Never Blocked By A Bad Ref.
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
 *   8. Every Attribution Outcome Is Written To referral_attribution_events So
 *      A Commission Dispute Can Be Reconstructed Months Later. Best-Effort:
 *      An Audit Failure Never Blocks A Sign-In.
 */

/**
 * How Long After Profile Creation A House-Store Referral Still Counts As The
 * DB Trigger's Placeholder (Upgradeable By agentRef) Rather Than A Settled
 * Attribution. Generous Enough For The Google Round-Trip, Short Enough That
 * Established House Researchers Can Never Be Poached Via A Stale ?ref= Link.
 * The Same Window Is Enforced Inside The oauth_link_fresh_referral RPC.
 */
const FRESH_SIGNUP_WINDOW_MS = 15 * 60 * 1000;

/**
 * Referral codes live in the profiles username / referral_code namespace,
 * which permits mixed case, digits, underscores and hyphens. Kept identical
 * to REF_CODE_RE in lib/ref-lock.ts so a code that survives the signed lock
 * can never be silently dropped here.
 */
const REF_CODE_RE = /^[A-Za-z0-9_-]{2,80}$/;

interface EmailOwner {
  id: string;
  role?: string | null;
  is_active?: boolean | null;
  email_verified?: boolean | null;
}

interface RefCandidate {
  id: string;
  role?: string | null;
  username?: string | null;
  referral_code?: string | null;
  is_active?: boolean | null;
  is_sub_agent?: boolean | null;
  parent_agent_id?: string | null;
}

export async function ensureOAuthResearcherProfile(
  admin: AdminClient,
  user: OAuthUserLike,
  agentSlug?: string,
  subAgentId?: string,
  refCode?: string,
): Promise<EnsureProfileResult> {
  const result: EnsureProfileResult = {
    ok: false,
    disabled: false,
    created: false,
    linkedHouseStore: false,
    username: null,
    emailConflict: false,
    linkToUserId: null,
  };

  try {
    const { data: houseStore } = await admin
      .from('agent_profiles')
      .select('id')
      .eq('slug', DEFAULT_STORE_SLUG)
      .maybeSingle();

    // Resolve the referring agent. Fall back to the house store if not found,
    // invalid, INACTIVE or deleted - the same gate POST /api/storefront/register
    // applies, so a deactivated storefront can never keep collecting new
    // researchers through a stale QR code or share link.
    //
    // TWO SEPARATE NAMESPACES, NEVER CROSSED:
    //   refCode   -> profiles.username / profiles.referral_code
    //   agentSlug -> agent_profiles.slug
    // Resolving a slug in the username namespace credits the wrong agent
    // whenever the two collide, so each value is only ever looked up in the
    // namespace it actually belongs to.
    let namedAgentId: string | null = null;
    let referringSubAgentId: string | null = null;

    // FIRST: explicit referral code (username / referral_code namespace).
    if (refCode && REF_CODE_RE.test(refCode)) {
      // Escape LIKE wildcards (_ and %) a raw username/code could contain so the
      // match stays literal -- mirrors the email-probe escaping used below.
      // encodeURIComponent does NOT neutralise these: without the escape,
      // ?ref=____l matches EVERY five-character code ending in `l`.
      const refEsc = refCode.replace(/([%_\\])/g, '\\$1');

      // DETERMINISM. This used to be .limit(1).maybeSingle() with no ORDER BY.
      // Postgres is free to return any row of a multi-row match in any order,
      // so when a code matched one profile's `username` and a DIFFERENT
      // profile's `referral_code`, which agent got paid varied between
      // identical requests. Fetch a small window with a stable order, then
      // prefer an EXACT match — a literal code always beats a case-fold or
      // cross-column coincidence.
      const { data: refRows } = await admin
        .from('profiles')
        .select('id, role, username, referral_code, is_active, is_sub_agent, parent_agent_id')
        .or(`username.ilike.${refEsc},referral_code.ilike.${refEsc}`)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('username', { ascending: true })
        .order('id', { ascending: true })
        .limit(5);

      const rows = (refRows ?? []) as unknown as RefCandidate[];
      const wanted = refCode.toLowerCase();
      const refMatch =
        rows.find((r) => (r.referral_code ?? '').toLowerCase() === wanted) ??
        rows.find((r) => (r.username ?? '').toLowerCase() === wanted) ??
        rows[0] ??
        null;

      if (refMatch) {
        // 'admin' is included deliberately: the platform owner's own code was
        // silently non-crediting, so their referrals fell through to the house
        // store with no error anywhere. Matches the storefront register route.
        if (
          refMatch.role === 'agent' ||
          refMatch.role === 'super_agent' ||
          refMatch.role === 'admin'
        ) {
          namedAgentId = refMatch.id;
        } else if (refMatch.is_sub_agent && refMatch.parent_agent_id) {
          namedAgentId = refMatch.parent_agent_id;
          referringSubAgentId = refMatch.id;
        }
      }
    }

    // SECOND: storefront slug (agent_profiles.slug namespace) when the code
    // namespace produced nothing.
    const normalizedSlug = (agentSlug ?? '').trim().toLowerCase();
    if (!namedAgentId && normalizedSlug && STORE_SLUG_RE.test(normalizedSlug)) {
      const { data: namedAgent } = await admin
        .from('agent_profiles')
        .select('id')
        .eq('slug', normalizedSlug)
        // A storefront can be deactivated independently of its owner's
        // account; without this gate a retired store kept harvesting signups.
        .eq('is_active', true)
        .maybeSingle();
      if (namedAgent?.id) {
        // Activity gate mirrors /api/storefront/register. deleted_at is checked
        // alongside is_active: a soft-deleted agent keeps is_active=true in some
        // rows, and crediting a deleted account is the same leak as crediting a
        // deactivated one.
        const { data: agentAccount } = await admin
          .from('profiles')
          .select('id, is_active, deleted_at')
          .eq('id', namedAgent.id)
          .maybeSingle();
        if (
          agentAccount?.is_active === true &&
          (agentAccount as { deleted_at?: string | null }).deleted_at == null
        ) {
          namedAgentId = namedAgent.id;
        }
      }
    }
    const referringAgentId: string | null = namedAgentId ?? houseStore?.id ?? null;

    // Optional sub-agent attribution (QR ?sa= capture, forwarded through the
    // OAuth round-trip as subAgentRef). Only honored when the id is a real
    // sub-agent whose parent is the resolved referring agent - the exact
    // same check as POST /api/storefront/register.
    if (subAgentId && namedAgentId) {
      const { data: subAgent } = await admin
        .from('profiles')
        .select('id, is_sub_agent, parent_agent_id, is_active, deleted_at')
        .eq('id', subAgentId)
        .maybeSingle();
      if (
        subAgent &&
        subAgent.is_sub_agent &&
        subAgent.parent_agent_id === namedAgentId &&
        subAgent.is_active === true &&
        (subAgent as { deleted_at?: string | null }).deleted_at == null
      ) {
        referringSubAgentId = subAgentId;
      }
    }

    /** Best-effort forensic record of what this call decided and why. */
    const audit = (
      event: string,
      agentId: string | null,
      extra?: Record<string, unknown>,
    ) =>
      recordAttributionEvent(admin, {
        event,
        channel: 'oauth_callback',
        source: 'oauth',
        user_id: user.id,
        agent_id: agentId,
        sub_agent_id: referringSubAgentId,
        ref_code: refCode ?? null,
        store_slug: normalizedSlug || null,
        lock_minted_at: null,
        detail: {
          resolved_named_agent: !!namedAgentId,
          house_fallback: !namedAgentId,
          ...(extra ?? {}),
        },
      });

    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, username, referring_agent_id, referring_sub_agent_id, deleted_at, is_active, email, full_name, first_name, last_name, avatar_url, created_at')
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
    let emailOwner: EmailOwner | null = null;
    if (realEmail && (!profile || !profile.email)) {
      const pat = realEmail.replace(/([%_\\])/g, '\\$1');
      const { data } = await admin
        .from('profiles')
        .select('id, role, is_active, email_verified')
        .or(`email.ilike.${pat},contact_email.ilike.${pat}`)
        .neq('id', user.id)
        .limit(1)
        .maybeSingle();
      emailOwner = (data as unknown as EmailOwner | null) ?? null;
    }
    const emailOwnedElsewhere = !!emailOwner;
    // A Google sign-in may be LINKED into the existing account only when that
    // account is an ACTIVE, EMAIL-VERIFIED researcher. Google already proved
    // the person controls this address; we still refuse to auto-link into an
    // agent/admin account or an unverified/inactive one - those fall back to
    // the emailConflict block below.
    const canLinkToExisting =
      !!emailOwner &&
      emailOwner.id !== user.id &&
      emailOwner.role === 'researcher' &&
      emailOwner.is_active === true &&
      emailOwner.email_verified === true;

    if (!profile) {
      if (emailOwnedElsewhere) {
        // The Google Email Already Belongs To An Existing Account.
        if (canLinkToExisting) {
          // Log The Person Into Their Existing Verified Researcher Account:
          // The Callback Mints That Account's Session And Deletes This User.
          result.linkToUserId = emailOwner!.id;
          result.ok = true;
          return result;
        }
        // Otherwise Block: The Callback Deletes The Just-Created Auth User And
        // Redirects To Login (error=account_exists).
        result.emailConflict = true;
        result.ok = true;
        return result;
      }
      // SELF-HEAL: The Trigger Did Not Create A Row. Build The Full Profile.
      let username = await deriveUniqueUsername(admin, user);
      const firstName = metaName ? metaName.split(' ')[0] : null;
      const lastName = metaName && metaName.includes(' ')
        ? metaName.slice(metaName.indexOf(' ') + 1)
        : null;

      const buildRow = (name: string) => ({
        id: user.id,
        email: realEmail,
        username: name,
        full_name: metaName || null,
        first_name: firstName,
        last_name: lastName,
        avatar_url: metaAvatar,
        role: 'researcher' as const,
        referring_agent_id: referringAgentId,
        referring_sub_agent_id: referringSubAgentId,
        disclaimer_v1_accepted: false,
        is_active: true,
        updated_at: new Date().toISOString(),
      });

      let { error: insertErr } = await admin
        .from('profiles')
        .upsert(buildRow(username), { onConflict: 'id' });

      // USERNAME RACE. deriveUniqueUsername probes then inserts, and two
      // Google sign-ins sharing an email local part ("dan@a.com" and
      // "dan@b.com") can both pass the probe before either writes. The loser
      // used to fail the whole self-heal and be left profile-less. Retry once
      // with the id-derived name, which cannot collide with anyone else's.
      if (insertErr && insertErr.code === '23505' && /username/i.test(insertErr.message ?? '')) {
        username = fallbackUsername(user);
        ({ error: insertErr } = await admin
          .from('profiles')
          .upsert(buildRow(username), { onConflict: 'id' }));
      }

      if (insertErr) {
        // Fallback: the unique-email guard rejected the row in the race window
        // between the probe above and this insert. It surfaces as 23505 from
        // the unique index and as P0001 from the enforce_unique_account_email
        // trigger's RAISE EXCEPTION - only the former was handled, so a
        // trigger-side rejection produced an opaque 500 instead of the
        // "account already exists, please log in" path.
        if (
          (insertErr.code === '23505' || insertErr.code === 'P0001') &&
          /email/i.test(insertErr.message ?? '')
        ) {
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
      await audit('oauth_profile_self_healed', referringAgentId, {
        self_heal: true,
        house_linked: result.linkedHouseStore,
      });
      return result;
    }

    if (profile.is_active === false || (profile as { deleted_at?: string | null }).deleted_at != null) {
      result.disabled = true;
      result.ok = true;
      return result;
    }

    // This brand-new OAuth row's Google email is owned by another verified
    // researcher account: link into that account rather than finishing setup
    // on this duplicate row (the callback mints the existing session and
    // deletes this OAuth user). Runs before any referral write so nothing is
    // mutated on a row we are about to discard.
    if (canLinkToExisting) {
      result.linkToUserId = emailOwner!.id;
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

    /** What this call actually changed, for the audit row. Null = no change. */
    let attributionEvent: string | null = null;
    let attributionAgent: string | null = null;
    let attributionDetail: Record<string, unknown> = {};

    if (!profile.referring_agent_id && referringAgentId) {
      updates.referring_agent_id = referringAgentId;
      // Sub-agent attribution travels WITH the referral: it is only ever set
      // on the same write that establishes referring_agent_id, so an existing
      // account's attribution can never be reassigned afterward.
      if (referringSubAgentId && !profile.referring_sub_agent_id) {
        updates.referring_sub_agent_id = referringSubAgentId;
      }
      result.linkedHouseStore = referringAgentId === houseId;
      attributionEvent = 'oauth_referral_established';
      attributionAgent = referringAgentId;
      attributionDetail = { had_no_referral: true, house_linked: result.linkedHouseStore };
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
      attributionEvent = 'oauth_fresh_referral_upgrade';
      attributionAgent = upgraded === true ? namedAgentId : houseId;
      attributionDetail = {
        upgraded: upgraded === true,
        rpc_error: rpcErr?.message ?? null,
        from_house_placeholder: true,
      };
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
      let { error: updateErr } = await admin
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      // Same username race as the self-heal path, on the backfill branch.
      if (
        updateErr &&
        updateErr.code === '23505' &&
        /username/i.test(updateErr.message ?? '') &&
        typeof updates.username === 'string'
      ) {
        updates.username = fallbackUsername(user);
        result.username = updates.username as string;
        ({ error: updateErr } = await admin
          .from('profiles')
          .update(updates)
          .eq('id', user.id));
      }

      if (updateErr) {
        result.error = `profile_update_failed: ${updateErr.message}`;
        return result;
      }
    }

    result.ok = true;
    if (attributionEvent) {
      await audit(attributionEvent, attributionAgent, attributionDetail);
    }
    return result;
  } catch (err) {
    console.error('[oauth-profile] Caught exception:', err);
    result.error = err instanceof Error ? err.message : 'unknown_error';
    return result;
  }
}

/**
 * Guaranteed-unique username tied to the caller's own immutable id. Two
 * different users can never produce the same value, so this always
 * terminates a collision.
 */
function fallbackUsername(user: OAuthUserLike): string {
  const base =
    sanitizeUsername((user.email ?? '').split('@')[0]).slice(0, 16) || 'researcher';
  return `${base}_${user.id.replace(/-/g, '').slice(0, 8)}`;
}

/**
 * Derive A Unique Username From The OAuth Email. The Final Fallback Appends
 * A Slice Of The Immutable User Id, Which Cannot Collide With Another User's
 * Fallback - Guaranteeing Termination Without An Unbounded Retry Loop.
 *
 * NOTE: this is a probe, not a reservation. The caller MUST handle a 23505 on
 * `username` by retrying with fallbackUsername() - two concurrent sign-ins
 * sharing an email local part can both pass this check.
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
  return fallbackUsername(user);
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
