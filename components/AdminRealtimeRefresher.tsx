'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * fix-57 #7: global Realtime refresher for admin pages.
 *
 * Listens on:
 *  - orders INSERT/UPDATE → KPIs, order lists, nudges all refresh
 *  - notifications INSERT  → admin bell, unread count refresh
 *
 * Single mount in AdminLayoutClient covers every /admin/* page. The
 * router.refresh() call re-runs server components on the current route
 * (admin home, network, sales, statements, etc). Client-rendered pages
 * (orders, transactions, search) can subscribe themselves additionally
 * if they need finer-grained reactions.
 */
export default function AdminRealtimeRefresher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        router.refresh();
      }, 1500);
    };

    const ch = supabase
      .channel('admin-global-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, scheduleRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, scheduleRefresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, scheduleRefresh)
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      document.removeEventListener('visibilitychange', onVisible);
      try { supabase.removeChannel(ch); } catch { /* ignore */ }
    };
  }, [router]);

  return null;
}
