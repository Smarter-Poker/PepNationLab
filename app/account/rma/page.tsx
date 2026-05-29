import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import PageShell from '@/components/PageShell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Returns | Pep Nation Lab',
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  approved: 'Approved',
  label_sent: 'Label Sent',
  in_transit: 'In Transit',
  received: 'Received',
  inspected: 'Inspected',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

const STATUS_COLORS: Record<string, string> = {
  requested: '#F6AD55',
  approved: 'var(--teal)',
  label_sent: 'var(--teal)',
  in_transit: 'var(--teal)',
  received: '#68D391',
  inspected: '#68D391',
  resolved: '#68D391',
  rejected: 'var(--red)',
};

export default async function AccountRmaListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const service = await createServiceClient();
  const { data: rmas } = await service
    .from('rma_requests')
    .select('id, order_id, status, reason_category, requested_resolution, created_at, resolved_at')
    .eq('requester_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <PageShell>
      <div className="container" style={{ maxWidth: 980, padding: 'var(--space-6) var(--space-4)' }}>
        <h1 style={{ color: 'var(--white)', fontSize: '1.6rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-2)' }}>
          Your Returns
        </h1>
        <p style={{ color: 'var(--silver)', marginBottom: 'var(--space-5)' }}>
          Track Your Return Requests And Their Status.
        </p>

        {(!rmas || rmas.length === 0) ? (
          <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
            <p style={{ color: 'var(--silver)' }}>You Have Not Filed Any Return Requests.</p>
            <p style={{ color: 'var(--silver)', marginTop: 'var(--space-2)' }}>
              To Start A Return, Open An Order Detail Page And Choose Request Return.
            </p>
            <Link href="/orders" className="btn-primary" style={{ marginTop: 'var(--space-4)', display: 'inline-block' }}>
              View Your Orders
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {rmas.map((r) => (
              <Link
                key={r.id}
                href={`/account/rma/${r.id}`}
                className="card-glass"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  textDecoration: 'none',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div>
                  <div style={{ color: 'var(--white)', fontWeight: 700 }}>
                    Return #{r.id.slice(0, 8).toUpperCase()}
                  </div>
                  <div style={{ color: 'var(--silver)', fontSize: '0.88rem' }}>
                    Order #{r.order_id.slice(0, 8).toUpperCase()} &middot; {r.reason_category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  </div>
                  <div style={{ color: 'var(--grey-400)', fontSize: '0.78rem', marginTop: 4 }}>
                    Filed {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: STATUS_COLORS[r.status] || 'var(--grey-400)',
                    color: 'var(--black)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                  }}
                >
                  {STATUS_LABELS[r.status] || r.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
