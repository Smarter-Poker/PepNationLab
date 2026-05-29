import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { ParticipantRole } from './types';

export type RequireSessionResult =
  | { user: { id: string; email: string | null }; error: null }
  | { user: null; error: 'Unauthorized' };

export async function requireSession(): Promise<RequireSessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, error: 'Unauthorized' };
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
  const { data } = await svc
    .from('messenger_participants')
    .select('id, role')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data as ParticipantRow | null) ?? null;
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
