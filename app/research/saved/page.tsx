/**
 * Saved Compounds — auth-gated personalization surface.
 * Lists the signed-in user's saved compounds across collections.
 */
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Saved Compounds | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function SavedCompoundsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/research/saved');

  const service = await createServiceClient();
  const { data: rows } = await service
    .from('user_saved_compounds')
    .select('compound_slug, collection_name, notes, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const items = (rows ?? []) as Array<{ compound_slug: string; collection_name: string; notes: string | null; created_at: string }>;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>Back To Research Library</Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>Saved Compounds</h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1rem', marginTop: 'var(--space-2, 8px)' }}>
          Your Personal Reading List Of Compounds Across All Collections.
        </p>
      </header>
      {items.length === 0 ? (
        <div className="card-metal" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          You Have Not Saved Any Compounds Yet. Use The Save Button On Any Monograph To Add It Here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
          {items.map((row) => (
            <Link key={`${row.collection_name}-${row.compound_slug}`} href={`/research/${row.compound_slug}`} className="card-metal" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3, 12px)', padding: 'var(--space-3, 12px) var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)', textDecoration: 'none', color: 'var(--white, #FFFFFF)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>{row.compound_slug}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--silver, #A8B4C0)' }}>
                  Collection: {row.collection_name}{row.notes ? ` · ${row.notes}` : ''}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--silver, #A8B4C0)' }}>{new Date(row.created_at).toLocaleDateString()}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
