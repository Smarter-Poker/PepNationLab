/**
 * Browse compounds bucketed by route of administration. Server component.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier } from '@/lib/compounds';
import BrowseFilterShell from '@/components/research/BrowseFilterShell';

export const metadata: Metadata = {
  title: 'Browse Peptides By Administration Route | Research Library | Pep Nation Lab',
  description: 'Browse research peptides by administration route — subcutaneous, intramuscular, intranasal, oral, and topical. Understand delivery method differences. Research use only.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/by-route' },
  openGraph: {
    title: 'Peptides By Administration Route | Pep Nation Lab',
    description: 'Browse research peptides organized by administration route — subcutaneous, intranasal, oral, and more.',
    url: 'https://pepnationlab.com/research/by-route',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Peptides By Route' }],
  },
};

export const dynamic = 'force-dynamic';

interface RouteRow {
  slug: string;
  display_name: string;
  category: string | null;
  evidence_tier: string;
  plain_summary: string | null;
  route_of_admin: string[] | null;
}

const ROUTE_LABELS: Record<string, string> = {
  subcutaneous: 'Subcutaneous',
  intranasal: 'Intranasal',
  oral: 'Oral',
  intramuscular: 'Intramuscular',
  topical: 'Topical',
  iv: 'Intravenous',
  unspecified: 'Unspecified',
  other: 'Other Routes',
};

function normalizeRoute(r: string): string {
  const lower = r.trim().toLowerCase();
  if (lower.startsWith('sub')) return 'subcutaneous';
  if (lower.startsWith('intran') || lower.startsWith('nasal')) return 'intranasal';
  if (lower.startsWith('oral')) return 'oral';
  if (lower.startsWith('intram') || lower === 'im') return 'intramuscular';
  if (lower.startsWith('top')) return 'topical';
  if (lower === 'iv' || lower.startsWith('intrav')) return 'iv';
  // Any unrecognized string -> bucket as 'other' so it's not silently dropped
  return 'other';
}

function CompoundCard({ c }: { c: RouteRow }) {
  const t = evidenceTier(c.evidence_tier);
  return (
    <Link
      href={`/research/${c.slug}`}
      className="glass-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1, 4px)',
        padding: 'var(--space-3, 12px) var(--space-4, 16px)',
        borderRadius: 'var(--radius-lg, 12px)',
        textDecoration: 'none',
        color: 'var(--white, #FFFFFF)',
      }}
    >
      <span style={{ fontSize: '0.7rem', color: t.color, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
        {t.label}
      </span>
      <span style={{ fontSize: '1rem', fontWeight: 700 }}>{c.display_name}</span>
      {c.plain_summary && (
        <span
          style={{
            fontSize: '0.78rem',
            color: 'var(--silver, #A8B4C0)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {c.plain_summary}
        </span>
      )}
    </Link>
  );
}

export default async function ResearchByRoutePage() {
  const rows = (await getAllCompounds()) as unknown as RouteRow[];

  const buckets = new Map<string, RouteRow[]>();
  for (const r of rows) {
    const routes = (r.route_of_admin ?? []).map(normalizeRoute);
    if (routes.length === 0) {
      const k = 'unspecified';
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(r);
      continue;
    }
    for (const route of routes) {
      if (!buckets.has(route)) buckets.set(route, []);
      buckets.get(route)!.push(r);
    }
  }

  const order = ['subcutaneous', 'intranasal', 'oral', 'intramuscular', 'topical', 'iv', 'unspecified', 'other'];
  const keys = order.filter((k) => buckets.has(k));

  const shellGroups = keys.map((k) => {
    const items = buckets.get(k)!;
    return {
      key: k,
      label: ROUTE_LABELS[k] ?? k,
      count: items.length,
      children: (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3, 12px)' }}>
          {items.map((c) => <CompoundCard key={c.slug} c={c} />)}
        </div>
      ),
    };
  });

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={16} /> Back To Research Library
        </Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          Browse By Route Of Administration
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Compounds Grouped By Route Of Administration. Select A Delivery Method Below.
        </p>
      </header>

      {shellGroups.length === 0 ? (
        <div className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          Route Annotations Will Populate Once The DailyMed Sync Cron Runs.
        </div>
      ) : (
        <BrowseFilterShell groups={shellGroups} emptyMessage="No Compounds In This Route Category Yet." />
      )}
    </div>
  );
}
