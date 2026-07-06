import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BookmarkRow {
  id: string;
  message_id: string;
  message_text: string | null;
  created_at: string;
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('read', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  const svc = await createServiceClient();

  const { data: bks, error: bErr } = await svc
    .from('messenger_bookmarks')
    .select('id, message_id, message_text, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (bErr) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });

  const list = (bks ?? []) as BookmarkRow[];
  if (list.length === 0) return NextResponse.json({ bookmarks: [] });

  // Pull conversation_id per message so the UI can jump back into context.
  const ids = list.map((b) => b.message_id);
  const { data: msgs } = await svc
    .from('messenger_messages')
    .select('id, conversation_id, text, message_type, is_deleted')
    .in('id', ids);

  let dismissedSet: Set<string> = new Set();
  if (ids.length > 0) {
    const { data: dis } = await svc
      .from('messenger_message_dismissals')
      .select('message_id')
      .eq('user_id', user.id)
      .in('message_id', ids);
    dismissedSet = new Set(((dis ?? []) as Array<{ message_id: string }>).map((r) => r.message_id));
  }

  const byId = new Map<string, { conversation_id: string; text: string | null; message_type: string; is_deleted: boolean }>();
  (msgs ?? []).forEach((m) =>
    byId.set(m.id, {
      conversation_id: m.conversation_id,
      text: m.text,
      message_type: m.message_type,
      is_deleted: m.is_deleted,
    }),
  );

  const bookmarks = list.map((b) => {
    const m = byId.get(b.message_id);
    return {
      id: b.id,
      message_id: b.message_id,
      message_text: b.message_text,
      created_at: b.created_at,
      conversation_id: m?.conversation_id ?? null,
      message_type: m?.message_type ?? null,
      live_text: m?.is_deleted || dismissedSet.has(b.message_id) ? null : (m?.text ?? null),
      source_deleted: (m?.is_deleted ?? false) || dismissedSet.has(b.message_id),
    };
  });

  return NextResponse.json({ bookmarks });
}
