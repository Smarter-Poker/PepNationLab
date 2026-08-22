'use client';

import { useReportWebVitals } from 'next/web-vitals';

// Real-user Core Web Vitals reporter. Uses Next's built-in useReportWebVitals
// (no extra dependency) and posts each metric to /api/vitals with keepalive so
// the report survives page unload. Renders null and never throws, so it is safe
// to mount app-wide via DeferredGlobals. Complements Vercel Speed Insights by
// keeping the field data in the team's own database for custom querying.
export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    try {
      const payload = JSON.stringify({
        metric: metric.name,
        value: metric.value,
        rating: (metric as { rating?: string }).rating ?? null,
        metric_id: metric.id,
        navigation_type: (metric as { navigationType?: string }).navigationType ?? null,
        path: typeof window !== 'undefined' ? window.location.pathname : null,
      });
      fetch('/api/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    } catch {
      // never let measurement affect the page
    }
  });

  return null;
}
