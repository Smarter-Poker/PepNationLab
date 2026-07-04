'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import SubAgentDashboardClient from '@/components/SubAgentDashboardClient';

/**
 * SACA Phase 5: Sub-agent dashboard.
 *
 * Read-only view of:
 *  - Balance + credit cap + payment model
 *  - Pending commission for this week
 *  - Lifetime settled commission
 *  - Last 8 weekly settlements
 *  - Last 10 attributed orders
 *
 * fix-47: added a "Help & Resources" panel at the bottom linking to the
 * shared agent docs hub + a one-tap path back into messenger.
 */

type Overview = {
  profile: {
    id: string;
    full_name?: string | null;
    username?: string | null;
    email?: string | null;
    commission_pct: number | null;
    commission_active_since: string | null;
    account_type: 'credit' | 'prepaid' | string | null;
    credit_limit: number | null;
    prepaid_balance: number | null;
    parent: {
      id: string;
      full_name: string | null;
      username: string | null;
      email?: string | null;
      storefront_slug?: string | null;
    } | null;
  };
  share_link: string | null;
  pending_commission: number;
  lifetime_commission: number;
  recent_settlements: Array<{ id: string; week_start: string; week_end: string; total_commission: number; orders_count: number; settled_at: string }>;
  recent_orders: Array<{ id: string; total: number; status: string; created_at: string; sub_agent_commission_amount: number | null; sub_agent_commission_pct: number | null }>;
  referred_researchers_count: number;
};

export default function SubAgentDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/sub-agent/overview', { credentials: 'include', cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setData(json as Overview);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed To Load Dashboard.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/sub-agent/overview', { credentials: 'include' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        if (!cancelled) setData(json as Overview);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed To Load Dashboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--black)' }}>
        <Navbar />
        <div style={{ height: 60 }} />
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '28px' }}>Sub-Agent Dashboard</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--black)' }}>
        <Navbar />
        <div style={{ height: 60 }} />
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '28px' }}>Sub-Agent Dashboard</h1>
          <div style={{ color: '#E53E3E', marginTop: '12px' }}>{error || 'No Data.'}</div>
        </div>
      </div>
    );
  }

  return (
    <SubAgentDashboardClient data={data} onRefresh={load} />
  );
}
