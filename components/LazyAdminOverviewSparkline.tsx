'use client';

/**
 * Lazy wrapper for the admin overview sparkline. Without this, the admin
 * dashboard statically imports recharts (~400KB) just to draw a sparkline --
 * which would pull the whole library back into the initial bundle and defeat
 * the lazy-loaded AdminAnalytics panel. Loads client-side after hydration with a
 * fixed-height placeholder to avoid layout shift. Props forwarded unchanged.
 */
import dynamic from 'next/dynamic';

const AdminOverviewSparkline = dynamic(() => import('@/components/AdminOverviewSparkline'), {
  ssr: false,
  loading: () => <div style={{ minHeight: 60 }} aria-hidden="true" />,
});

export default AdminOverviewSparkline;
