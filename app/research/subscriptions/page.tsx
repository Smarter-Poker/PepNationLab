/**
 * Subscriptions - auth-gated personalization surface.
 * Lists the signed-in user's per-compound notification subscriptions.
 */
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Notification Subscriptions | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function SubscriptionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/research/subscriptions');

  const service = await createServiceClient();
  const { data: rows } = await service
    .from('user_compound_subscriptions')
    .select('compound_slug, notify_new_evidence, notify_wada_change, notify_recall, notify_trial_status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const items = (rows ?? []) as Array<{ compound_slug: string; notify_new_evidence: boolean; notify_wada_change: boolean; notify_recall: boolean; notify_trial_status: boolean; created_at: string }>;

  // Resolve display names in one query
  const slugs = [...new Set(items.map((r) => r.compound_slug).filter(Boolean))];
  const displayNames: Record<string, string> = {};
  if (slugs.length > 0) {
    const { data: compounds } = await service.from('compounds').select('slug, display_name').in('slug', slugs);
    for (const c of compounds ?? []) { displayNames[c.slug] = c.display_name; }
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>Back To Research Library</Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>Notification Subscriptions</h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1rem', marginTop: 'var(--space-2, 8px)' }}>
          You Will Be Notified When Tracked Compounds Get New Evidence, A Recall, Or A Trial Status Update.
        </p>
      </header>
      {items.length === 0 ? (
        <div className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          You Have No Active Subscriptions. Use The Subscribe Button On Any Monograph To Start Tracking.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
          {items.map((row) => (
            <div key={row.compound_slug} className="glass-panel" style={{ padding: 'var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2, 8px)' }}>
                <Link href={`/research/${row.compound_slug}`} style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--white, #FFFFFF)', textDecoration: 'none' }}>{displayNames[row.compound_slug] || row.compound_slug}</Link>
                <span style={{ fontSize: '0.72rem', color: 'var(--silver, #A8B4C0)' }}>Since {new Date(row.created_at).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'var(--space-2, 8px)' }}>
                {row.notify_new_evidence && <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', background: 'rgba(0,196,188,0.16)', color: 'var(--teal, #00C4BC)' }}>New Evidence</span>}
                {row.notify_wada_change && <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', background: 'rgba(246,173,85,0.16)', color: '#F6AD55' }}>Wada Status</span>}
                {row.notify_recall && <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', background: 'rgba(229,62,62,0.16)', color: 'var(--red-600, #E53E3E)' }}>Recalls</span>}
                {row.notify_trial_status && <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', background: 'rgba(0,229,255,0.12)', color: '#00E5FF' }}>Trial Status</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
