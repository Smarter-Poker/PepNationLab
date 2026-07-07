'use client';

/**
 * MonographCitations - CLIENT component.
 *
 * Phase 2 AIO / Directive D: surfaces the compound's references (PubMed, NCBI,
 * ClinicalTrials, etc.) as real HTML anchors in the INITIAL server-rendered
 * output so AI answer engines and search crawlers can see the outbound
 * authority links that establish trustworthiness.
 *
 * Omega Protocol (Law 3): the anchors carry the real destination in `href`
 * (which crawlers read) but every click is intercepted and rendered inside the
 * app via IframeModal - users are never navigated off pepnationlab.com.
 *
 * Because Next.js server-renders client components, these anchors appear in the
 * initial HTML (unlike the tab-gated Sources tab), which is what AI crawlers
 * that do not execute JavaScript need.
 *
 * Title Case headings/labels. No emojis.
 */

import { useState } from 'react';
import IframeModal from '@/components/ui/IframeModal';

const teal = 'var(--teal, #00C4BC)';

function toUrl(src: string): string | null {
  const s = src.trim();
  if (/^https?:\/\//i.test(s)) return s;
  // Bare domains / paths like "pubmed.ncbi.nlm.nih.gov/12345"
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(s)) return `https://${s}`;
  return null;
}

function labelFor(url: string, fallback: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('pubmed') || host.includes('ncbi')) return 'PubMed / NCBI Reference';
    if (host.includes('clinicaltrials')) return 'ClinicalTrials.gov Record';
    if (host.includes('ebi.ac.uk') || host.includes('chembl')) return 'ChEMBL Database';
    if (host.includes('uniprot')) return 'UniProt Entry';
    if (host.includes('doi')) return 'DOI Reference';
    return host;
  } catch {
    return fallback;
  }
}

export default function MonographCitations({
  sources,
  compoundName,
}: {
  sources: string[];
  compoundName: string;
}) {
  const [modalUrl, setModalUrl] = useState<string | null>(null);
  const clean = (sources ?? []).map((s) => (s ?? '').trim()).filter(Boolean);
  if (clean.length === 0) return null;

  return (
    <section
      aria-label={`${compoundName} References And Citations`}
      style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 var(--space-4, 16px) var(--space-6, 32px)', color: 'var(--white, #fff)' }}
    >
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 10px' }}>References And Citations</h2>
      <ol style={{ margin: 0, paddingLeft: '1.3rem', lineHeight: 1.7 }}>
        {clean.map((src, i) => {
          const url = toUrl(src);
          if (!url) {
            return (
              <li key={i} style={{ color: 'var(--silver, #D0DAE4)' }}>
                {src}
              </li>
            );
          }
          return (
            <li key={i}>
              {/* Omega Protocol: real href for crawlers, click intercepted into IframeModal. */}
              <a
                href={url}
                onClick={(e) => {
                  e.preventDefault();
                  setModalUrl(url);
                }}
                style={{ color: teal, textDecoration: 'none', fontWeight: 600 }}
              >
                {labelFor(url, src)}
              </a>
            </li>
          );
        })}
      </ol>

      {modalUrl && <IframeModal url={modalUrl} title="Research Reference" onClose={() => setModalUrl(null)} />}
    </section>
  );
}
