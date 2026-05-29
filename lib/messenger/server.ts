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
