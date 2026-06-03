'use client';

/**
 * SearchResults -- Google-style results page body. Renders the
 * InstantAnswerCard at position 0 (when intent is recognized), then a list of
 * ranked hits with ts_headline-style HTML snippets. Tracks click-throughs via
 * navigator.sendBeacon on result link clicks. Pagination at the bottom.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { evidenceTier, wadaLabel } from '@/lib/compounds';
import InstantAnswerCard, { type InstantAnswerPayload } from './InstantAnswerCard';

export interface SearchHit {
  slug: string;
  display_name: string;
  evidence_tier?: string;
  wada_status?: string;
  category?: string | null;
  compound_class?: string | null;
  plain_summary?: string | null;
  snippet?: string | null;
  score?: number;
}

export interface SearchIntent {
  kind: string;
  confidence?: number;
  slugs?: string[];
  area?: string | null;
}

export interface SearchResultsProps {
  query: string;
  results: SearchHit[];
  intent: SearchIntent | null;
  instantAnswer: InstantAnswerPayload | null;
  total: number;
  latencyMs?: number;
  limit?: number;
  offset?: number;
}

function trackClick(query: string, slug: string, position: number, intent: SearchIntent | null) {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify({
    query,
    clickedSlug: slug,
    clickedPosition: position,
    intent: intent?.kind ?? 'none',
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/research/click', new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch('/api/research/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    /* swallow */
  }
}

export default function SearchResults({
  query,
  results,
  intent,
  instantAnswer,
  total,
  latencyMs,
  limit = 20,
  offset = 0,
}: SearchResultsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.floor(offset / limit) + 1;

  const pages = useMemo(() => {
    const out: number[] = [];
    const start = Math.max(1, page - 3);
    const end = Math.min(totalPages, page + 3);
    for (let i = start; i <= end; i++) out.push(i);
    return out;
  }, [page, totalPages]);

  function gotoPage(p: number) {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
    params.set('q', query);
    params.set('offset', String((p - 1) * limit));
    router.push(`/research/search?${params.toString()}`);
  }

  return (
    <div style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '0 16px 48px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, color: '#A8B4C0', fontSize: 13, marginBottom: 18 }}>
        <span>
          About {total.toLocaleString()} {total === 1 ? 'Result' : 'Results'} For{' '}
          <strong style={{ color: '#FFFFFF' }}>{query}</strong>
        </span>
        {typeof latencyMs === 'number' && <span>({(latencyMs / 1000).toFixed(2)} Seconds)</span>}
      </div>

      {instantAnswer && instantAnswer.kind !== 'none' && (
        <InstantAnswerCard payload={instantAnswer} />
      )}

      {results.length === 0 ? (
        <div className="card-glass" style={{ padding: 28, borderRadius: 14, textAlign: 'center', color: '#A8B4C0' }}>
          No Results Match That Query Yet. Try A Broader Term, Or Browse The{' '}
          <Link href="/research" style={{ color: '#00C4BC' }}>Research Library Home</Link>.
        </div>
      ) : (
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 16 }}>
          {results.map((hit, i) => {
            const t = hit.evidence_tier ? evidenceTier(hit.evidence_tier) : null;
            return (
              <li
                key={hit.slug}
                className="card"
                style={{
                  padding: '16px 18px',
                  borderRadius: 12,
                  background: 'rgba(15,25,35,0.6)',
                  border: '1px solid rgba(168,180,192,0.18)',
                }}
              >
                <Link
                  href={`/research/${hit.slug}`}
                  onClick={() => trackClick(query, hit.slug, i + 1, intent)}
                  style={{
                    color: '#00C4BC',
                    fontSize: 18,
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  {hit.display_name}
                </Link>
                <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {t && (
                    <span style={{
                      fontSize: 10, color: t.color, border: `1px solid ${t.color}`,
                      padding: '2px 8px', borderRadius: 999, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>{t.label}</span>
                  )}
                  {hit.wada_status && (hit.wada_status === 'prohibited' || hit.wada_status === 'prohibited_males') && (
                    <span style={{
                      fontSize: 10, color: '#E53E3E', border: '1px solid #E53E3E',
                      padding: '2px 8px', borderRadius: 999, fontWeight: 700,
                    }}>{wadaLabel(hit.wada_status)}</span>
                  )}
                  {hit.category && <span style={{ fontSize: 12, color: '#A8B4C0' }}>{hit.category}</span>}
                </div>
                <p
                  className="search-snippet"
                  style={{ color: '#D0DAE4', fontSize: 14, lineHeight: 1.6, marginTop: 8, marginBottom: 0 }}
                  dangerouslySetInnerHTML={{
                    __html: hit.snippet || hit.plain_summary || 'No Summary Available Yet.',
                  }}
                />
              </li>
            );
          })}
        </ol>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 28, flexWrap: 'wrap' }}>
          {page > 1 && (
            <button onClick={() => gotoPage(page - 1)} className="btn-ghost" style={pgBtn}>
              Previous
            </button>
          )}
          {pages.map((p) => (
            <button
              key={p}
              onClick={() => gotoPage(p)}
              className={p === page ? 'btn-primary' : 'btn-ghost'}
              style={{ ...pgBtn, fontWeight: p === page ? 800 : 500 }}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ))}
          {page < totalPages && (
            <button onClick={() => gotoPage(page + 1)} className="btn-ghost" style={pgBtn}>
              Next
            </button>
          )}
        </div>
      )}

      <style>{`
        .search-snippet mark {
          background: rgba(0,196,188,0.22);
          color: #FFFFFF;
          padding: 0 2px;
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}

const pgBtn: React.CSSProperties = {
  minWidth: 36,
  padding: '6px 12px',
  fontSize: 13,
  borderRadius: 8,
};
