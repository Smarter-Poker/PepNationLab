'use client';

/**
 * SequenceViewer — renders a peptide's amino-acid sequence as color-coded residue
 * tiles (by side-chain class), with a residue count, a legend, and a copy button.
 * Accepts 3-letter dash-joined sequences (Gly-Glu-Pro-...) or contiguous 1-letter
 * codes (QEQLERALNSS), and gracefully renders nothing when the "sequence" is a
 * descriptive string (small molecule, combination, n/a, etc.) — the monograph
 * still shows the raw sequence text as a fact in that case.
 *
 * Research-use-only: a structural reference view, not dosing or medical content.
 */

import { useState } from 'react';

const THREE_TO_ONE: Record<string, string> = {
  ala: 'A', arg: 'R', asn: 'N', asp: 'D', cys: 'C', gln: 'Q', glu: 'E', gly: 'G',
  his: 'H', ile: 'I', leu: 'L', lys: 'K', met: 'M', phe: 'F', pro: 'P', ser: 'S',
  thr: 'T', trp: 'W', tyr: 'Y', val: 'V',
};

const ONE_LETTER = 'ACDEFGHIKLMNPQRSTVWY';

const RESIDUE_NAME: Record<string, string> = {
  A: 'Alanine', R: 'Arginine', N: 'Asparagine', D: 'Aspartate', C: 'Cysteine',
  Q: 'Glutamine', E: 'Glutamate', G: 'Glycine', H: 'Histidine', I: 'Isoleucine',
  L: 'Leucine', K: 'Lysine', M: 'Methionine', F: 'Phenylalanine', P: 'Proline',
  S: 'Serine', T: 'Threonine', W: 'Tryptophan', Y: 'Tyrosine', V: 'Valine',
};

type ResidueClass = 'acidic' | 'basic' | 'hydrophobic' | 'polar';

function residueClass(aa: string): ResidueClass {
  if (aa === 'D' || aa === 'E') return 'acidic';
  if (aa === 'K' || aa === 'R' || aa === 'H') return 'basic';
  if ('AVLIMFWP'.includes(aa)) return 'hydrophobic';
  return 'polar';
}

const CLASS_COLOR: Record<ResidueClass, string> = {
  acidic: '#FF6B6B',
  basic: '#4FA3FF',
  hydrophobic: '#A8B4C0',
  polar: '#68D391',
};

const CLASS_LABEL: Record<ResidueClass, string> = {
  acidic: 'Acidic',
  basic: 'Basic',
  hydrophobic: 'Hydrophobic',
  polar: 'Polar / Other',
};

/** Returns an array of 1-letter residues, or null if the string isn't a clean sequence. */
function parseSequence(raw: string): string[] | null {
  if (!raw) return null;
  // Take the portion before a "+" (e.g. "Ala-His-Lys + Cu(II)").
  const head = raw.split('+')[0].trim();

  // 3-letter dash/space joined (Gly-Glu-Pro-...).
  const tokens = head.split(/[\s\-·•,]+/).filter(Boolean);
  if (tokens.length >= 3) {
    const mapped = tokens.map((t) => THREE_TO_ONE[t.toLowerCase()]);
    const valid = mapped.filter(Boolean).length;
    if (valid === tokens.length) return mapped;
  }

  // Contiguous 1-letter code (QEQLERALNSS).
  const stripped = head.replace(/\s+/g, '');
  if (stripped.length >= 4 && new RegExp(`^[${ONE_LETTER}]+$`).test(stripped)) {
    return stripped.split('');
  }

  return null;
}

export default function SequenceViewer({
  sequence,
  molecularWeight,
}: {
  sequence?: string | null;
  molecularWeight?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const residues = sequence ? parseSequence(sequence) : null;
  if (!residues) return null;

  const oneLetter = residues.join('');
  const usedClasses = Array.from(new Set(residues.map(residueClass)));

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <p style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--silver)', margin: 0 }}>
          Sequence
        </p>
        <span style={{ fontSize: '0.74rem', color: 'var(--silver)' }}>{residues.length} Residues</span>
        {molecularWeight && <span style={{ fontSize: '0.74rem', color: 'var(--silver)' }}>· {molecularWeight}</span>}
        <button
          type="button"
          onClick={() => {
            if (navigator?.clipboard?.writeText) {
              navigator.clipboard.writeText(oneLetter).then(
                () => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                },
                () => {},
              );
            }
          }}
          style={{
            marginLeft: 'auto',
            background: 'rgba(0,196,188,0.12)',
            border: '1px solid rgba(0,196,188,0.45)',
            borderRadius: '8px',
            color: '#00C4BC',
            fontWeight: 700,
            fontSize: '0.72rem',
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          {copied ? 'Copied' : 'Copy Sequence'}
        </button>
      </div>

      {/* Residue tiles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {residues.map((aa, i) => {
          const cls = residueClass(aa);
          const color = CLASS_COLOR[cls];
          return (
            <span
              key={i}
              title={`${i + 1}. ${RESIDUE_NAME[aa] || aa}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 30,
                borderRadius: 6,
                background: `${color}1F`,
                border: `1px solid ${color}66`,
                color,
                fontSize: '0.82rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              }}
            >
              {aa}
            </span>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px' }}>
        {usedClasses.map((cls) => (
          <span key={cls} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--silver)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: CLASS_COLOR[cls], display: 'inline-block' }} />
            {CLASS_LABEL[cls]}
          </span>
        ))}
      </div>
    </div>
  );
}
