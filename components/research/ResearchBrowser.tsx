'use client';

/**
 * Research Browser — client-side faceted search over the compound catalog.
 * Pure presentation: filtering happens in-memory on props already fetched by
 * the parent server component. Research-use-only framing throughout.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import {
  type Compound,
  EVIDENCE_TIER,
  evidenceTier,
  RESEARCH_AREAS,
  WADA_LABEL,
  wadaLabel,
} from '@/lib/compounds';

const ALL = 'all';

const selectStyle: React.CSSProperties = {
  background: 'var(--grey-400, #162230)',
  color: 'var(--white, #FFFFFF)',
  border: '1px solid rgba(168,180,192,0.25)',
  borderRadius: 'var(--radius-md, 8px)',
  padding: 'var(--space-2, 8px) var(--space-3, 12px)',
  fontSize: '0.9rem',
};

export default function ResearchBrowser({ compounds }: { compounds: Compound[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>(ALL);
  const [tier, setTier] = useState<string>(ALL);
  const [area, setArea] = useState<string>(ALL);
  const [wada, setWada] = useState<string>(ALL);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const c of compounds) {
      if (c.category) set.add(c.category);
    }
    return Array.from(set).sort();
  }, [compounds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return compounds.filter((c) => {
      if (q) {
        const haystack = [c.display_name, ...(c.aliases ?? [])].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (category !== ALL && c.category !== category) return false;
      if (tier !== ALL && c.evidence_tier !== tier) return false;
      if (area !== ALL && !(c.research_areas ?? []).includes(area)) return false;
      if (wada !== ALL && c.wada_status !== wada) return false;
      return true;
    });
  }, [compounds, query, category, tier, area, wada]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-3, 12px)',
          alignItems: 'center',
          marginBottom: 'var(--space-5, 24px)',
        }}
      >
        <div
          style={{
            position: 'relative',
            flex: '1 1 220px',
            minWidth: '200px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 'var(--space-3, 12px)',
              color: 'var(--silver, #A8B4C0)',
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Compounds Or Aliases"
            aria-label="Search Compounds Or Aliases"
            style={{
              ...selectStyle,
              width: '100%',
              paddingLeft: 'calc(var(--space-3, 12px) + 24px)',
            }}
          />
        </div>

        <select
          aria-label="Filter By Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={selectStyle}
        >
          <option value={ALL}>All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter By Evidence Tier"
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          style={selectStyle}
        >
          <option value={ALL}>All Evidence Tiers</option>
          {Object.keys(EVIDENCE_TIER).map((key) => (
            <option key={key} value={key}>
              {EVIDENCE_TIER[key].label}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter By Research Area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          style={selectStyle}
        >
          <option value={ALL}>All Research Areas</option>
          {Object.keys(RESEARCH_AREAS).map((key) => (
            <option key={key} value={key}>
              {RESEARCH_AREAS[key].label}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter By WADA Status"
          value={wada}
          onChange={(e) => setWada(e.target.value)}
          style={selectStyle}
        >
          <option value={ALL}>All WADA Statuses</option>
          {Object.keys(WADA_LABEL).map((key) => (
            <option key={key} value={key}>
              {WADA_LABEL[key]}
            </option>
          ))}
        </select>
      </div>

      <p
        style={{
          color: 'var(--silver, #A8B4C0)',
          fontSize: '0.9rem',
          marginBottom: 'var(--space-4, 16px)',
        }}
      >
        Showing {filtered.length} {filtered.length === 1 ? 'Compound' : 'Compounds'}
      </p>

      {filtered.length === 0 ? (
        <div
          className="card-glass"
          style={{
            padding: 'var(--space-6, 32px)',
            textAlign: 'center',
            color: 'var(--silver, #A8B4C0)',
            borderRadius: 'var(--radius-lg, 12px)',
          }}
        >
          No Compounds Match Your Filters. Try Broadening Your Search.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 'var(--space-4, 16px)',
          }}
        >
          {filtered.map((c) => {
            const t = evidenceTier(c.evidence_tier);
            const aliasLine = (c.aliases ?? []).slice(0, 3).join(', ');
            return (
              <Link
                key={c.slug}
                href={`/research/${c.slug}`}
                className="card-metal"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2, 8px)',
                  padding: 'var(--space-4, 16px)',
                  borderRadius: 'var(--radius-lg, 12px)',
                  textDecoration: 'none',
                  color: 'var(--white, #FFFFFF)',
                  height: '100%',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignSelf: 'flex-start',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: t.color,
                    border: `1px solid ${t.color}`,
                    borderRadius: '999px',
                    padding: '2px 10px',
                  }}
                >
                  {t.label}
                </span>
                <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>{c.display_name}</span>
                {aliasLine && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)' }}>{aliasLine}</span>
                )}
                {c.category && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--teal, #00C4BC)',
                      marginTop: 'auto',
                    }}
                  >
                    {c.category}
                  </span>
                )}
                {c.wada_status && c.wada_status !== 'not_listed' && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--silver, #A8B4C0)' }}>
                    {wadaLabel(c.wada_status)}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
