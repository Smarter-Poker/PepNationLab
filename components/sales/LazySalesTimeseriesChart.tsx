'use client';

/**
 * Lazy wrapper for the sales timeseries chart. Keeps recharts (~400KB) out of
 * the sales page's initial bundle -- the chart is a visualization of data the
 * page already renders, so deferring it costs nothing. Props forwarded unchanged.
 */
import dynamic from 'next/dynamic';

const SalesTimeseriesChart = dynamic(() => import('./SalesTimeseriesChart'), {
  ssr: false,
  loading: () => <div style={{ minHeight: 220 }} aria-hidden="true" />,
});

export default SalesTimeseriesChart;
