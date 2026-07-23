'use client';

import { useState } from 'react';
import DisclaimerGate from '@/components/DisclaimerGate';

/**
 * First-login Research-Only acknowledgment. Renders the shared 3-box
 * DisclaimerGate; on accept, persists the acknowledgment via
 * /api/disclaimer/accept and hard-navigates to the intended destination so the
 * middleware re-evaluates with the updated flag.
 */
export default function AcceptDisclaimerClient({ redirectTo }: { redirectTo: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/disclaimer/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        setError(data?.error || 'Something Went Wrong. Please Try Again.');
        setSubmitting(false);
        return;
      }
      window.location.href = redirectTo;
    } catch {
      setError('Network Error. Please Try Again.');
      setSubmitting(false);
    }
  };

  return (
    <>
      <DisclaimerGate onAccept={handleAccept} />
      {error && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            background: 'var(--red, #E53E3E)',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: '0.85rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          {error}
        </div>
      )}
    </>
  );
}
