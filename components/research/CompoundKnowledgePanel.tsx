'use client';

/**
 * CompoundKnowledgePanel -- reusable right-rail card showing the structure,
 * stack relationships, evidence tier, WADA status, and a CTA to the full
 * monograph. Used on /research/search and on /research/[slug].
 */

import Link from 'next/link';
import type { Compound } from '@/lib/compounds';
import { evidenceTier, wadaLabel } from '@/lib/compounds';
import PinToCompareButton from '@/components/research/PinToCompareButton';
import ResearchCartButton from '@/components/research/ResearchCartButton';

export default function CompoundKnowledgePanel({
  compound,
  dense = false,
}: {
  compound: Compound;
  dense?: boolean;
}) {
  const tier = evidenceTier(compound.evidence_tier);

  return (
    <aside
      className="glass-panel"
      style={{
        padding: dense ? 16 : 20,
        borderRadius: 14,
        border: '1px solid rgba(0,196,188,0.25)',
        background: 'rgba(15,25,35,0.7)',
        display: 'flex',
        flexDirection: 'column',
        gap: dense ? 10 : 14,
        position: 'sticky',
        top: 84,
      }}
    >
      <div>
        <div style={{ fontSize: 11, color: '#A8B4C0', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
          Knowledge Panel
        </div>
        <h3 style={{ margin: 0, fontSize: 18, color: '#FFFFFF', fontWeight: 800 }}>
          {compound.display_name}
        </h3>
        {compound.aliases && compound.aliases.length > 0 && (
          <div style={{ marginTop: 4, fontSize: 12, color: '#A8B4C0' }}>
            Also Known As: {compound.aliases.slice(0, 3).join(', ')}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <span style={{
          fontSize: 10, color: tier.color, border: `1px solid ${tier.color}`,
          padding: '2px 10px', borderRadius: 999, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>{tier.label}</span>
        {compound.wada_status && compound.wada_status !== 'not_listed' && (
          <span style={{
            fontSize: 10, color: '#E53E3E', border: '1px solid #E53E3E',
            padding: '2px 10px', borderRadius: 999, fontWeight: 700,
          }}>{wadaLabel(compound.wada_status)}</span>
        )}
        {compound.category && (
          <span style={{ fontSize: 11, color: '#A8B4C0' }}>{compound.category}</span>
        )}
      </div>

      {compound.plain_summary && (
        <p style={{ margin: 0, color: '#D0DAE4', fontSize: 13, lineHeight: 1.6 }}>
          {compound.plain_summary}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <KV label="Molecular Weight" value={compound.molecular_weight_da ? `${compound.molecular_weight_da} Da` : (compound.identity?.molecular_weight ?? 'Not Listed')} />
        <KV label="Year Discovered" value={compound.year_discovered?.toString() ?? 'Unknown'} />
        <KV label="PubMed Citations" value={compound.pubmed_citation_count ? compound.pubmed_citation_count.toLocaleString() : '—'} />
        <KV label="Clinical Trials" value={(compound.active_trial_count || compound.completed_trial_count) ? String((compound.active_trial_count ?? 0) + (compound.completed_trial_count ?? 0)) : 'None'} />
        <KV label="Half-Life" value={compound.half_life ?? 'See Monograph'} />
        <KV label="Storage" value={compound.handling?.storage_temp ?? 'See Monograph'} />
      </div>

      {compound.is_stack && compound.stack_components && compound.stack_components.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#A8B4C0', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
            Stack Components
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {compound.stack_components.slice(0, 4).map((slug) => (
              <Link key={slug} href={`/research/${slug}`} style={{
                fontSize: 12, color: '#00C4BC', border: '1px solid rgba(0,196,188,0.4)',
                padding: '3px 9px', borderRadius: 999, textDecoration: 'none',
              }}>{slug}</Link>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <div style={{ flex: 1 }}>
          <PinToCompareButton
            compoundSlug={compound.slug}
            compoundName={compound.display_name}
            evidenceTierKey={compound.evidence_tier}
            size="sm"
          />
        </div>
        <ResearchCartButton
          productName={compound.display_name}
          size="sm"
        />
      </div>

      <Link
        href={`/research/${compound.slug}`}
        className="btn-primary"
        style={{ display: 'inline-flex', justifyContent: 'center', fontSize: 13, padding: '8px 14px' }}
      >
        View The Full Monograph
      </Link>

      <p style={{ margin: 0, fontSize: 11, color: '#A8B4C0', fontStyle: 'italic' }}>
        Research Use Only. Not Medical Advice.
      </p>
    </aside>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#A8B4C0', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: '#FFFFFF', fontWeight: 600 }}>{value}</div>
    </div>
  );
}
