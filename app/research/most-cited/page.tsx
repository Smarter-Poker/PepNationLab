/**
 * Most-cited compounds in the literature. Sorted by pubmed_citation_count.
 * Will densify as /api/cron/pubmed-sync runs weekly.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier, wadaLabel } from '@/lib/compounds';

export const metadata: Metadata = {
  title: 'Most Cited | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function ResearchMostCitedPage() {
  const compounds = await getAllCompounds();
  const ranked = [...compounds]
    .map((c) => ({ ...c, citation_count: (c as unknown as { pubmed_citation_count?: number }).pubmed_citation_count ?? 0 }))
    .sort((a, b) => b.citation_count - a.citation_count);

  const withCitations = ranked.filter((c) => c.citation_count > 0);
  const withoutCitations = ranked.filter((c) => c.citation_count === 0);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          Most Cited Compounds
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Ranked By Curated Peer-Reviewed References And PubMed Citation Counts. Updated Weekly Via The PubMed Sync Cron.
        </p>
      </header>

      <section style={{ marginBottom: 'var(--space-6, 32px)' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--teal, #00C4BC)', marginBottom: 'var(--space-3, 12px)' }}>Ranked By Citation Count</h2>
        {withCitations.length === 0 ? (
          <div className="card-glass" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
            Citation Counts Will Populate When The Weekly PubMed Cron Has Run. Check Back Soon.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
            {withCitations.map((c, i) => {
              const t = evidenceTier(c.evidence_tier);
              return (
                <Link
                  key={c.slug}
                  href={`/research/${c.slug}`}
                  className="card-metal"
                  style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', alignItems: 'center', gap: 'var(--space-3, 12px)', padding: 'var(--space-3, 12px) var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)', textDecoration: 'none', color: 'var(--white, #FFFFFF)' }}
                >
                  <span style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', fontWeight: 700 }}>#{i + 1}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>{c.display_name}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--silver, #A8B4C0)' }}>{c.category} · <span style={{ color: t.color }}>{t.label}</span>{c.wada_status && c.wada_status !== 'not_listed' ? ` · ${wadaLabel(c.wada_status)}` : ''}</span>
                  </div>
                  <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--teal, #00C4BC)' }}>{c.citation_count}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {withoutCitations.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--silver, #A8B4C0)', marginBottom: 'var(--space-3, 12px)' }}>Awaiting Citation Sync ({withoutCitations.length})</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', marginBottom: 'var(--space-3, 12px)' }}>These Compounds Have Not Yet Been Scanned By The PubMed Cron Or Have No Indexed References.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2, 8px)' }}>
            {withoutCitations.map((c) => (
              <Link key={c.slug} href={`/research/${c.slug}`} className="card-metal" style={{ padding: '6px 12px', borderRadius: 'var(--radius-md, 8px)', textDecoration: 'none', color: 'var(--white, #FFFFFF)', fontSize: '0.85rem' }}>
                {c.display_name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
