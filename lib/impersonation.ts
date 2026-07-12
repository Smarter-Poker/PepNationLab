import { cookies } from 'next/headers';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * Admin impersonation context.
 *
 * Impersonation is NOT a full auth swap - the underlying Supabase session
 * stays bound to the admin user. The `pnl_impersonation` cookie carries a
 * server-issued session id plus the impersonator/target identifiers. We
 * verify the row in `impersonation_sessions` is still open (ended_at IS NULL)
 * AND was created by the same admin who owns the current session.
 *
 * Returns null when no active impersonation exists.
 */

export const IMPERSONATION_COOKIE = 'pnl_impersonation';
export const IMPERSONATION_TTL_SECONDS = 30 * 60; // 30 minutes

export type ImpersonationContext = {
  sessionId: string;
  impersonatorId: string;
  targetUserId: string;
  targetRole: string;
  targetName: string | null;
};

type CookiePayload = {
  sid: string;
  imp: string;
  tgt: string;
};

function parseCookie(value: string | undefined): CookiePayload | null {
  if (!value) return null;
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as CookiePayload;
    if (
      typeof parsed.sid !== 'string' ||
      typeof parsed.imp !== 'string' ||
      typeof parsed.tgt !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function encodeImpersonationCookie(payload: CookiePayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/**
 * Returns the active impersonation context for the cookie, or null.
 */
export async function getImpersonationContext(): Promise<ImpersonationContext | null> {
  const store = await cookies();
  const raw = store.get(IMPERSONATION_COOKIE)?.value;
  const payload = parseCookie(raw);
  if (!payload) return null;

  const service = await createServiceClient();

  // Validate the session row.
  const { data: session } = await service
    .from('impersonation_sessions')
    .select('id, impersonator_id, target_user_id, ended_at, started_at')
    .eq('id', payload.sid)
    .maybeSingle();

  if (
    !session ||
    session.ended_at ||
    session.impersonator_id !== payload.imp ||
    session.target_user_id !== payload.tgt
  ) {
    return null;
  }

  // Enforce the 30-minute TTL server-side. The cookie maxAge is client-side
  // only; a persisted or replayed cookie must not outlive the session TTL.
  const startedMs = session.started_at ? Date.parse(session.started_at as string) : NaN;
  if (!Number.isFinite(startedMs) || Date.now() - startedMs > IMPERSONATION_TTL_SECONDS * 1000) {
    return null;
  }

  // Pull the target's role + name for the banner.
  const { data: target } = await service
    .from('profiles')
    .select('role, full_name')
    .eq('id', session.target_user_id)
    .maybeSingle();

  return {
    sessionId: session.id as string,
    impersonatorId: session.impersonator_id as string,
    targetUserId: session.target_user_id as string,
    targetRole: (target?.role as string) ?? 'unknown',
    targetName: (target?.full_name as string | null) ?? null,
  };
}


/**
 * Resolve the EFFECTIVE user id for per-user data reads (wallet, balances,
 * statements, etc.). When the authenticated admin has an active "View As"
 * impersonation session that THEY started, this returns the impersonated
 * target's id so the target's own data is served instead of the admin's own.
 * Otherwise it returns the authenticated user's id unchanged.
 *
 * This is the piece impersonation was missing: the Supabase auth session stays
 * bound to the admin (see getImpersonationContext), so any money/data route
 * that keys off auth.getUser() alone would otherwise serve the ADMIN's rows
 * while "viewing as" an agent -- e.g. rendering the admin's $100k prepaid
 * balance as that agent's credit line.
 */
export async function resolveEffectiveUserId(
  authedUserId: string,
): Promise<{ effectiveUserId: string; impersonating: boolean; targetUserId: string | null }> {
  const ctx = await getImpersonationContext();
  if (ctx && ctx.impersonatorId === authedUserId) {
    return { effectiveUserId: ctx.targetUserId, impersonating: true, targetUserId: ctx.targetUserId };
  }
  return { effectiveUserId: authedUserId, impersonating: false, targetUserId: null };
}


/**
 * Wrap supabase.auth.getUser() so that, during a validated admin "View As"
 * session, the returned user's id is the impersonated TARGET's id. A route can
 * then swap a single line -- supabase.auth.getUser() -> getEffectiveUser(supabase)
 * -- and every downstream `user.id` transparently scopes to the agent being
 * viewed (full act-as: reads AND writes). Returns the real getUser() result
 * unchanged for all normal (non-impersonated) traffic.
 *
 * Do NOT use on auth/session/security routes (password, MFA, signout,
 * deactivate) -- those must always operate on the real signed-in admin.
 */
export async function getEffectiveUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const res = await supabase.auth.getUser();
  const user = res.data.user;
  if (!user) return res;
  const ctx = await getImpersonationContext();
  if (ctx && ctx.impersonatorId === user.id) {
    return { ...res, data: { ...res.data, user: { ...user, id: ctx.targetUserId } } };
  }
  return res;
}
