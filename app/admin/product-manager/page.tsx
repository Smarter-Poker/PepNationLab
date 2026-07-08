import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import AgentStoreProducts from '@/components/AgentStoreProducts';

export const dynamic = 'force-dynamic';

/**
 * Product Manager - direct pricing control for the MAIN store (the admin's
 * own house storefront, the store every guest and researcher browses).
 *
 * Reuses the exact editor agents use (AgentStoreProducts) mounted with the
 * admin's own agent id: the /api/agent/products routes always operate on the
 * session user's storefront, and the admin owns the house store, so retail
 * price, margin, and sale edits made here hit the main store directly.
 * Storefront prices update immediately; the Top 10 on every city landing
 * page follows within 5 minutes via ISR.
 */
export default async function AdminProductManagerPage() {
  const gate = await requireAdmin();
  if (!gate.ok) redirect('/login');

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'var(--space-6)' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ color: 'var(--white)', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 'var(--space-2)' }}>
          Product Manager
        </h1>
        <p style={{ color: 'var(--silver)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
          Manually Adjust Retail Pricing, Margins, Sale Prices, And Visibility For Every Peptide In The Main Store.
          Changes Go Live On The Storefront Immediately And Reach All City Landing Pages Within 5 Minutes.
        </p>
      </div>
      <AgentStoreProducts agentId={gate.userId} />
    </div>
  );
}
