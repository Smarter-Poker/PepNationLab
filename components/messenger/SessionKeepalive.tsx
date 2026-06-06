'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * fix-42: Proactive JWT refresh.
 *
 * Supabase's built-in autoRefreshToken sets a single timer ~10 seconds before
 * the access token expires. Mobile browsers (especially Safari iOS) throttle
 * timers in background tabs, so the timer can miss its window and the user
 * ends up with a stale access token on return. Every authenticated API call
 * then 401s until the user navigates (middleware refreshes via getUser).
 *
 * This component runs for every authenticated user on every page (mounted in
 * app/layout.tsx). It:
 *   - polls every 4 minutes while the tab is visible
 *   - refreshes if the access token expires in < 10 minutes
 *   - also refreshes on visibilitychange and window focus events
 *
 * Refresh tokens rotate on each successful refresh, so frequent refreshes
 * keep BOTH tokens warm indefinitely. This effectively eliminates the
 * "stale JWT" failure mode for active users without changing Supabase's
 * token TTLs.
 *
 * For unauthenticated visitors, getSession returns null and the function
 * is a no-op - this component is safe to mount globally.
 */

const POLL_MS = 4 * 60 * 1000; // 4 minutes
const REFRESH_THRESHOLD_S = 10 * 60; // refresh if < 10 min remaining

export default function SessionKeepalive() {
  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const refreshIfStale = async () => {
      if (!mounted) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return; // not signed in - nothing to refresh
        const expiresAt = session.expires_at ?? 0;
        const nowSec = Math.floor(Date.now() / 1000);
        if (expiresAt - nowSec < REFRESH_THRESHOLD_S) {
          await supabase.auth.refreshSession();
        }
      } catch {
        // Silent - a failed refresh will be picked up by middleware on the
        // next page navigation. We do NOT bubble the error here because
        // doing so would push every active user into a logout cascade if
        // a single refresh fails transiently.
      }
    };

    // Fire immediately on mount.
    void refreshIfStale();

    const interval = setInterval(refreshIfStale, POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshIfStale();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onFocus = () => void refreshIfStale();
    window.addEventListener('focus', onFocus);

    return () => {
      mounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return null;
}
