export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AdminAnalytics from '@/components/AdminAnalytics';
import AdminOverviewSparkline from '@/components/AdminOverviewSparkline';
import AdminDashboardRealtime from '@/components/AdminDashboardRealtime';
import { fetchAdminMetrics, computeGmvDelta, timeAgo } from '@/lib/admin-metrics';
import { getImpersonationContext } from '@/lib/impersonation';

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function formatCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatAuditAction(action: string): string {
  return action
    .split('_')
    .map((w) => (w.length === 0 ? '' : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

export default async function AdminDashboard() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  if (profile?.role !== 'admin') {
    return redirect('/dashboard');
  }

  const metrics = await fetchAdminMetrics(user.id);
  const delta = computeGmvDelta(metrics.gmvLast7, metrics.gmvPrior7);
  const impersonation = await getImpersonationContext();
  const activeImpersonation =
    impersonation && impersonation.impersonatorId === user.id ? impersonation : null;

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <AdminDashboardRealtime />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <h1 className="animated-gradient-text" style={{ fontSize: '1.6rem', margin: 0 }}>Admin Dashboard</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', margin: 0 }}>Pep Nation Lab Control Center</p>
      </div>
      <AdminAnalytics />
    </div>
  );
}
