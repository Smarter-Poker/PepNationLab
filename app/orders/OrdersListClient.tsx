'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

/**
 * Reorder button — used inline on the researcher's order history rows.
 *
 * The order list itself is server-rendered for SEO / initial-paint reasons,
 * but the Reorder action has to be a client interaction so we keep this in
 * its own client component and embed it inside the server-rendered row.
 */

interface Props {
  orderId: string;
}

export default function ReorderButton({ orderId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onReorder(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/researcher/orders/${orderId}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || 'Failed To Create Reorder.');
        setBusy(false);
        return;
      }
      const skipped = Array.isArray(data.skipped) ? data.skipped : [];
      if (skipped.length > 0) {
        toast.warning(
          `Reorder Created. ${skipped.length} Item${skipped.length === 1 ? '' : 's'} Skipped: ${skipped
            .map((s: { product_name?: string }) => s.product_name || 'Item')
            .join(', ')}.`,
          { duration: 7000 }
        );
      } else {
        toast.success('Reorder Created.');
      }
      router.push(`/orders/${data.orderId}`);
      router.refresh();
    } catch {
      toast.error('Failed To Create Reorder.');
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onReorder}
      disabled={busy}
      className="btn btn-secondary"
      style={{ fontSize: '0.75rem', padding: '6px 12px' }}
    >
      {busy ? 'Reordering...' : 'Reorder'}
    </button>
  );
}

interface ViewLinkProps {
  href: string;
}

export function ViewLink({ href }: ViewLinkProps) {
  return (
    <Link
      href={href}
      className="btn btn-primary"
      style={{ fontSize: '0.75rem', padding: '6px 12px' }}
    >
      View
    </Link>
  );
}
