'use client';

/**
 * Lazy wrapper for the admin analytics panel. recharts (~400KB) is the heaviest
 * dependency it pulls in; loading it client-side only (ssr: false) after
 * hydration keeps it out of the admin dashboard's initial bundle. A fixed-height
 * placeholder avoids layout shift while it streams in.
 */
import dynamic from 'next/dynamic';

const AdminAnalytics = dynamic(() => import('@/components/AdminAnalytics'), {
  ssr: false,
  loading: () => <div style={{ minHeight: 480 }} aria-hidden="true" />,
});

export default AdminAnalytics;
