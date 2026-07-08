/**
 * /research/search -- Google-style results page. Fetches the search results
 * and instant-answer payload in parallel via the v3 API and renders them with
 * <SearchResults>. The header carries a prefilled <GlobalSearchBar> so the
 * user can refine.
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import Link from 'next/link';
import GlobalSearchBar from '@/components/research/GlobalSearchBar';
import SearchResults, { type SearchHit, type SearchIntent } from '@/components/research/SearchResults';
import BrowseSurfaceNav from '@/components/research/BrowseSurfaceNav';
import type { InstantAnswerPayload } from '@/components/research/InstantAnswerCard';

export const metadata: Metadata = {
  title: 'Search The Research Library | Pep Nation Lab',
  robots: { index: false, follow: true },
};

type SP = { q?: string; offset?: string; autoCorrect?: string };

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'pepnationlab.com';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${host}`;
}

interface SearchApiResponse {
  results?: SearchHit[];
  intent?: SearchIntent;
  total?: number;
  latencyMs?: number;
  note?: string;
  correctedQuery?: string | null;
  originalQuery?: string | null;
}

async function fetchSearch(query: string, offset: number, autoCorrect: string, base: string): Promise<SearchApiResponse> {
  try {
    const url = `${base}/api/research/search?q=${encodeURIComponent(query)}&limit=20&offset=${offset}&autoCorrect=${autoCorrect}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return {};
    return (await res.json()) as SearchApiResponse;
  } catch {
    return {};
  }
}

async function fetchInstantAnswer(query: string, base: string): Promise<InstantAnswerPayload | null> {
  try {
    const url = `${base}/api/research/instant-answer?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as InstantAnswerPayload;
    return data;
  } catch {
    return null;
  }
}

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const query = (sp?.q ?? '').trim();
  const offset = Math.max(0, Number(sp?.offset ?? 0) || 0);
  const autoCorrect = sp?.autoCorrect ?? 'true';

  if (!query) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 16px 64px' }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, color: '#FFFFFF', fontSize: 28, fontWeight: 900 }}>
            Search The Research Library
          </h1>
          <p style={{ color: '#A8B4C0', marginTop: 8 }}>
            Type A Compound, Mechanism, Or Research Question Below.
          </p>
        </header>
        <GlobalSearchBar />
        <div style={{ marginTop: 40 }}>
          <BrowseSurfaceNav />
        </div>
      </div>
    );
  }

  const base = await getBaseUrl();
  const [searchData, instantAnswer] = await Promise.all([
    fetchSearch(query, offset, autoCorrect, base),
    fetchInstantAnswer(query, base),
  ]);

  const results = searchData.results ?? [];
  const intent = searchData.intent ?? null;
  const total = searchData.total ?? results.length;
  const latencyMs = searchData.latencyMs;

  return (
    <div>
      <div
        style={{
          position: 'sticky',
          top: 60,
          zIndex: 50,
          padding: '16px 16px 12px',
          background: 'rgba(5,10,15,0.92)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          }}
      >
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/research" style={{ color: '#00C4BC', fontSize: 13, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Research
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <GlobalSearchBar initialQuery={query} compact />
          </div>
        </div>
      </div>

      <div style={{ padding: '28px 0 0' }}>
        <Suspense fallback={<div style={{ textAlign: 'center', padding: '60px', color: 'var(--silver, #A8B4C0)' }}>Loading Results…</div>}>
          <SearchResults
            query={query}
            results={results}
            intent={intent}
            instantAnswer={instantAnswer}
            total={total}
            latencyMs={latencyMs}
            limit={20}
            offset={offset}
            correctedQuery={searchData.correctedQuery}
            originalQuery={searchData.originalQuery}
          />
        </Suspense>
      </div>

      <div style={{ maxWidth: 760, margin: '32px auto 0', padding: '0 16px 48px' }}>
        <BrowseSurfaceNav />
      </div>
    </div>
  );
}
