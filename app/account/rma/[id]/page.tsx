import type { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import PageShell from '@/components/PageShell';
import RmaEvidenceUploader from './RmaEvidenceUploader';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Return Detail | Pep Nation Lab',
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

export default async function AccountRmaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const service = await createServiceClient();
  const { data: rma } = await service
    .from('rma_requests')
    .select('*')
    .eq('id', id)
    .eq('requester_id', user.id)
    .single();
  if (!rma) notFound();

  const [{ data: items }, { data: attachments }] = await Promise.all([
    service.from('rma_items').select('id, product_name, quantity, unit_amount, condition_received').eq('rma_id', id),
    service.from('rma_attachments').select('id, storage_key, mime_type, size_bytes, uploaded_at').eq('rma_id', id).order('uploaded_at', { ascending: false }),
  ]);

  const signedAttachments = await Promise.all(
    (attachments ?? []).map(async (row) => {
      const { data: signed } = await service.storage
        .from('rma-attachments')
        .createSignedUrl(row.storage_key, 600);
      return { ...row, signed_url: signed?.signedUrl ?? null };
    })
  );

  const totalRequested = (items ?? []).reduce((sum, it) => sum + Number(it.unit_amount) * Number(it.quantity), 0);

  return (
    <PageShell>
      <div className="container" style={{ maxWidth: 880, padding: 'var(--space-6) var(--space-4)' }}>
        <Link href="/account/rma" style={{ color: 'var(--teal)', fontSize: '0.85rem' }}>
          &lsaquo; Back To Returns
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <h1 style={{ color: 'var(--white)', fontSize: '1.6rem', fontFamily: 'var(--font-brand)' }}>
            Return #{rma.id.slice(0, 8).toUpperCase()}
          </h1>
          <span
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              background: STATUS_COLORS[rma.status] || 'var(--grey-400)',
              color: 'var(--black)',
              fontSize: '0.85rem',
              fontWeight: 700,
            }}
          >
            {STATUS_LABELS[rma.status] || rma.status}
          </span>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div style={{ color: 'var(--white)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Request Details</div>
          <div style={{ color: 'var(--silver)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            <div><strong style={{ color: 'var(--white)' }}>Order:</strong> #{rma.order_id.slice(0, 8).toUpperCase()}</div>
            <div><strong style={{ color: 'var(--white)' }}>Reason:</strong> {rma.reason_category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</div>
            <div><strong style={{ color: 'var(--white)' }}>Resolution Requested:</strong> {rma.requested_resolution.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</div>
            <div style={{ marginTop: 'var(--space-2)' }}><strong style={{ color: 'var(--white)' }}>Details:</strong></div>
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', marginTop: 4 }}>{rma.reason_details}</div>
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div style={{ color: 'var(--white)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Items</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {(items ?? []).map((it) => (
              <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ color: 'var(--white)' }}>{it.product_name}</div>
                <div style={{ color: 'var(--silver)' }}>Qty {it.quantity}</div>
                <div style={{ color: 'var(--white)', fontWeight: 700 }}>${(Number(it.unit_amount) * Number(it.quantity)).toFixed(2)}</div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', color: 'var(--teal)', fontWeight: 700, marginTop: 'var(--space-2)' }}>
              Total Requested: ${totalRequested.toFixed(2)}
            </div>
          </div>
        </div>

        {rma.status === 'rejected' && rma.rejected_reason && (
          <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)', borderColor: 'var(--red)' }}>
            <div style={{ color: 'var(--red)', fontWeight: 700 }}>Rejection Reason</div>
            <div style={{ color: 'var(--silver)', marginTop: 'var(--space-1)' }}>{rma.rejected_reason}</div>
          </div>
        )}

        {rma.return_label_url && (
          <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{ color: 'var(--white)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Return Shipping Label</div>
            {rma.return_tracking_number && (
              <div style={{ color: 'var(--silver)', marginBottom: 'var(--space-2)' }}>
                Tracking: {rma.return_tracking_number}
              </div>
            )}
            <a href={rma.return_label_url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'inline-block' }}>
              Download Label
            </a>
          </div>
        )}

        {rma.status === 'resolved' && rma.resolution_type && (
          <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{ color: 'var(--white)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Resolution</div>
            <div style={{ color: 'var(--silver)' }}>
              {rma.resolution_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
              {rma.resolved_at && <span> &middot; {new Date(rma.resolved_at).toLocaleString()}</span>}
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ color: 'var(--white)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Evidence</div>
          <RmaEvidenceUploader rmaId={rma.id} initialAttachments={signedAttachments} />
        </div>
      </div>
    </PageShell>
  );
}
