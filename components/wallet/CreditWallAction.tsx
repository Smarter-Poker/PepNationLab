'use client';

/**
 * CreditWallAction
 *
 * Rendered wherever an agent's order or restock is blocked by their credit
 * limit. Gives the agent a direct path to request a credit increase without
 * leaving the page: fetches the current limit from the wallet summary, then
 * opens the same CreditIncreaseForm the wallet uses. Requests land in the
 * admin queue at /admin/credit-increases.
 */

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import CreditIncreaseForm from './CreditIncreaseForm';

export default function CreditWallAction() {
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  async function openForm() {
    setLoading(true);
    try {
      const res = await fetch('/api/agent/wallet/summary', { cache: 'no-store' });
      const j = res.ok ? await res.json() : null;
      setLimit(Number(j?.creditLimit ?? 0));
    } catch {
      setLimit(0);
    } finally {
      setLoading(false);
      setOpen(true);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={openForm}
        disabled={loading}
        className="btn-secondary"
        style={{ padding: '10px 16px', borderRadius: 8, minHeight: 44, fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}
      >
        {loading ? 'Loading...' : 'Request Credit Increase'}
      </button>
      <Link href="/wallet" style={{ color: 'var(--teal)', fontWeight: 700, fontSize: '0.85rem' }}>
        Open Wallet
      </Link>
      {open && (
        <CreditIncreaseForm
          currentLimit={limit}
          onClose={() => setOpen(false)}
          onSubmitted={() => {
            setOpen(false);
            toast.success('Request Submitted. Admin Will Review It Shortly.');
          }}
        />
      )}
    </div>
  );
}
