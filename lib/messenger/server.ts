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
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { id: row.id, role: row.role as ParticipantRole };
}

export async function isAdminUser(userId: string): Promise<boolean> {
  const svc = await createServiceClient();
  const { data } = await svc.from('profiles').select('role').eq('id', userId).maybeSingle();
  return data?.role === 'admin';
}

interface DownlineProfile {
  id?: string;
  parent_agent_id?: string | null;
  referring_agent_id?: string | null;
  referring_sub_agent_id?: string | null;
}

async function isDownlineOf(
  target: DownlineProfile,
  superAgentId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svc: any,
): Promise<boolean> {
  if (target.parent_agent_id === superAgentId) return true;
  if (target.referring_agent_id === superAgentId) return true;
  if (target.referring_sub_agent_id === superAgentId) return true;

  const parentId = target.parent_agent_id || target.referring_agent_id || target.referring_sub_agent_id;
  if (!parentId) return false;

  const { data: parent } = await svc
    .from('profiles')
    .select('id, parent_agent_id, referring_agent_id, referring_sub_agent_id')
    .eq('id', parentId)
    .maybeSingle();

  if (!parent) return false;

  if (parent.parent_agent_id === superAgentId) return true;
  if (parent.referring_agent_id === superAgentId) return true;
  if (parent.referring_sub_agent_id === superAgentId) return true;

  const grandParentId = parent.parent_agent_id || parent.referring_agent_id || parent.referring_sub_agent_id;
  if (!grandParentId) return false;

  const { data: grandParent } = await svc
    .from('profiles')
    .select('id, parent_agent_id, referring_agent_id, referring_sub_agent_id')
    .eq('id', grandParentId)
    .maybeSingle();

  if (!grandParent) return false;

  if (grandParent.parent_agent_id === superAgentId) return true;
  if (grandParent.referring_agent_id === superAgentId) return true;
  if (grandParent.referring_sub_agent_id === superAgentId) return true;

  return false;
}

export async function canInvite(callerId: string, targetUserId: string): Promise<boolean> {
  if (callerId === targetUserId) return true;
  const svc = await createServiceClient();
  const { data: caller } = await svc
    .from('profiles')
    .select('id, role, parent_agent_id, referring_agent_id, referring_sub_agent_id, is_super_agent')
    .eq('id', callerId)
    .maybeSingle();
  const { data: target } = await svc
    .from('profiles')
    .select('id, role, parent_agent_id, referring_agent_id, referring_sub_agent_id, is_super_agent')
    .eq('id', targetUserId)
    .maybeSingle();
  if (!caller || !target) return false;

  const isCallerSuperAgent = caller.role === 'super_agent' || caller.is_super_agent === true;

  if (caller.role === 'admin') return true;
  if (target.role === 'admin') return true;

  if (isCallerSuperAgent) {
    if (await isDownlineOf(target, caller.id, svc)) return true;
    return false;
  }

  if (caller.role === 'agent') {
    if (target.referring_agent_id === caller.id) return true;
    if (target.referring_sub_agent_id === caller.id) return true;
    if (target.parent_agent_id === caller.id) return true;
    if (caller.parent_agent_id && target.id === caller.parent_agent_id) return true;
    return false;
  }

  if (caller.role === 'researcher') {
    if (caller.referring_agent_id && target.id === caller.referring_agent_id) return true;
    if (caller.referring_sub_agent_id && target.id === caller.referring_sub_agent_id) return true;
    return false;
  }

  return false;
}

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

export async function isBlockedEither(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const svc = await createServiceClient();
  const { data, error } = await svc.rpc('fn_is_blocked_either', { p_a: a, p_b: b });
  if (error) {
    console.error('[messenger] isBlockedEither rpc failed - failing closed', {
      a, b,
      code: (error as { code?: string }).code,
      message: error.message,
    });
    return true;
  }
  return Boolean(data);
}

export function getCronAuth(
  req: Request,
): { ok: true } | { ok: false; status: number; error: string } {
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
  payload: Record<string, unknown>,
): Promise<void> {
  const svc = await createServiceClient();
  // HOTFIX fix-38: public channel (reverted from private:true). The
  // companion realtime.messages policies have been dropped, so private
  // mode would now fail to subscribe.
  const ch = svc.channel(`call-signal:${targetUserId}`);

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
