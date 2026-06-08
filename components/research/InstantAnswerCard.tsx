'use client';

/**
 * InstantAnswerCard -- rendered at position 0 on /research/search when the
 * server intent classifier recognizes the query. Different visual treatments
 * per intent kind.
 *
 * Research use only.
 */

import Link from 'next/link';
import { Beaker, BookOpen, ShieldAlert, Calendar, FlaskConical, Calculator, ListOrdered } from 'lucide-react';
import { evidenceTier } from '@/lib/compounds';

const RESEARCH_NOTE = 'Research Use Only. Not Intended As Medical Advice Or Human Dosing.';

interface CompoundLike {
  slug: string;
  display_name: string;
  plain_summary?: string | null;
  mechanism?: string | null;
  evidence_tier?: string;
  category?: string | null;
  half_life?: string | null;
  side_effects?: string | null;
  warnings?: string | null;
  stack_components?: string[];
  handling?: {
    form?: string;
    diluent?: string;
    storage_temp?: string;
    reconstituted_days?: number | null;
  };
}

export interface InstantAnswerPayload {
  kind:
    | 'definition'
    | 'comparison'
    | 'mechanism'
    | 'reconstitution'
    | 'side_effects'
    | 'half_life'
    | 'stack'
    | 'category'
    | 'safety'
    | 'storage'
    | 'dose_conversion'
    | 'none';
  confidence?: number;
  compound?: CompoundLike;
  compounds?: CompoundLike[];
  components?: CompoundLike[];
  handling?: CompoundLike['handling'];
  side_effects?: string | null;
  warnings?: string | null;
  half_life_text?: string | null;
  note?: string;
}

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(140deg, rgba(0,196,188,0.10) 0%, rgba(15,25,35,0.85) 50%)',
  border: '1px solid rgba(0,196,188,0.35)',
  borderRadius: 14,
  padding: '20px 22px',
  marginBottom: 24,
  position: 'relative',
};

const tagStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#00C4BC',
  fontWeight: 700,
  background: 'rgba(0,196,188,0.12)',
  border: '1px solid rgba(0,196,188,0.4)',
  borderRadius: 999,
  padding: '4px 10px',
  marginBottom: 10,
};

function ResearchNote() {
  return (
    <p style={{ fontSize: 11, color: '#A8B4C0', marginTop: 16, marginBottom: 0, fontStyle: 'italic' }}>
      {RESEARCH_NOTE}
    </p>
  );
}

function CompoundHeader({ c }: { c: CompoundLike }) {
  const t = c.evidence_tier ? evidenceTier(c.evidence_tier) : null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <Link href={`/research/${c.slug}`} style={{ textDecoration: 'none' }}>
        <h2 style={{ margin: 0, fontSize: 22, color: '#FFFFFF', fontWeight: 800 }}>{c.display_name}</h2>
      </Link>
      {t && (
        <span style={{
          fontSize: 11, color: t.color, border: `1px solid ${t.color}`,
          borderRadius: 999, padding: '2px 10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>{t.label}</span>
      )}
      {c.category && (
        <span style={{ fontSize: 12, color: '#A8B4C0' }}>{c.category}</span>
      )}
    </div>
  );
}

export default function InstantAnswerCard({ payload }: { payload: InstantAnswerPayload }) {
  if (!payload || payload.kind === 'none') return null;

  const Icon = (() => {
    switch (payload.kind) {
      case 'definition': return BookOpen;
      case 'comparison': return ListOrdered;
      case 'mechanism': return FlaskConical;
      case 'reconstitution': return Beaker;
      case 'side_effects':
      case 'safety': return ShieldAlert;
      case 'half_life': return Calendar;
      case 'stack': return ListOrdered;
      case 'storage': return Beaker;
      case 'dose_conversion': return Calculator;
      default: return BookOpen;
    }
  })();

  const kindLabel = (() => {
    switch (payload.kind) {
      case 'definition': return 'Definition';
      case 'comparison': return 'Comparison';
      case 'mechanism': return 'Mechanism';
      case 'reconstitution': return 'Reconstitution';
      case 'side_effects': return 'Side Effects';
      case 'half_life': return 'Half-Life';
      case 'stack': return 'Stack';
      case 'category': return 'Category';
      case 'safety': return 'Safety';
      case 'storage': return 'Storage';
      case 'dose_conversion': return 'Dose Conversion';
      default: return 'Instant Answer';
    }
  })();

  return (
    <div style={cardStyle}>
      <span style={tagStyle}>
        <Icon size={12} aria-hidden="true" />
        Instant Answer: {kindLabel}
      </span>

      {(payload.kind === 'definition' ||
        payload.kind === 'mechanism' ||
        payload.kind === 'category' ||
        payload.kind === 'safety') && payload.compound && (
        <>
          <CompoundHeader c={payload.compound} />
          {payload.kind === 'mechanism' && payload.compound.mechanism ? (
            <p style={{ color: '#D0DAE4', lineHeight: 1.65, margin: 0, fontSize: 15 }}>
              {payload.compound.mechanism}
            </p>
          ) : (
            <p style={{ color: '#D0DAE4', lineHeight: 1.65, margin: 0, fontSize: 15 }}>
              {payload.compound.plain_summary ?? payload.compound.mechanism ?? 'No Summary Available Yet.'}
            </p>
          )}
        </>
      )}

      {payload.kind === 'reconstitution' && payload.compound && (
        <>
          <CompoundHeader c={payload.compound} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 10 }}>
            <DataCell label="Form" value={payload.compound.handling?.form ?? payload.handling?.form ?? 'Unknown'} />
            <DataCell label="Diluent" value={payload.compound.handling?.diluent ?? payload.handling?.diluent ?? 'Bacteriostatic Water'} />
            <DataCell label="Storage" value={payload.compound.handling?.storage_temp ?? payload.handling?.storage_temp ?? 'Refrigerate'} />
            <DataCell
              label="Reconstituted Shelf"
              value={
                payload.compound.handling?.reconstituted_days || payload.handling?.reconstituted_days
                  ? `${payload.compound.handling?.reconstituted_days ?? payload.handling?.reconstituted_days} Days`
                  : 'See Monograph'
              }
            />
          </div>
          <Link href="/research/calculators#reconstitution" className="btn-primary" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 14px',
          }}>
            <Calculator size={14} aria-hidden="true" /> Open The Reconstitution Calculator
          </Link>
        </>
      )}

      {payload.kind === 'side_effects' && payload.compound && (
        <>
          <CompoundHeader c={payload.compound} />
          {payload.compound.side_effects && (
            <p style={{ color: '#D0DAE4', lineHeight: 1.65, margin: '0 0 8px', fontSize: 14 }}>
              <strong style={{ color: '#FFFFFF' }}>Side Effects: </strong>
              {payload.compound.side_effects}
            </p>
          )}
          {payload.compound.warnings && (
            <p style={{ color: '#F6AD55', lineHeight: 1.65, margin: 0, fontSize: 14 }}>
              <strong style={{ color: '#E53E3E' }}>Warnings: </strong>
              {payload.compound.warnings}
            </p>
          )}
        </>
      )}



      {payload.kind === 'half_life' && payload.compound && (
        <>
          <CompoundHeader c={payload.compound} />
          <p style={{ color: '#D0DAE4', lineHeight: 1.65, margin: 0, fontSize: 15 }}>
            <strong style={{ color: '#FFFFFF' }}>Half-Life: </strong>
            {payload.compound.half_life ?? payload.half_life_text ?? 'Not Yet Cataloged.'}
          </p>
        </>
      )}

      {payload.kind === 'stack' && payload.compound && (
        <>
          <CompoundHeader c={payload.compound} />
          <p style={{ color: '#D0DAE4', lineHeight: 1.65, margin: '0 0 10px', fontSize: 14 }}>
            {payload.compound.plain_summary ?? 'Stack Studied In The Literature.'}
          </p>
          {payload.components && payload.components.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {payload.components.map((c) => (
                <Link
                  key={c.slug}
                  href={`/research/${c.slug}`}
                  style={{
                    fontSize: 12,
                    color: '#00C4BC',
                    border: '1px solid rgba(0,196,188,0.4)',
                    background: 'rgba(0,196,188,0.06)',
                    padding: '4px 10px',
                    borderRadius: 999,
                    textDecoration: 'none',
                  }}
                >
                  {c.display_name}
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {payload.kind === 'storage' && payload.compound && (
        <>
          <CompoundHeader c={payload.compound} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <DataCell label="Storage Temperature" value={payload.compound.handling?.storage_temp ?? 'See Monograph'} />
            <DataCell label="Reconstituted Shelf" value={payload.compound.handling?.reconstituted_days ? `${payload.compound.handling?.reconstituted_days} Days` : 'See Monograph'} />
          </div>
        </>
      )}

      {payload.kind === 'dose_conversion' && (
        <>
          <p style={{ color: '#D0DAE4', lineHeight: 1.65, margin: '0 0 10px', fontSize: 15 }}>
            Use The Concentration Converter To Move Between mg/mL, mcg/mL, ng/mL, And Molar Units.
          </p>
          <Link href="/research/calculators#concentration" className="btn-primary" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 14px',
          }}>
            <Calculator size={14} aria-hidden="true" /> Open The Concentration Converter
          </Link>
        </>
      )}

      {payload.kind === 'comparison' && payload.compounds && payload.compounds.length >= 2 && (
        <>
          <p style={{ color: '#D0DAE4', lineHeight: 1.6, margin: '0 0 12px', fontSize: 14 }}>
            Side-By-Side Snapshot. Click Either Name For The Full Monograph.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: '#D0DAE4' }}>
              <thead>
                <tr>
                  <th style={tdHead}></th>
                  {payload.compounds.slice(0, 2).map((c) => (
                    <th key={c.slug} style={tdHead}>
                      <Link href={`/research/${c.slug}`} style={{ color: '#00C4BC', textDecoration: 'none' }}>
                        {c.display_name}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdLabel}>Evidence Tier</td>
                  {payload.compounds.slice(0, 2).map((c) => (
                    <td key={`tier-${c.slug}`} style={td}>
                      {c.evidence_tier ? evidenceTier(c.evidence_tier).label : '-'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={tdLabel}>Half-Life</td>
                  {payload.compounds.slice(0, 2).map((c) => (
                    <td key={`hl-${c.slug}`} style={td}>{c.half_life ?? '-'}</td>
                  ))}
                </tr>
                <tr>
                  <td style={tdLabel}>Plain Summary</td>
                  {payload.compounds.slice(0, 2).map((c) => (
                    <td key={`ps-${c.slug}`} style={td}>{c.plain_summary ?? '-'}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      <ResearchNote />
    </div>
  );
}

const tdHead: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  fontSize: 12,
  color: '#A8B4C0',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid rgba(168,180,192,0.2)',
};

const td: React.CSSProperties = {
  padding: '10px',
  verticalAlign: 'top',
  borderBottom: '1px solid rgba(168,180,192,0.1)',
};

const tdLabel: React.CSSProperties = { ...td, color: '#A8B4C0', fontSize: 12, width: 140 };

function DataCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#A8B4C0', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 600 }}>{value}</div>
    </div>
  );
}
