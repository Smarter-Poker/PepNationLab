import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { ListThreadRepliesSchema } from '@/lib/messenger/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = ListThreadRepliesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const svc = await createServiceClient();

  const { data: parent } = await svc
    .from('messenger_messages')
    .select('id, conversation_id, text, message_type, sender_id, media_url, created_at, is_deleted')
    .eq('id', parsed.data.threadParentId)
    .maybeSingle();
  if (!parent) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

  const callerPart = await getParticipant(parent.conversation_id, user.id);
  if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });

  const { data, error: qErr } = await svc
    .from('messenger_messages')
    .select('*')
    .eq('thread_parent_id', parsed.data.threadParentId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  return NextResponse.json({ parent, messages: data ?? [] });
}
