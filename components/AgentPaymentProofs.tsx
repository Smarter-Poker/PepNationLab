'use client';

import { useEffect, useState } from 'react';
import IframeLink from '@/components/ui/IframeLink';

/**
 * Read-only payment-proof viewer for non-buyer surfaces (agent dashboard,
 * admin detail panel). Fetches via the same GET endpoint the buyer uses -
 * RLS on `payment_proofs` lets the order's agent (or admin) read.
 */
interface Proof {
  id: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  verified_at: string | null;
  signed_url: string | null;
}

export default function AgentPaymentProofs({ orderId }: { orderId: string }) {
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/researcher/payment-proof?orderId=${encodeURIComponent(orderId)}`);
        const json = await res.json();
        if (cancelled || !res.ok) return;
        setProofs(json.data || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (loading) {
    return (
      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', padding: '12px' }}>Loading Payment Proofs...</div>
    );
  }
  if (proofs.length === 0) {
    return (
      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '6px' }}>No Payment Proofs Yet.</div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {proofs.map((p) => (
        <div
          key={p.id}
          className="glass-panel"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '0.76rem', padding: '8px 12px' }}
        >
          <span style={{ color: 'rgba(255,255,255,0.8)' }}>
            {new Date(p.uploaded_at).toLocaleString()}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>{(p.size_bytes / 1024).toFixed(1)} KB</span>
          {p.signed_url && (
            <IframeLink
              href={p.signed_url}
              style={{ color: '#00E5FF', textDecoration: 'none', marginLeft: 'auto', fontWeight: 600, border: '1px solid rgba(0,229,255,0.3)', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,229,255,0.1)' }}
            >
              View Proof
            </IframeLink>
          )}
        </div>
      ))}
    </div>
  );
}
