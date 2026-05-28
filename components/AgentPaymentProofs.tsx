'use client';

import { useEffect, useState } from 'react';

/**
 * Read-only payment-proof viewer for non-buyer surfaces (agent dashboard,
 * admin detail panel). Fetches via the same GET endpoint the buyer uses —
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
      <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)' }}>Loading Payment Proofs...</div>
    );
  }
  if (proofs.length === 0) {
    return (
      <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)' }}>No Payment Proofs Yet.</div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {proofs.map((p) => (
        <div
          key={p.id}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.76rem' }}
        >
          <span style={{ color: 'var(--silver)' }}>
            {new Date(p.uploaded_at).toLocaleString()}
          </span>
          <span style={{ color: 'var(--grey-400)' }}>{(p.size_bytes / 1024).toFixed(1)} KB</span>
          {p.signed_url && (
            <a
              href={p.signed_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--teal)', textDecoration: 'underline', marginLeft: 'auto' }}
            >
              View Proof
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
