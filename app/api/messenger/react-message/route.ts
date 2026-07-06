import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { ReactSchema } from '@/lib/messenger/schemas';
import { sendBroadcast } from '@/lib/messenger/broadcast';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The messenger_reactions UNIQUE INDEX uses COALESCE(emoji, gif_url) which is
// an expression-based unique index. supabase-js `upsert` with `onConflict`
// requires a column-list matching a unique constraint, so it cannot target
// the expression index. We therefore do an explicit existence check first
// and only insert when no row exists -- this is idempotent on retry. If a
// concurrent insert wins the race the unique index will reject the dup with
// Postgres code 23505 which we swallow as a no-op.

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('react', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  const body = await req.json().catch(() => ({}));
  const parsed = ReactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const svc = await createServiceClient();
  const { data: msg } = await svc
    .from('messenger_messages')
    .select('conversation_id')
    .eq('id', parsed.data.messageId)
    .maybeSingle();
  if (!msg) return NextResponse.json({ error: 'Message Not Found' }, { status: 404 });

  const participant = await getParticipant(msg.conversation_id, user.id);
  if (!participant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (parsed.data.action === 'add') {
    const { data: existing } = await svc
      .from('messenger_reactions')
      .select('id')
      .eq('message_id', parsed.data.messageId)
      .eq('user_id', user.id)
      .eq('emoji', parsed.data.emoji)
      .maybeSingle();
    if (existing) return NextResponse.json({ ok: true });

    const { data: inserted, error: insErr } = await svc.from('messenger_reactions').insert({
      message_id: parsed.data.messageId,
      conversation_id: msg.conversation_id,
      user_id: user.id,
      reaction_type: 'emoji',
      emoji: parsed.data.emoji,
      gif_url: null,
    }).select('*').maybeSingle();

    if (insErr) {
      const code = (insErr as { code?: string }).code;
      if (code === '23505') return NextResponse.json({ ok: true });
      return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    }

    if (inserted) {
      await sendBroadcast({
        topic: `chat:${msg.conversation_id}`,
        event: 'reaction_added',
        payload: { reaction: inserted },
      });
    }
    return NextResponse.json({ ok: true });
  }

  const { error: delErr } = await svc
    .from('messenger_reactions')
    .delete()
    .eq('message_id', parsed.data.messageId)
    .eq('user_id', user.id)
    .eq('emoji', parsed.data.emoji);

  if (delErr) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });

  await sendBroadcast({
    topic: `chat:${msg.conversation_id}`,
    event: 'reaction_removed',
    payload: { message_id: parsed.data.messageId, user_id: user.id, emoji: parsed.data.emoji },
  });

  return NextResponse.json({ ok: true });
}
