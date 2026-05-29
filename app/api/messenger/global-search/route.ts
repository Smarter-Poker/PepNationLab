import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Schema = z.object({ q: z.string().min(1).max(120) });

interface ParticipantRow { conversation_id: string }

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const svc = await createServiceClient();
  const { data: parts } = await svc
    .from('messenger_participants')
    .select('conversation_id')
    .eq('user_id', user.id);
  const conversationIds = ((parts ?? []) as ParticipantRow[]).map((p) => p.conversation_id);
  if (conversationIds.length === 0) {
    return NextResponse.json({ messages: [], conversations: [] });
  }

  const term = parsed.data.q.replace(/[\\%_]/g, (c) => '\\' + c);

  const [messagesRes, convsRes] = await Promise.all([
    svc
      .from('messenger_messages')
      .select('id, conversation_id, sender_id, text, message_type, created_at')
      .in('conversation_id', conversationIds)
      .eq('is_deleted', false)
      .ilike('text', `%${term}%`)
      .order('created_at', { ascending: false })
      .limit(50),
    svc
      .from('messenger_conversations')
      .select('id, type, title, avatar_url, last_message_text, last_message_at')
      .in('id', conversationIds)
      .ilike('title', `%${term}%`)
      .limit(20),
  ]);

  return NextResponse.json({
    messages: messagesRes.data ?? [],
    conversations: convsRes.data ?? [],
  });
}
