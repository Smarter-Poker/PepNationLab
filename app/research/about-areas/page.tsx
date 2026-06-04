import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, BookOpen, Layers } from 'lucide-react';
import { RESEARCH_AREAS } from '@/lib/compounds';

export const metadata: Metadata = {
  title: 'About Therapeutic Areas | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default function AboutAreasPage() {
  return (
    <div style={{ textTransform: 'capitalize' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)', minHeight: '100vh' }}>
        
        {/* Navigation Breadcrumbs */}
        <nav style={{ marginBottom: 'var(--space-5, 24px)', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
            Library
          </Link>
          <span style={{ color: 'var(--silver, #D0DAE4)' }}>/</span>
          <Link href="/research/areas" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
            Therapeutic Areas
          </Link>
          <span style={{ color: 'var(--silver, #D0DAE4)' }}>/</span>
          <span style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem' }}>About</span>
        </nav>

        {/* Page Header */}
        <header style={{ marginBottom: 'var(--space-8, 64px)' }}>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: '0 0 var(--space-3, 12px) 0' }}>
            <Activity size={32} aria-hidden="true" style={{ verticalAlign: '-4px', marginRight: 14, color: 'var(--teal, #00C4BC)' }} />
            About Therapeutic Areas
          </h1>
          <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.1rem', maxWidth: '800px', lineHeight: 1.6 }}>
            Understanding How Research Compounds Are Categorized By Biological Focus Rather Than Strict Chemical Structure. 
            This Organization Method Helps Researchers Discover Synergistic Stacks And Cross-Class Applications.
          </p>
        </header>

        {/* Section 1: The Philosophy */}
        <section style={{ marginBottom: 'var(--space-8, 64px)' }}>
          <div className="slate-card" style={{ padding: 'var(--space-6, 32px)', borderRadius: '16px' }}>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--teal, #00C4BC)', marginBottom: 'var(--space-4, 16px)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Layers size={24} />
              The Philosophy Of Focus Areas
            </h2>
            <p style={{ color: 'var(--silver, #D0DAE4)', lineHeight: 1.7, marginBottom: 'var(--space-3, 12px)' }}>
              In Laboratory Research, Compounds Are Frequently Studied In Isolation Based On Their Chemical Class (E.G., Growth Hormone Secretagogues, Incretin Mimetics). However, Real-World Biological Systems Do Not Operate In Isolation. 
            </p>
            <p style={{ color: 'var(--silver, #D0DAE4)', lineHeight: 1.7, marginBottom: 'var(--space-3, 12px)' }}>
              By Organizing Compounds Into "Therapeutic Areas", Researchers Can Easily Identify Cross-Class Synergies. For Example, A Protocol Targeting "Tissue Repair" Might Combine A Systemic Healing Agent (Like TB-500) With A Localized Angiogenic Peptide (Like BPC-157). 
            </p>
            <p style={{ color: 'var(--silver, #D0DAE4)', lineHeight: 1.7 }}>
              This Categorization Method Allows For Optimal Experimental Design, Helping You Find Exactly Which Pathways And Receptors Correspond To Your Specific Research Goals.
            </p>
          </div>
        </section>

        {/* Section 2: The 15 Categories */}
        <section style={{ marginBottom: 'var(--space-8, 64px)' }}>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--white, #FFFFFF)', marginBottom: 'var(--space-5, 24px)' }}>
            The 15 Therapeutic Categories
          </h2>
          <p style={{ color: 'var(--silver, #A8B4C0)', marginBottom: 'var(--space-6, 32px)', lineHeight: 1.6 }}>
            The Following 15 Areas Are Ranked By Current Market Popularity And Research Volume. Click Any Category To View The Specific Compounds Associated With That Biological Focus.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4, 16px)' }}>
            {Object.entries(RESEARCH_AREAS).map(([key, meta], index) => (
              <Link href={`/research/areas/${key}`} key={key} style={{ textDecoration: 'none' }}>
                <div className="glass-panel" style={{ padding: 'var(--space-4, 16px)', borderRadius: '12px', height: '100%', transition: 'all 0.2s ease' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '50%', 
                      backgroundColor: 'rgba(0, 196, 188, 0.1)', 
                      color: 'var(--teal, #00C4BC)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      flexShrink: 0
                    }}>
                      {index + 1}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', color: 'var(--white, #FFFFFF)', margin: '0 0 8px 0' }}>{meta.label}</h3>
                      <p style={{ fontSize: '0.9rem', color: 'var(--silver, #A8B4C0)', margin: 0, lineHeight: 1.5 }}>{meta.blurb}</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Section 3: Integration with Learn Hub */}
        <section style={{ marginBottom: 'var(--space-8, 64px)' }}>
          <div className="slate-card" style={{ padding: 'var(--space-6, 32px)', borderRadius: '16px', borderLeft: '4px solid var(--teal, #00C4BC)' }}>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--teal, #00C4BC)', marginBottom: 'var(--space-4, 16px)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <BookOpen size={24} />
              Foundation Knowledge & Research Principles
            </h2>
            <p style={{ color: 'var(--silver, #D0DAE4)', lineHeight: 1.7, marginBottom: 'var(--space-4, 16px)' }}>
              No Matter Which Therapeutic Area You Are Investigating, Universal Principles Apply To All Research Compounds. Understanding How To Read Evidence Tiers, Properly Reconstitute Vials, And Safely Store Lyophilized Peptides Is Mandatory For Accurate Data Collection.
            </p>
            <p style={{ color: 'var(--silver, #D0DAE4)', lineHeight: 1.7, marginBottom: 'var(--space-5, 24px)' }}>
              We Have Consolidated All Foundational Knowledge Into The Peptide Education Hub. We Strongly Recommend Reviewing These Materials Before Beginning Any Experimental Protocol.
            </p>
            <Link href="/research/learn" style={{ textDecoration: 'none' }}>
              <button style={{
                backgroundColor: 'var(--teal, #00C4BC)',
                color: '#000000',
                fontWeight: 700,
                fontSize: '1.05rem',
                padding: '16px 32px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'opacity 0.2s ease'
              }}>
                <BookOpen size={20} />
                Access The Education Hub
              </button>
            </Link>
          </div>
        </section>

        {/* Footer Disclaimer */}
        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 'var(--space-5, 24px)' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-500, #6B7785)', textAlign: 'center' }}>
            For Laboratory Research Use Only. This Material Restates Published Science And Is Not Medical Advice, Dosing Guidance, Or An Endorsement Of Human Use. Not For Human Consumption.
          </p>
        </footer>

      </div>
    </div>
  );
}
