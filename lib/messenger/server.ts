import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { ParticipantRole } from './types';
import { timingSafeEqual } from 'crypto';

export type RequireSessionResult =
  | { user: { id: string; email: string | null }; error: null }
  | { user: null; error: 'Unauthorized' };

export async function requireSession(): Promise<RequireSessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, error: 'Unauthorized' };

  // Audit9 fix: a user whose profile is_active was flipped to false should
  // not be able to hit messenger routes via a cached session. Page-level
  // middleware enforces this for app/* routes but /api/messenger/* bypasses
  // it. Service-role lookup so deactivation cannot be evaded by RLS bypass.
  const svc = await createServiceClient();
  const { data: prof } = await svc
    .from('profiles')
    .select('is_active')
    .eq('id', user.id)
    .maybeSingle();
  if (prof && prof.is_active === false) return { user: null, error: 'Unauthorized' };

  return { user: { id: user.id, email: user.email ?? null }, error: null };
}

export interface ParticipantRow {
  id: string;
  role: ParticipantRole;
}

/**
 * Audit14: this lookup was previously a direct `svc.from('messenger_participants')
 * .select(...).eq(...).maybeSingle()` call. createServiceClient passes the
 * user's cookies through @supabase/ssr, so the request ran as the
 * authenticated user (under RLS), not as service_role. The destructure
 * threw away `error`, so any RLS/config issue silently produced null and
 * the calling route returned 403 -- which is exactly what send-message did
 * for legitimate participants.
 *
 * Route through a SECURITY DEFINER RPC (`fn_messenger_get_participant`)
 * that bypasses RLS unambiguously. Log non-no-rows errors so we never
 * silently swallow another failure here.
 */
export async function getParticipant(
  conversationId: string,
  userId: string,
): Promise<ParticipantRow | null> {
  const svc = await createServiceClient();
  const { data, error } = await svc.rpc('fn_messenger_get_participant', {
    p_conv_id: conversationId,
    p_user_id: userId,
  });
  if (error) {
    console.error('[messenger] getParticipant rpc failed', {
      conversationId,
      userId,
      code: (error as { code?: string }).code,
      message: error.message,
    });
    return null;
  }
  // RPC returns a setof row; supabase-js surfaces it as an array.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { id: row.id, role: row.role as ParticipantRole };
}

export async function isAdminUser(userId: string): Promise<boolean> {
  const svc = await createServiceClient();
  const { data } = await svc.from('profiles').select('role').eq('id', userId).maybeSingle();
  return data?.role === 'admin';
}

/**
 * Hierarchy gate for messenger invitations. Mirrors the canMessage logic in
 * the legacy app/api/messages/route.ts but exposed as a reusable helper.
 *
 *   admin       -> anyone (and anyone -> admin)
 *   super_agent -> direct sub-agents (parent_agent_id = me) AND researchers
 *                  whose referring agent is one of my direct sub-agents
 *   agent       -> own researchers (referring_agent_id = me), own sub-agents
 *                  (parent_agent_id = me), and my own parent super_agent
 *   researcher  -> only my referring agent
 */
export async function canInvite(callerId: string, targetUserId: string): Promise<boolean> {
  if (callerId === targetUserId) return true;
  const svc = await createServiceClient();
  const { data: caller } = await svc
    .from('profiles')
    .select('id, role, parent_agent_id, referring_agent_id')
    .eq('id', callerId)
    .maybeSingle();
  const { data: target } = await svc
    .from('profiles')
    .select('id, role, parent_agent_id, referring_agent_id')
    .eq('id', targetUserId)
    .maybeSingle();
  if (!caller || !target) return false;

  if (caller.role === 'admin') return true;
  if (target.role === 'admin') return true;

  if (caller.role === 'super_agent') {
    if (target.parent_agent_id === caller.id) return true;
    if (target.referring_agent_id) {
      const { data: midAgent } = await svc
        .from('profiles')
        .select('id, parent_agent_id')
        .eq('id', target.referring_agent_id)
        .maybeSingle();
      if (midAgent?.parent_agent_id === caller.id) return true;
    }
    return false;
  }

  if (caller.role === 'agent') {
    if (target.referring_agent_id === caller.id) return true;
    if (target.parent_agent_id === caller.id) return true;
    if (caller.parent_agent_id && target.id === caller.parent_agent_id) return true;
    return false;
  }

  if (caller.role === 'researcher') {
    if (caller.referring_agent_id && target.id === caller.referring_agent_id) return true;
    return false;
  }

  return false;
}

/**
 * Phase 12: returns true if `blockerId` has blocked `blockedId`. Used to gate
 * direct-conversation creation and add-participant flows. Service-role read so
 * we can check both directions regardless of the caller's RLS context.
 */
export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  if (blockerId === blockedId) return false;
  const svc = await createServiceClient();
  const { data } = await svc
    .from('messenger_blocked')
    .select('id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Audit9: single-roundtrip bidirectional block check. Use this everywhere we
 * previously did `isBlocked(a, b) || isBlocked(b, a)` to halve the DB cost.
 */
export async function isBlockedEither(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const svc = await createServiceClient();
  const { data, error } = await svc.rpc('fn_is_blocked_either', { p_a: a, p_b: b });
  if (error) {
    // Fail-closed: if the block-check RPC fails, treat as blocked to prevent
    // a DB error from silently permitting communication between blocked users.
    console.error('[messenger] isBlockedEither rpc failed — failing closed', {
      a, b,
      code: (error as { code?: string }).code,
      message: error.message,
    });
    return true;
  }
  return Boolean(data);
}

/**
 * Phase 13: cron auth gate. Returns ok=true only when the request carries
 * Authorization: Bearer ${CRON_SECRET}. Returns 503 (not 500) when the env
 * var is unset so /api/messenger/cron/* can be probed cleanly before secrets
 * are provisioned. Mirrors the LiveKit / Tenor un-configured pattern.
 *
 * Audit9: uses timingSafeEqual to thwart timing-channel recovery of the secret.
 */
export function getCronAuth(
  req: Request,
): { ok: true } | { ok: false; status: number; error: string } {
  // audit15: Vercel cron sends an `x-vercel-cron: 1` header that external
  // callers cannot forge (Vercel's edge strips x-vercel-* headers from
  // inbound requests). Accept it as proof of origin so the cron always
  // runs even if CRON_SECRET drifts between Vercel env and code. The Bearer
  // path below is still honored for manual / external invocations.
  if (req.headers.get('x-vercel-cron') === '1') return { ok: true };

  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, status: 503, error: 'Cron Not Configured' };
  const header = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const headerBuf = Buffer.from(header);
  const expectedBuf = Buffer.from(expected);
  if (headerBuf.length !== expectedBuf.length) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  if (!timingSafeEqual(headerBuf, expectedBuf)) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  return { ok: true };
}

export async function broadcastCallSignalServer(
  targetUserId: string,
  event: 'incoming_call' | 'call_accepted' | 'call_declined' | 'call_ended',
  payload: any,
): Promise<void> {
  const svc = await createServiceClient();
  // audit15 fix-34: must match the client-side `private: true` channel
  // mode from fix-32. Public-channel publishes do not reach private-channel
  // subscribers in Supabase Realtime — different routing paths. Service
  // role still bypasses realtime.messages RLS so the insert policy doesn't
  // reject; this is purely about channel-mode parity.
  const ch = svc.channel(`call-signal:${targetUserId}`, {
    config: { private: true },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), 3000);
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve();
        } else if (status === 'CHANNEL_ERROR') {
          clearTimeout(timeout);
          reject(new Error('error'));
        }
      });
    });
    await ch.send({ type: 'broadcast', event, payload });
  } catch (err) {
    console.warn('[SERVER BROADCAST] Failed to broadcast to', targetUserId, err);
  } finally {
    void svc.removeChannel(ch);
  }
}
