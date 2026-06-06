import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';

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
    .select('id, impersonator_id, target_user_id, ended_at')
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
