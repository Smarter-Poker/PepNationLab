import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

/** POST: Add reaction | DELETE: Remove reaction | GET: Get reactions for a message */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const messageId = new URL(req.url).searchParams.get('messageId');
  if (!messageId) return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from('message_reactions')
    .select('emoji, user_id, profiles:user_id(full_name)')
    .eq('message_id', messageId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by emoji
  const grouped: Record<string, { emoji: string; count: number; users: { id: string; name: string }[]; myReaction: boolean }> = {};
  for (const r of data ?? []) {
    if (!grouped[r.emoji]) grouped[r.emoji] = { emoji: r.emoji, count: 0, users: [], myReaction: false };
    grouped[r.emoji].count++;
    grouped[r.emoji].users.push({ id: r.user_id, name: (r as any).profiles?.full_name || 'User' });
    if (r.user_id === user.id) grouped[r.emoji].myReaction = true;
  }

  return NextResponse.json({ reactions: Object.values(grouped) });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { messageId, emoji } = body;
  if (!messageId || !emoji) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const service = await createServiceClient();
  const { error } = await service.from('message_reactions').insert({
    message_id: messageId, user_id: user.id, emoji,
  });

  if (error?.code === '23505') return NextResponse.json({ error: 'Already reacted' }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { messageId, emoji } = body;
  if (!messageId || !emoji) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const service = await createServiceClient();
  const { error } = await service.from('message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .eq('emoji', emoji);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
