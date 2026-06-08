'use client';

/**
 * Lazy wrappers for the two recharts-backed monograph visualizations.
 *
 * recharts is ~400KB and is the single heaviest dependency pulled into the
 * monograph's JS. Both of these charts live below the fold in the viz rail and
 * are decorative visualizations of data that is already rendered server-side,
 * so we load them client-side only (ssr: false) via next/dynamic. This pulls
 * recharts out of the page's initial bundle and fetches it lazily after
 * hydration, with a fixed-height placeholder to avoid layout shift.
 */

import dynamic from 'next/dynamic';

export const PKChart = dynamic(() => import('./PKChart'), {
  ssr: false,
  loading: () => <div style={{ minHeight: 240 }} aria-hidden="true" />,
});

export const ReceptorAffinityHeatmap = dynamic(() => import('./ReceptorAffinityHeatmap'), {
  ssr: false,
  loading: () => <div style={{ minHeight: 240 }} aria-hidden="true" />,
});
