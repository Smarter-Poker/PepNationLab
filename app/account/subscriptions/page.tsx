import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import SubscriptionsClient from './SubscriptionsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Subscriptions | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function SubscriptionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/account/subscriptions');

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('id, agent_id, status, cadence_days, payment_method, fulfillment_method, shipping_address, items_snapshot, next_run_at, last_run_at, last_order_id, failure_count, last_failure_reason, paused_at, cancelled_at, created_at, updated_at')
    .eq('researcher_id', user.id)
    .order('created_at', { ascending: false });

  // Decorate with agent display name + storefront slug.
  const agentIds = Array.from(new Set((subscriptions ?? []).map((s) => s.agent_id))).filter(Boolean);
  const agentMap: Record<string, { display_name: string | null; slug: string | null }> = {};
  if (agentIds.length > 0) {
    const service = await createServiceClient();
    const { data: agents } = await service
      .from('agent_profiles')
      .select('id, display_name, slug')
      .in('id', agentIds);
    for (const a of agents ?? []) {
      agentMap[String(a.id)] = { display_name: a.display_name ?? null, slug: a.slug ?? null };
    }
  }

  const decorated = (subscriptions ?? []).map((s) => ({
    ...s,
    agent: agentMap[String(s.agent_id)] ?? { display_name: null, slug: null },
  }));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)', padding: 'var(--space-6) var(--space-4)' }}>
      <div className="container" style={{ maxWidth: 960 }}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Link href="/account" style={{ fontSize: '0.85rem', color: 'var(--teal)', textDecoration: 'none' }}>
            Back To Your Account
          </Link>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          <div>
            <h1 style={{ color: 'var(--white)', fontSize: '1.6rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-2)' }}>
              Auto-Replenish Subscriptions
            </h1>
            <p style={{ color: 'var(--silver)', fontSize: '0.92rem' }}>
              Recurring Orders Created Automatically On Your Schedule. You Pay Each Run As Usual.
            </p>
          </div>
          <Link href="/orders" className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            Add From An Order
          </Link>
        </div>

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <SubscriptionsClient initialSubscriptions={decorated as any} />
      </div>
    </div>
  );
}
