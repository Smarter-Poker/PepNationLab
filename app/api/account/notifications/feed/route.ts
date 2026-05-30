import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ unread_count: 0, recent: [] });

  const { data: msgs, count: msgUnreadCount } = await supabase
    .from('internal_messages')
    .select('id, subject, body, created_at, read_at', { count: 'exact' })
    .eq('recipient_id', user.id)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: pushes } = await supabase
    .from('push_outbox')
    .select('id, title, body, url, sent_at, created_at, status')
    .eq('recipient_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const recent = [
    ...(msgs ?? []).map((m) => ({
      id: String(m.id),
      title: m.subject || 'Message',
      body: m.body,
      url: '/messenger',
      created_at: m.created_at,
      kind: 'message' as const,
    })),
    ...(pushes ?? []).map((p) => ({
      id: String(p.id),
      title: p.title || 'Notification',
      body: p.body,
      url: p.url || '/account/notifications',
      created_at: p.created_at,
      kind: 'push' as const,
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 15);

  return NextResponse.json({
    unread_count: msgUnreadCount ?? 0,
    recent,
  });
}
