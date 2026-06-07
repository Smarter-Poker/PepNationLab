/**
 * Research Library index - the entry point to the PepNationLab Research section.
 * Server component: fetches the full compound catalog, renders research-area
 * tiles, quick links, the Ask The Lab assistant, and the faceted browser.
 * Research-use-only framing throughout.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { GitCompare, Layers, ShieldCheck, GraduationCap, BookOpen, HelpCircle, Sparkles, Calculator, Library, Table2 } from 'lucide-react';
import { getAllCompounds } from '@/lib/compounds-server';
import { RESEARCH_AREAS } from '@/lib/compounds';
import AskTheLab from '@/components/research/AskTheLab';
import ResearchBrowser from '@/components/research/ResearchBrowser';
import UniversalSearch from '@/components/research/UniversalSearch';

export const metadata: Metadata = {
  title: 'Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function ResearchLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const compounds = await getAllCompounds();

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1
          style={{
            fontSize: '2.25rem',
            fontWeight: 900,
            color: 'var(--white, #FFFFFF)',
            margin: 0,
          }}
        >
          Research Library
        </h1>
        <p
          style={{
            color: 'var(--silver, #A8B4C0)',
            fontSize: '1.05rem',
            marginTop: 'var(--space-2, 8px)',
            maxWidth: '720px',
          }}
        >
          Factual, Research-Use-Only Reference For Every Compound In The Catalog. Fifteen Research
          Areas, Every Sold Compound Profiled, And A Match-Me Engine To Suggest Candidates From Your
          Research Goal. For Laboratory Research Only.
        </p>
      </header>

      <section style={{ marginBottom: 'var(--space-7, 48px)' }}>
        <UniversalSearch initialQuery={q ?? ''} autoFocus={Boolean(q)} />
      </section>

      <section style={{ marginBottom: 'var(--space-6, 32px)', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/research/match" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '20px', textDecoration: 'none', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Sparkles size={16} color="var(--teal, #00C4BC)" /> Match Me
        </Link>
        <Link href="/research/compare" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '20px', textDecoration: 'none', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <GitCompare size={16} color="var(--silver, #A8B4C0)" /> Compare
        </Link>
        <Link href="/research/calculators" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '20px', textDecoration: 'none', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Calculator size={16} color="var(--silver, #A8B4C0)" /> Calculators
        </Link>
        <Link href="/research/data" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '20px', textDecoration: 'none', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Table2 size={16} color="var(--silver, #A8B4C0)" /> Data Table
        </Link>
        <Link href="/research/stacks" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '20px', textDecoration: 'none', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Layers size={16} color="var(--silver, #A8B4C0)" /> Stacks
        </Link>
        <Link href="/research/evidence" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '20px', textDecoration: 'none', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <ShieldCheck size={16} color="var(--silver, #A8B4C0)" /> Safety
        </Link>
        <Link href="/research/learn" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '20px', textDecoration: 'none', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <GraduationCap size={16} color="var(--silver, #A8B4C0)" /> Learn
        </Link>
        <Link href="/research/glossary" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '20px', textDecoration: 'none', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <BookOpen size={16} color="var(--silver, #A8B4C0)" /> Glossary
        </Link>
        <Link href="/research/faq" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '20px', textDecoration: 'none', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <HelpCircle size={16} color="var(--silver, #A8B4C0)" /> FAQ
        </Link>
        <Link href="/research/references" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '20px', textDecoration: 'none', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Library size={16} color="var(--silver, #A8B4C0)" /> References
        </Link>
      </section>

      <ResearchBrowser compounds={compounds} />
    </div>
  );
}
