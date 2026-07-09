'use client';

/**
 * Lazy wrapper for the agent sales/analytics panel. Defers recharts (~400KB) out
 * of the agent dashboard's initial bundle, loading it client-side only after
 * hydration. Props are forwarded to the underlying component unchanged.
 */
import dynamic from 'next/dynamic';

const AgentSales = dynamic(() => import('@/components/AgentSales'), {
  ssr: false,
  loading: () => <div style={{ minHeight: 400 }} aria-hidden="true" />,
});

export default AgentSales;
