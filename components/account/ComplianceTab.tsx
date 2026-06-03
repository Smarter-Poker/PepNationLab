'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';

interface Props {
  disclaimerAccepted: boolean;
  disclaimerAcceptedAt: string | null;
}

const DISCLAIMER_VERSION =
  process.env.NEXT_PUBLIC_DISCLAIMER_VERSION || 'v1.0';

export default function ComplianceTab({ disclaimerAccepted, disclaimerAcceptedAt }: Props) {
  const [accepted, setAccepted] = useState(disclaimerAccepted);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(disclaimerAcceptedAt);
  const [busy, setBusy] = useState(false);

  const reacknowledge = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/disclaimer-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layer: 'site_entry', version: DISCLAIMER_VERSION }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Failed To Re-Acknowledge.');
      }
      const now = new Date().toISOString();
      setAccepted(true);
      setAcceptedAt(now);
      toast.success('Disclaimer Re-Acknowledged. Thank You.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed To Re-Acknowledge.';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
        <h3 style={{ marginTop: 0, marginBottom: 'var(--space-2)', color: 'var(--teal)' }}>Research-Only Disclaimer</h3>
        <p style={{ color: 'var(--silver)', fontSize: '0.85rem', margin: '0 0 var(--space-4)', lineHeight: 1.6 }}>
          Every Researcher Must Acknowledge The Platform Disclaimer. You Can Re-Sign Below If You Need A Fresh Audit Entry.
        </p>

        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            columnGap: 'var(--space-4)',
            rowGap: 'var(--space-3)',
            margin: 0,
          }}
        >
          <dt style={{ color: 'var(--silver)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Current Version
          </dt>
          <dd style={{ color: 'var(--white)', fontFamily: 'monospace', margin: 0 }}>{DISCLAIMER_VERSION}</dd>

          <dt style={{ color: 'var(--silver)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Status
          </dt>
          <dd
            style={{
              margin: 0,
              color: accepted ? 'var(--teal)' : 'var(--red, #E53E3E)',
              fontWeight: 600,
            }}
          >
            {accepted ? 'Accepted' : 'Not Accepted'}
          </dd>

          <dt style={{ color: 'var(--silver)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Last Accepted
          </dt>
          <dd style={{ color: 'var(--white)', margin: 0 }}>
            {acceptedAt ? new Date(acceptedAt).toLocaleString() : '—'}
          </dd>
        </dl>

        <div style={{ marginTop: 'var(--space-5)' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={reacknowledge}
          >
            {busy ? 'Recording...' : 'Re-Acknowledge Disclaimer'}
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
        <h4 style={{ marginTop: 0, marginBottom: 'var(--space-2)', color: 'var(--teal)' }}>Documents</h4>
        <p style={{ color: 'var(--silver)', fontSize: '0.85rem', margin: '0 0 var(--space-4)', lineHeight: 1.6 }}>
          Review The Public Compliance Documents At Any Time.
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <li><a href="/terms"      className="link" style={{ color: 'var(--teal)' }}>Terms Of Service</a></li>
          <li><a href="/privacy"    className="link" style={{ color: 'var(--teal)' }}>Privacy Policy</a></li>
          <li><a href="/compliance" className="link" style={{ color: 'var(--teal)' }}>Compliance Info</a></li>
          <li><a href="/disclaimer" className="link" style={{ color: 'var(--teal)' }}>Research-Only Disclaimer</a></li>
        </ul>
      </div>
    </div>
  );
}
