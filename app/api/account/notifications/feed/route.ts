import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ unread_count: 0, recent: [] });

  // Read from dedicated notifications table. The unread count is head-only
  // (no rows fetched) and runs in parallel with the recent-items query.
  const [{ count: unreadCount }, { data: recent }] = await Promise.all([
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null),
    supabase
      .from('notifications')
      .select('id, type, title, body, url, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

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
