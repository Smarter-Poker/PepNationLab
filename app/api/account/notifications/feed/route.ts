import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ unread_count: 0, recent: [] });

  // Read from dedicated notifications table
  const { data: notifs, count: unreadCount } = await supabase
    .from('notifications')
    .select('id, type, title, body, url, read_at, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(1);  // just for count

  const { data: recent } = await supabase
    .from('notifications')
    .select('id, type, title, body, url, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  const totalUnread = unreadCount ?? 0;

  return NextResponse.json({
    unread_count: totalUnread,
    recent: (recent ?? []).map((n) => ({
      id: String(n.id),
      type: n.type,
      title: n.title,
      body: n.body,
      url: n.url || '/dashboard',
      read_at: n.read_at,
      created_at: n.created_at,
      kind: 'notification' as const,
    })),
  });
}
