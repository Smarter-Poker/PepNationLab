'use client';

/**
 * CitationExportButton -- dropdown to export a reference as BibTeX, RIS,
 * EndNote, or Plain Text. Either copies to clipboard or downloads.
 */

import { useState } from 'react';
import { toBibtex, toRis, toEndnote, toPlainText, type ReferenceLike } from '@/lib/research/citation-export';

interface Props {
  reference: ReferenceLike;
  filenameBase?: string;
}

type Fmt = 'bibtex' | 'ris' | 'endnote' | 'plain';

const LABELS: Record<Fmt, string> = {
  bibtex: 'BibTeX',
  ris: 'RIS',
  endnote: 'EndNote',
  plain: 'Plain Text',
};
const EXTS: Record<Fmt, string> = { bibtex: 'bib', ris: 'ris', endnote: 'enw', plain: 'txt' };

function buildText(fmt: Fmt, ref: ReferenceLike): string {
  if (fmt === 'bibtex') return toBibtex(ref);
  if (fmt === 'ris') return toRis(ref);
  if (fmt === 'endnote') return toEndnote(ref);
  return toPlainText(ref);
}

export default function CitationExportButton({ reference, filenameBase = 'citation' }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<Fmt | null>(null);

  async function copy(fmt: Fmt) {
    const text = buildText(fmt, reference);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(fmt);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      download(fmt);
    }
  }

  function download(fmt: Fmt) {
    const text = buildText(fmt, reference);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameBase}.${EXTS[fmt]}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'rgba(0,196,188,0.10)',
          border: '1px solid rgba(0,196,188,0.35)',
          color: '#00C4BC',
          padding: '6px 12px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
        aria-expanded={open}
      >
        Export Citation
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            minWidth: 220,
            background: '#162230',
            border: '1px solid rgba(168,180,192,0.25)',
            borderRadius: 10,
            zIndex: 30,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {(Object.keys(LABELS) as Fmt[]).map((fmt) => (
            <div key={fmt} style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid rgba(168,180,192,0.10)' }}>
              <button
                type="button"
                onClick={() => copy(fmt)}
                style={{
                  flex: 1,
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '8px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {copied === fmt ? 'Copied' : `Copy ${LABELS[fmt]}`}
              </button>
              <button
                type="button"
                onClick={() => download(fmt)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderLeft: '1px solid rgba(168,180,192,0.15)',
                  color: '#A8B4C0',
                  padding: '8px 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
