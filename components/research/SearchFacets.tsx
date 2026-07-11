'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SearchFacets({ query }: { query: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const commonFacets = [
    { label: 'Peptides', field: 'category', value: 'peptide' },
    { label: 'Nootropics', field: 'category', value: 'nootropic' },
    { label: 'Weight Loss', field: 'category', value: 'weight loss' },
    { label: 'Top Tier', field: 'tier', value: 'a' }
  ];

  const handleToggle = (facet: { field: string, value: string }) => {
    // Basic approach: If the query contains `field:value`, remove it. Otherwise add it.
    const facetStr = `${facet.field}:"${facet.value}"`;
    // We check against the exact facet string, or the facet field without quotes if it's a single word
    const isSingleWord = !facet.value.includes(' ');
    const alternateFacetStr = isSingleWord ? `${facet.field}:${facet.value}` : facetStr;

    let newQuery = query;
    if (query.toLowerCase().includes(facetStr.toLowerCase())) {
      newQuery = query.replace(new RegExp(facetStr, 'ig'), '').trim();
    } else if (isSingleWord && query.toLowerCase().includes(alternateFacetStr.toLowerCase())) {
      newQuery = query.replace(new RegExp(alternateFacetStr, 'ig'), '').trim();
    } else {
      newQuery = `${query} ${facetStr}`.trim();
    }

    const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
    params.set('q', newQuery);
    params.set('offset', '0'); // reset pagination
    router.push(`/research/search?${params.toString()}`);
  };

  const isActive = (facet: { field: string, value: string }) => {
    const facetStr = `${facet.field}:"${facet.value}"`;
    const isSingleWord = !facet.value.includes(' ');
    const alternateFacetStr = isSingleWord ? `${facet.field}:${facet.value}` : facetStr;
    const qLower = query.toLowerCase();
    return qLower.includes(facetStr.toLowerCase()) || (isSingleWord && qLower.includes(alternateFacetStr.toLowerCase()));
  };

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px', justifyContent: 'center' }}>
      {commonFacets.map(f => {
        const active = isActive(f);
        return (
          <button
            key={f.label}
            onClick={() => handleToggle(f)}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: active ? '1px solid var(--teal)' : '1px solid rgba(168,180,192,0.3)',
              background: active ? 'rgba(0,196,188,0.15)' : 'rgba(255,255,255,0.03)',
              color: active ? 'var(--teal)' : 'var(--silver)',
              transition: 'all 0.2s ease',
            }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
