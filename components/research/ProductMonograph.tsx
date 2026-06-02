'use client';

/**
 * ProductMonograph — full research monograph embedded directly into the
 * storefront product detail modal. Presentational only: fed a Compound object
 * by props (the storefront page fetches them server-side), so there is no
 * client round-trip and no loading state.
 *
 * Research-Use-Only framing throughout. No human dosing or medical advice.
 * Title Case headings, no emojis, platform design tokens.
 */
import Link from 'next/link';
import {
  FlaskConical, Microscope, Snowflake, Droplet, ShieldAlert, BookOpen,
  ArrowRight, Beaker, Clock,
} from 'lucide-react';
import {
  type Compound,
  evidenceTier,
  wadaLabel,
  researchAreaLabel,
} from '@/lib/compounds';

interface Props {
  compound: Compound;
  primaryColor?: string;
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-2)' }}>
        <span style={{ color: 'var(--teal)', display: 'flex', flexShrink: 0 }}>{icon}</span>
        <h3
          style={{
            fontSize: '0.78rem',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--silver)',
            margin: 0,
          }}
        >
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function Chips({ items, color }: { items: string[]; color: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((it) => (
        <span
          key={it}
          style={{
            fontSize: '0.74rem',
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 9999,
            background: `${color}14`,
            border: `1px solid ${color}33`,
            color: '#D0DAE4',
            whiteSpace: 'nowrap',
          }}
        >
          {it}
        </span>
      ))}
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        padding: '7px 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        fontSize: '0.85rem',
      }}
    >
      <span style={{ flex: '0 0 42%', color: 'var(--silver)', fontWeight: 700 }}>{label}</span>
      <span style={{ flex: 1, color: 'var(--white)' }}>{value}</span>
    </div>
  );
}

export default function ProductMonograph({ compound, primaryColor = '#00C4BC' }: Props) {
  if (!compound) return null;

  const tier = evidenceTier(compound.evidence_tier);
  const h = compound.handling ?? {};
  const id = compound.identity ?? {};
  const areaLabels = (compound.research_areas ?? []).map(researchAreaLabel);
  const shelfDays = compound.reconstitution_shelf_days ?? h.reconstituted_days ?? null;

  return (
    <div
      style={{
        marginBottom: 'var(--space-6)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-lg)',
        background: 'linear-gradient(180deg, rgba(15,25,35,0.6) 0%, rgba(10,16,24,0.6) 100%)',
        border: '1px solid rgba(192,184,168,0.16)',
      }}
    >
      {/* Header: Research label + evidence tier */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          marginBottom: 'var(--space-3)',
          paddingBottom: 'var(--space-3)',
          borderBottom: `1px solid ${primaryColor}33`,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.72rem',
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: primaryColor,
          }}
        >
          <Microscope size={14} aria-hidden="true" />
          Research Profile
        </span>
        <span
          title={tier.blurb}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.7rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            padding: '4px 10px',
            borderRadius: 9999,
            background: `${tier.color}1A`,
            border: `1px solid ${tier.color}55`,
            color: tier.color,
          }}
        >
          {tier.label}
        </span>
      </div>

      {/* Plain summary / what it is */}
      {compound.plain_summary && (
        <p style={{ fontSize: '0.9rem', color: '#D0DAE4', lineHeight: 1.65, marginTop: 0, marginBottom: 'var(--space-5)' }}>
          {compound.plain_summary}
        </p>
      )}

      {/* Mechanism */}
      {compound.mechanism && (
        <Section icon={<FlaskConical size={15} aria-hidden="true" />} title="Mechanism Of Action">
          <p style={{ fontSize: '0.86rem', color: '#C8D2DC', lineHeight: 1.6, margin: 0 }}>
            {compound.mechanism}
          </p>
        </Section>
      )}

      {/* Studied For */}
      {compound.studied_for && compound.studied_for.length > 0 && (
        <Section icon={<Beaker size={15} aria-hidden="true" />} title="Studied For">
          <Chips items={compound.studied_for} color={primaryColor} />
        </Section>
      )}

      {/* Research Areas */}
      {areaLabels.length > 0 && (
        <Section icon={<BookOpen size={15} aria-hidden="true" />} title="Research Areas">
          <Chips items={areaLabels} color="#A8B4C0" />
        </Section>
      )}

      {/* Benefits (research framing) */}
      {compound.benefits && (
        <Section icon={<Microscope size={15} aria-hidden="true" />} title="Reported In Research">
          <p style={{ fontSize: '0.86rem', color: '#C8D2DC', lineHeight: 1.6, margin: 0 }}>
            {compound.benefits}
          </p>
        </Section>
      )}

      {/* Handling & Storage */}
      <Section icon={<Snowflake size={15} aria-hidden="true" />} title="Handling & Storage">
        <div>
          <FactRow label="Form" value={h.form} />
          <FactRow label="Diluent" value={h.diluent} />
          <FactRow label="Storage Temperature" value={h.storage_temp} />
          <FactRow
            label="Light Sensitive"
            value={h.light_sensitive == null ? null : h.light_sensitive ? 'Yes' : 'No'}
          />
          <FactRow label="Freeze / Thaw" value={h.freeze_thaw} />
          <FactRow
            label="Reconstituted Shelf Life"
            value={shelfDays != null ? `${shelfDays} Days Refrigerated` : null}
          />
          {h.notes ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--silver)', lineHeight: 1.55, margin: 'var(--space-3) 0 0' }}>
              {h.notes}
            </p>
          ) : null}
        </div>
      </Section>

      {/* Identity */}
      {(compound.compound_class || compound.molecular_target || id.sequence || id.molecular_weight || id.cas || id.parent) && (
        <Section icon={<Droplet size={15} aria-hidden="true" />} title="Identity & Target">
          <div>
            <FactRow label="Class" value={compound.compound_class} />
            <FactRow label="Molecular Target" value={compound.molecular_target} />
            <FactRow label="Sequence" value={id.sequence} />
            <FactRow label="Molecular Weight" value={id.molecular_weight} />
            <FactRow label="CAS" value={id.cas} />
            <FactRow label="Parent" value={id.parent} />
          </div>
        </Section>
      )}

      {/* Regulatory & Anti-Doping */}
      {(compound.regulatory || compound.wada_status) && (
        <Section icon={<ShieldAlert size={15} aria-hidden="true" />} title="Regulatory & Anti-Doping">
          <div>
            <FactRow label="Regulatory" value={compound.regulatory} />
            <FactRow label="WADA Status" value={compound.wada_status ? wadaLabel(compound.wada_status) : null} />
          </div>
        </Section>
      )}

      {/* Research Cautions */}
      {(compound.warnings || compound.side_effects) && (
        <Section icon={<ShieldAlert size={15} aria-hidden="true" />} title="Research Cautions">
          {compound.warnings ? (
            <p style={{ fontSize: '0.84rem', color: '#E2B07A', lineHeight: 1.55, margin: '0 0 6px' }}>
              {compound.warnings}
            </p>
          ) : null}
          {compound.side_effects ? (
            <p style={{ fontSize: '0.84rem', color: 'var(--silver)', lineHeight: 1.55, margin: 0 }}>
              {compound.side_effects}
            </p>
          ) : null}
        </Section>
      )}

      {/* Reconstitution shortcut */}
      {shelfDays != null && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(0,196,188,0.08)',
            border: '1px solid rgba(0,196,188,0.25)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <Clock size={15} aria-hidden="true" style={{ color: primaryColor, flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', color: '#C8D2DC' }}>
            Once Reconstituted, Track Remaining Shelf Life In{' '}
            <Link href="/account/shelf-life" style={{ color: primaryColor, fontWeight: 700 }}>
              Your Account
            </Link>
            .
          </span>
        </div>
      )}

      {/* Sources */}
      {compound.sources && compound.sources.length > 0 && (
        <Section icon={<BookOpen size={15} aria-hidden="true" />} title="Sources">
          <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {compound.sources.map((src, i) => {
              const href = /^https?:\/\//i.test(src) ? src : `https://${src}`;
              return (
                <li key={i} style={{ wordBreak: 'break-all', fontSize: '0.8rem' }}>
                  <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: primaryColor }}>
                    {src}
                  </a>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* Full profile CTA */}
      <Link
        href={`/research/${compound.slug}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          borderRadius: 'var(--radius-md)',
          background: primaryColor,
          color: '#04221F',
          fontWeight: 800,
          fontSize: '0.85rem',
          textDecoration: 'none',
        }}
      >
        View Full Research Profile
        <ArrowRight size={15} aria-hidden="true" />
      </Link>

      {/* Research-Use-Only footer */}
      <p style={{ fontSize: '0.72rem', color: 'var(--grey-400)', lineHeight: 1.5, margin: 'var(--space-4) 0 0' }}>
        Research Use Only. Not For Human Or Veterinary Use. Information Provided For Laboratory Research Purposes Only.
      </p>
    </div>
  );
}
