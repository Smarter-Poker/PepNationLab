/**
 * Reading Queue - auth-gated personalization surface.
 * Lists the signed-in user's reading queue with mark-as-read.
 */
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Reading Queue | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function ReadingQueuePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/research/reading-queue');

  const service = await createServiceClient();
  const { data: rows } = await service
    .from('user_reading_queue')
    .select('id, compound_slug, reference_id, position, read_at, created_at')
    .eq('user_id', user.id)
    .order('position', { ascending: true })
    .limit(100);

  const items = (rows ?? []) as Array<{ id: string; compound_slug: string | null; reference_id: string | null; position: number; read_at: string | null; created_at: string }>;

  // Resolve display names for all compound slugs in one query
  const slugs = items.map((r) => r.compound_slug).filter(Boolean) as string[];
  const displayNames: Record<string, string> = {};
  if (slugs.length > 0) {
    const { data: compounds } = await service
      .from('compounds')
      .select('slug, display_name')
      .in('slug', slugs);
    for (const c of compounds ?? []) {
      displayNames[c.slug] = c.display_name;
    }
  }
  const unread = items.filter((r) => !r.read_at);
  const read = items.filter((r) => !!r.read_at);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>Back To Research Library</Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>Reading Queue</h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1rem', marginTop: 'var(--space-2, 8px)' }}>
          Compounds And References You Have Queued To Read. {unread.length} Unread.
        </p>
      </header>

      {unread.length === 0 && read.length === 0 ? (
        <div className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          Your Reading Queue Is Empty. Use The Add-To-Queue Button On Any Monograph Or Reference.
        </div>
      ) : (
        <>
          {unread.length > 0 && (
            <section style={{ marginBottom: 'var(--space-5, 24px)' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--teal, #00C4BC)', marginBottom: 'var(--space-3, 12px)' }}>Unread ({unread.length})</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
                {unread.map((row) => (
                  row.compound_slug ? (
                    <Link key={row.id} href={`/research/${row.compound_slug}`} className="glass-panel" style={{ padding: 'var(--space-3, 12px) var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)', textDecoration: 'none', color: 'var(--white, #FFFFFF)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{displayNames[row.compound_slug ?? ''] || row.compound_slug}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--silver, #A8B4C0)' }}>Position {row.position}</span>
                    </Link>
                  ) : null
                ))}
              </div>
            </section>
          )}
          {read.length > 0 && (
            <section>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--silver, #A8B4C0)', marginBottom: 'var(--space-3, 12px)' }}>Read ({read.length})</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
                {read.map((row) => (
                  row.compound_slug ? (
                    <Link key={row.id} href={`/research/${row.compound_slug}`} className="glass-panel" style={{ padding: 'var(--space-2, 8px) var(--space-4, 16px)', borderRadius: 'var(--radius-md, 8px)', textDecoration: 'none', color: 'var(--silver, #A8B4C0)', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{displayNames[row.compound_slug ?? ''] || row.compound_slug}</span>
                      <span>Read {row.read_at ? new Date(row.read_at).toLocaleDateString() : ''}</span>
                    </Link>
                  ) : null
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
