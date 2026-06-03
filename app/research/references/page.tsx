/**
 * References Library — aggregates every source cited across all compounds into a
 * single deduped, searchable bibliography. Each source opens in the in-app
 * overlay (never redirects away). Server component; client browser handles search.
 *
 * Research-Use-Only framing.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Library } from 'lucide-react';
import { getAllCompounds } from '@/lib/compounds-server';
import ReferencesBrowser, { type RefEntry } from '@/components/research/ReferencesBrowser';

export const metadata: Metadata = {
  title: 'References Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

function hostOf(url: string): string {
  try {
    const u = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default async function ReferencesPage() {
  const compounds = await getAllCompounds();

  // Aggregate url -> set of citing compounds (deduped, case-insensitive on url).
  const map = new Map<string, RefEntry>();
  for (const c of compounds) {
    for (const raw of c.sources || []) {
      const url = (raw || '').trim();
      if (!url) continue;
      const key = url.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        if (!existing.citedBy.some((x) => x.slug === c.slug)) {
          existing.citedBy.push({ slug: c.slug, name: c.display_name });
        }
      } else {
        map.set(key, { url, host: hostOf(url), citedBy: [{ slug: c.slug, name: c.display_name }] });
      }
    }
  }

  const refs = Array.from(map.values()).sort(
    (a, b) => b.citedBy.length - a.citedBy.length || a.host.localeCompare(b.host),
  );

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          <Library size={24} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 10, color: 'var(--teal, #00C4BC)' }} />
          References Library
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '660px' }}>
          Every Source Behind The Catalog, In One Place — Regulatory Labels, Peer-Reviewed Literature, And Reference
          Databases. Each Link Opens In-App. For Laboratory Research Only.
        </p>
      </header>

      <ReferencesBrowser refs={refs} />
    </div>
  );
}
