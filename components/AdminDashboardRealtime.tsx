'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * fix-55 #7: live-refresh the admin dashboard on new/updated orders.
 *
 * Server components don't react to data changes. This client child
 * subscribes to Supabase Realtime, debounces a burst of events to a
 * single router.refresh() so the KPI tiles, sparkline, leaderboard,
 * and audit log all update without manual reload.
 *
 * Pure side-effect component — renders nothing.
 */
export default function AdminDashboardRealtime() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        router.refresh();
      }, 1500);
    };

    const ch = supabase
      .channel('admin-dashboard-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, scheduleRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, scheduleRefresh)
      .subscribe();

    // Refresh when the tab returns to the foreground after being hidden — the
    // Realtime connection drops on long hidden tabs.
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
