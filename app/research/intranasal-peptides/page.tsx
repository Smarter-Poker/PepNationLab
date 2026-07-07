/**
 * Intranasal Peptides - education article + curated collection.
 *
 * Server component. Explains which research compounds are studied via the nasal
 * (intranasal) route instead of injection, graded by strength of evidence, and
 * lists them live from the compounds table so the page stays in sync with the
 * catalog. Research-Use-Only framing. No human dosing.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier, intranasalDisplay, type Compound } from '@/lib/compounds';
import IframeLink from '@/components/ui/IframeLink';

export const metadata: Metadata = {
  title: 'Intranasal Peptides: Which Research Compounds Are Studied As Nasal Sprays | Pep Nation Lab',
  description: 'A research-use-only overview of which peptides are studied via the intranasal (nasal spray) route instead of injection, graded established vs emerging by strength of evidence.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/intranasal-peptides' },
  openGraph: {
    title: 'Intranasal Peptides | Nasal Spray Research Compounds | Pep Nation Lab',
    description: 'Which research peptides are studied via intranasal (nasal spray) route, graded by evidence strength.',
    url: 'https://pepnationlab.com/research/intranasal-peptides',
    type: 'article',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Intranasal Research Peptides' }],
  },
};

export const dynamic = 'force-dynamic';

function CompoundCard({ c }: { c: Compound }) {
  const tier = evidenceTier(c.evidence_tier);
  const nasal = intranasalDisplay(c);
  const mw = c.molecular_weight_da ? `${c.molecular_weight_da} Da` : (c.identity?.molecular_weight ?? null);
  return (
    <Link
      href={`/research/${c.slug}`}
      className="glass-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 'var(--space-4, 16px)',
        borderRadius: 'var(--radius-lg, 12px)',
        textDecoration: 'none',
        color: 'var(--white, #FFFFFF)',
        border: `1px solid ${nasal.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: '1.02rem', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2 }}>{c.display_name}</span>
        <span style={{
          fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em',
          color: nasal.color, border: `1px solid ${nasal.border}`, background: nasal.bg,
          padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
        }}>{nasal.badgeLabel}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: '0.7rem', color: '#A8B4C0' }}>
        <span style={{ color: tier.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{tier.label}</span>
        {c.category && <span>{c.category}</span>}
        {mw && <span>{mw}</span>}
        {c.intranasal_bioavailability_pct != null && (
          <span style={{ color: '#68D391', fontWeight: 700 }}>~{c.intranasal_bioavailability_pct}% Nasal Bioavailability</span>
        )}
      </div>
      {c.intranasal_note && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#C2CEDA', lineHeight: 1.5 }}>{c.intranasal_note}</p>
      )}
    </Link>
  );
}

function SectionTitle({ color, kicker, title, blurb }: { color: string; kicker: string; title: string; blurb: string }) {
  return (
    <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color }}>{kicker}</div>
      <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: '4px 0 0' }}>{title}</h2>
      <p style={{ fontSize: '0.95rem', color: 'var(--silver, #A8B4C0)', margin: '6px 0 0', maxWidth: 760, lineHeight: 1.6 }}>{blurb}</p>
    </div>
  );
}

export default async function IntranasalPeptidesPage() {
  const all = await getAllCompounds();
  const established = all
    .filter((c) => c.intranasal_status === 'established')
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
  const emerging = all
    .filter((c) => c.intranasal_status === 'emerging')
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
  const injectionOnly = all.filter((c) => !c.intranasal_status || c.intranasal_status === 'not_suitable');

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={16} /> Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 'var(--space-6, 32px)' }}>
        <div style={{ fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--teal, #00C4BC)' }}>
          Research Education
        </div>
        <h1 style={{ fontSize: '2.1rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: '6px 0 0', lineHeight: 1.15 }}>
          Intranasal Peptides: Which Research Compounds Are Studied As Nasal Sprays
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-3, 12px)', maxWidth: 820, lineHeight: 1.7 }}>
          Not every peptide can be delivered through the nose. Nasal absorption favors small molecules, so the question is
          decided mainly by molecular size and by whether real research exists for the nasal route. Below, every compound in
          the catalog is graded by the strength of that evidence. This page is for laboratory research reference only and is
          not medical or dosing advice.
        </p>
      </header>

      {/* How to read this */}
      <section className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', marginBottom: 'var(--space-6, 32px)' }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: '0 0 var(--space-3, 12px)' }}>How To Read The Tiers</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4, 16px)' }}>
          <div>
            <div style={{ color: '#68D391', fontWeight: 800, fontSize: '0.85rem', marginBottom: 4 }}>Nasal Available (Established)</div>
            <p style={{ margin: 0, fontSize: '0.86rem', color: '#C2CEDA', lineHeight: 1.6 }}>An approved or registered nasal product exists, or there is solid human clinical or research use via the nose. These are the genuine nasal-instead-of-injection candidates.</p>
          </div>
          <div>
            <div style={{ color: '#00E5FF', fontWeight: 800, fontSize: '0.85rem', marginBottom: 4 }}>Nasal - Emerging Research</div>
            <p style={{ margin: 0, fontSize: '0.86rem', color: '#C2CEDA', lineHeight: 1.6 }}>Real published intranasal research exists (often animal models) or there is a strong size and mechanism rationale, but it is not yet a standard, validated human route. Promising, not proven.</p>
          </div>
          <div>
            <div style={{ color: '#A8B4C0', fontWeight: 800, fontSize: '0.85rem', marginBottom: 4 }}>Injection Only</div>
            <p style={{ margin: 0, fontSize: '0.86rem', color: '#C2CEDA', lineHeight: 1.6 }}>Injection is the established route in practice. The compound is either too large to cross the nasal lining, has no credible nasal evidence, or its validated route is injection.</p>
          </div>
        </div>
        <p style={{ margin: 'var(--space-4, 16px) 0 0', fontSize: '0.82rem', color: '#9FB0BD', lineHeight: 1.6 }}>
          A nasal spray being sold somewhere is a marketing decision, not proof the route works. Several compounds are sold as
          sprays online while resting only on animal data or anecdote; those sit in the Emerging tier, not Established.
        </p>
      </section>

      {/* GLP-1 warning */}
      <section style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', marginBottom: 'var(--space-6, 32px)', background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.3)' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 900, color: '#FCA5A5', margin: '0 0 8px' }}>Important: The GLP-1 Weight-Loss Peptides Are Not Nasal-Viable</h2>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#E7C9C9', lineHeight: 1.7 }}>
          Semaglutide, Tirzepatide, Retatrutide, Survodutide, and Cagrilintide are all large acylated peptides (roughly 4,100
          to 5,000 Da). They are injection compounds in practice, and any nasal-spray version sold elsewhere has no validated
          absorption data. Do not assume an injectable GLP-1 can be swapped for an equivalent nasal spray.
        </p>
      </section>

      {/* Established collection */}
      <section style={{ marginBottom: 'var(--space-7, 40px)' }}>
        <SectionTitle
          color="#68D391"
          kicker={`${established.length} Compounds`}
          title="Established Nasal Candidates"
          blurb="Approved or registered nasal products, or solid human clinical use. Select any compound for its full research profile."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4, 16px)' }}>
          {established.map((c) => <CompoundCard key={c.slug} c={c} />)}
        </div>
      </section>

      {/* Emerging collection */}
      <section style={{ marginBottom: 'var(--space-7, 40px)' }}>
        <SectionTitle
          color="#00E5FF"
          kicker={`${emerging.length} Compounds`}
          title="Emerging Nasal Candidates"
          blurb="Real but preliminary intranasal research, not yet a standard human route. Injection remains the established route for these."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4, 16px)' }}>
          {emerging.map((c) => <CompoundCard key={c.slug} c={c} />)}
        </div>
      </section>

      {/* Injection only */}
      <section className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', marginBottom: 'var(--space-6, 32px)' }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: '0 0 8px' }}>Injection-Only Compounds ({injectionOnly.length})</h2>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#C2CEDA', lineHeight: 1.7 }}>
          The remaining catalog compounds are studied via injection in practice, because they are too large for nasal
          absorption, lack credible nasal evidence, or have injection as their validated route. Each compound&apos;s research
          profile and spec sheet shows its administration route.
        </p>
      </section>

      {/* Sources */}
      <section style={{ marginBottom: 'var(--space-6, 32px)' }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', margin: '0 0 var(--space-3, 12px)' }}>Selected Sources</h2>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.82rem', color: 'var(--silver, #A8B4C0)' }}>
          <li><IframeLink href="https://pmc.ncbi.nlm.nih.gov/articles/PMC1874377/" style={{ color: 'var(--teal, #00C4BC)' }}>Intranasal melatonin pharmacokinetics (PMC)</IframeLink></li>
          <li><IframeLink href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5516583/" style={{ color: 'var(--teal, #00C4BC)' }}>Intranasal glutathione clinical trial (PMC)</IframeLink></li>
          <li><IframeLink href="https://en.wikipedia.org/wiki/Selank" style={{ color: 'var(--teal, #00C4BC)' }}>Selank nasal registration overview</IframeLink></li>
          <li><IframeLink href="https://www.accessdata.fda.gov/drugsatfda_docs/label/2014/021642s020lbl.pdf" style={{ color: 'var(--teal, #00C4BC)' }}>FDA label: cobalamin (B12) nasal spray</IframeLink></li>
          <li><IframeLink href="https://pubmed.ncbi.nlm.nih.gov/8548949/" style={{ color: 'var(--teal, #00C4BC)' }}>Intranasal hexarelin pediatric trial (PubMed)</IframeLink></li>
        </ul>
      </section>

      <p style={{ fontSize: '0.74rem', color: 'var(--grey-400, #6B7785)', lineHeight: 1.5, margin: 0, textAlign: 'center' }}>
        Research Use Only. Not For Human Or Veterinary Use. Information Provided For Laboratory Research Purposes Only.
      </p>
    </div>
  );
}
