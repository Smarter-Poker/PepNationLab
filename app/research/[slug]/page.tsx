/**
 * Compound monograph — the full Research-Use-Only detail page for one compound.
 * Server component: fetches the compound by slug, renders factual sections
 * (mechanism, findings, safety, handling, regulatory) plus a reconstitution
 * lab tool, auto-derived agent talking points and FAQ. No human dosing.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FlaskConical, AlertTriangle, ShieldAlert, FileText, ArrowLeft } from 'lucide-react';
import { getCompound } from '@/lib/compounds-server';
import {
  RISK_META,
  wadaLabel,
  researchAreaLabel,
} from '@/lib/compounds';
import EvidenceBadge from '@/components/research/EvidenceBadge';
import GlossaryText from '@/components/research/GlossaryText';
import PlainTechnicalToggle from '@/components/research/PlainTechnicalToggle';
import ReconstitutionCalculator from '@/components/research/ReconstitutionCalculator';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const compound = await getCompound(slug);
  const name = compound?.display_name ?? 'Compound';
  return {
    title: `${name} | Research | Pep Nation Lab`,
    robots: { index: false, follow: false },
  };
}

function sectionTitleStyle(): React.CSSProperties {
  return {
    fontSize: '1.15rem',
    fontWeight: 800,
    color: 'var(--white)',
    marginBottom: 'var(--space-3)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };
}

function chip(label: string, key: React.Key) {
  return (
    <span
      key={key}
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        fontSize: '0.78rem',
        fontWeight: 600,
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--grey-400)',
        color: 'var(--silver)',
        background: 'rgba(168,180,192,0.08)',
      }}
    >
      {label}
    </span>
  );
}

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--silver)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <span style={{ color: 'var(--white)', fontSize: '0.92rem' }}>{value}</span>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const compound = await getCompound(slug);
  if (!compound) notFound();

  const isHighRisk = compound.risk_level === 'critical' || compound.risk_level === 'high';
  const risk = RISK_META[compound.risk_level];
  const id = compound.identity ?? {};
  const h = compound.handling ?? {};

  // Auto-derive a sensible default vial mass for the calculator from the
  // identity molecular_weight string if it contains a plain number; otherwise
  // leave undefined so the calculator uses its own default.
  let defaultMassMg: number | undefined;

  // Agent talking points, derived from data.
  const talkingPoints: string[] = [];
  talkingPoints.push(`Evidence Tier: ${compound.evidence_tier.replace(/_/g, ' ')}`);
  if (compound.studied_for[0]) talkingPoints.push(`Key Research Use: ${compound.studied_for[0]}`);
  if (h.storage_temp) talkingPoints.push(`Storage: ${h.storage_temp}`);
  talkingPoints.push(`WADA Status: ${wadaLabel(compound.wada_status)}`);

  const cardStyle: React.CSSProperties = {
    marginBottom: 'var(--space-5)',
    padding: 'var(--space-5)',
  };

  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: 'var(--space-5) var(--space-4)' }}>
      {/* Header */}
      <section className="card-metal" style={{ ...cardStyle }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <FlaskConical size={22} color="var(--teal)" aria-hidden="true" />
          <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--white)', margin: 0 }}>
            {compound.display_name}
          </h1>
        </div>
        {compound.aliases.length > 0 && (
          <p style={{ fontSize: '0.82rem', color: 'var(--silver)', marginBottom: 'var(--space-3)' }}>
            Also Known As: {compound.aliases.join(', ')}
          </p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
          {compound.category && chip(compound.category, 'cat')}
          <EvidenceBadge tier={compound.evidence_tier} />
          {isHighRisk && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                borderRadius: 'var(--radius-md)',
                color: risk.color,
                border: `1px solid ${risk.color}`,
                background: risk.bg,
              }}
            >
              <ShieldAlert size={14} aria-hidden="true" /> {risk.label} Risk
            </span>
          )}
          {compound.wada_status !== 'not_listed' && (
            <span
              style={{
                padding: '4px 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                borderRadius: 'var(--radius-md)',
                color: '#F6AD55',
                border: '1px solid #F6AD55',
                background: 'rgba(246,173,85,0.12)',
              }}
            >
              {wadaLabel(compound.wada_status)}
            </span>
          )}
        </div>
        <p style={{ marginTop: 'var(--space-3)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--teal)' }}>
          Research Use Only
        </p>
      </section>

      {/* What It Is + Mechanism (toggle) */}
      <section className="card" style={{ ...cardStyle }}>
        <PlainTechnicalToggle plain={compound.plain_summary}>
          <h2 style={sectionTitleStyle()}>What It Is</h2>
          <div className="grid-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <SpecRow label="Class" value={compound.compound_class} />
            <SpecRow label="Molecular Target" value={compound.molecular_target} />
            <SpecRow label="Sequence" value={id.sequence} />
            <SpecRow label="Molecular Weight" value={id.molecular_weight} />
            <SpecRow label="CAS" value={id.cas} />
            <SpecRow label="Parent" value={id.parent} />
          </div>

          {compound.mechanism && (
            <>
              <h2 style={sectionTitleStyle()}>Mechanism Of Action</h2>
              <p style={{ color: 'var(--silver)', lineHeight: 1.7 }}>
                <GlossaryText text={compound.mechanism} />
              </p>
            </>
          )}
        </PlainTechnicalToggle>
      </section>

      {/* Studied For */}
      {(compound.studied_for.length > 0 || compound.research_areas.length > 0) && (
        <section className="card" style={{ ...cardStyle }}>
          <h2 style={sectionTitleStyle()}>What It Is Studied For</h2>
          {compound.studied_for.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              {compound.studied_for.map((s, i) => chip(s, `sf-${i}`))}
            </div>
          )}
          {compound.research_areas.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {compound.research_areas.map((area, i) => (
                <Link
                  key={`ra-${i}`}
                  href={`/research/area/${area}`}
                  style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--teal)',
                    color: 'var(--teal)',
                    background: 'rgba(0,196,188,0.08)',
                  }}
                >
                  {researchAreaLabel(area)}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Reported Findings */}
      {compound.benefits && (
        <section className="card" style={{ ...cardStyle }}>
          <h2 style={sectionTitleStyle()}>Reported Findings</h2>
          <p style={{ color: 'var(--silver)', lineHeight: 1.7 }}>
            <GlossaryText text={compound.benefits} />
          </p>
        </section>
      )}

      {/* Reported Side Effects */}
      {compound.side_effects && (
        <section className="card" style={{ ...cardStyle }}>
          <h2 style={sectionTitleStyle()}>Reported Side Effects</h2>
          <p style={{ color: 'var(--silver)', lineHeight: 1.7 }}>{compound.side_effects}</p>
        </section>
      )}

      {/* Warnings & Limitations */}
      {compound.warnings && (
        <section className="card" style={{ ...cardStyle }}>
          <h2 style={sectionTitleStyle()}>Warnings & Limitations</h2>
          {isHighRisk ? (
            <div
              style={{
                border: '1px solid #E53E3E',
                background: 'rgba(229,62,62,0.12)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                display: 'flex',
                gap: '10px',
              }}
            >
              <AlertTriangle size={18} color="#E53E3E" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ color: 'var(--white)', lineHeight: 1.7, margin: 0 }}>{compound.warnings}</p>
            </div>
          ) : (
            <p style={{ color: 'var(--silver)', lineHeight: 1.7 }}>{compound.warnings}</p>
          )}
        </section>
      )}

      {/* Handling, Storage & Reconstitution */}
      <section className="card" style={{ ...cardStyle }}>
        <h2 style={sectionTitleStyle()}>Handling, Storage & Reconstitution</h2>
        <div className="grid-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <SpecRow label="Form" value={h.form} />
          <SpecRow label="Diluent" value={h.diluent} />
          <SpecRow label="Storage Temperature" value={h.storage_temp} />
          <SpecRow label="Light Sensitive" value={h.light_sensitive == null ? null : h.light_sensitive ? 'Yes' : 'No'} />
          <SpecRow label="Freeze / Thaw" value={h.freeze_thaw} />
          <SpecRow
            label="Reconstituted Shelf Life"
            value={h.reconstituted_days != null ? `${h.reconstituted_days} Days` : null}
          />
        </div>
        {h.notes && <p style={{ color: 'var(--silver)', lineHeight: 1.7, marginBottom: 'var(--space-4)' }}>{h.notes}</p>}
        <ReconstitutionCalculator defaultMassMg={defaultMassMg} />
      </section>

      {/* Regulatory & Anti-Doping */}
      <section className="card" style={{ ...cardStyle }}>
        <h2 style={sectionTitleStyle()}>Regulatory & Anti-Doping Status</h2>
        {compound.regulatory && (
          <p style={{ color: 'var(--silver)', lineHeight: 1.7, marginBottom: 'var(--space-2)' }}>{compound.regulatory}</p>
        )}
        <p style={{ color: 'var(--white)', fontWeight: 700 }}>{wadaLabel(compound.wada_status)}</p>
      </section>

      {/* For Agents */}
      <section className="card" style={{ ...cardStyle }}>
        <h2 style={sectionTitleStyle()}>For Agents</h2>
        <ul style={{ color: 'var(--silver)', lineHeight: 1.8, paddingLeft: '1.2rem', margin: 0 }}>
          {talkingPoints.map((tp, i) => (
            <li key={i}>{tp}</li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section className="card" style={{ ...cardStyle }}>
        <h2 style={sectionTitleStyle()}>Frequently Asked Questions</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <p style={{ color: 'var(--white)', fontWeight: 700, marginBottom: '4px' }}>
              What Is {compound.display_name}?
            </p>
            <p style={{ color: 'var(--silver)', lineHeight: 1.7, margin: 0 }}>
              {compound.plain_summary ?? compound.mechanism ?? `${compound.display_name} is a research compound offered for laboratory use only.`}
            </p>
          </div>
          <div>
            <p style={{ color: 'var(--white)', fontWeight: 700, marginBottom: '4px' }}>
              What Is It Studied For?
            </p>
            <p style={{ color: 'var(--silver)', lineHeight: 1.7, margin: 0 }}>
              {compound.studied_for.length > 0
                ? compound.studied_for.join(', ') + '.'
                : 'Refer to the Reported Findings section above.'}
            </p>
          </div>
          <div>
            <p style={{ color: 'var(--white)', fontWeight: 700, marginBottom: '4px' }}>
              How Is It Stored?
            </p>
            <p style={{ color: 'var(--silver)', lineHeight: 1.7, margin: 0 }}>
              {h.storage_temp
                ? `Store at ${h.storage_temp}.${h.light_sensitive ? ' Protect from light.' : ''}`
                : 'Refer to the Handling, Storage & Reconstitution section above.'}
            </p>
          </div>
          <div>
            <p style={{ color: 'var(--white)', fontWeight: 700, marginBottom: '4px' }}>
              Is It WADA-Prohibited?
            </p>
            <p style={{ color: 'var(--silver)', lineHeight: 1.7, margin: 0 }}>
              {wadaLabel(compound.wada_status)}.
            </p>
          </div>
        </div>
      </section>

      {/* Sources */}
      {compound.sources.length > 0 && (
        <section className="card" style={{ ...cardStyle }}>
          <h2 style={sectionTitleStyle()}>Sources</h2>
          <ul style={{ color: 'var(--silver)', lineHeight: 1.8, paddingLeft: '1.2rem', margin: 0 }}>
            {compound.sources.map((src, i) => {
              const href = /^https?:\/\//i.test(src) ? src : `https://${src}`;
              return (
                <li key={i}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--teal)', wordBreak: 'break-all' }}
                  >
                    {src}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
        <Link
          href={`/research/${compound.slug}/spec`}
          className="btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <FileText size={16} aria-hidden="true" />
          Download Spec Sheet
        </Link>
        <Link
          href="/research"
          className="btn-ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back To Research Library
        </Link>
      </div>
    </main>
  );
}
