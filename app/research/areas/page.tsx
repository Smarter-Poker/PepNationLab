import type { Metadata } from 'next';
import Link from 'next/link';
import { RESEARCH_AREAS } from '@/lib/compounds';
import { ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Therapeutic Areas | Research Library',
  robots: { index: false, follow: false },
};

export default function TherapeuticAreasPage() {
  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <header style={{ marginBottom: 'var(--space-7, 48px)' }}>
        <h1
          style={{
            fontSize: '2.25rem',
            fontWeight: 900,
            color: 'var(--white, #FFFFFF)',
            margin: 0,
          }}
        >
          Therapeutic Areas
        </h1>
        <p
          style={{
            color: 'var(--silver, #A8B4C0)',
            fontSize: '1.05rem',
            marginTop: 'var(--space-2, 8px)',
            maxWidth: '720px',
          }}
        >
          Explore Research Compounds By Focus Area.
        </p>
      </header>

      <style>{`
        .areas-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-auto-rows: 1fr;
          gap: var(--space-4, 16px);
        }
        @media (max-width: 900px) {
          .areas-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 600px) {
          .areas-grid {
            grid-template-columns: 1fr;
            grid-auto-rows: auto;
          }
        }
        .area-card {
          display: flex;
          flex-direction: column;
          gap: var(--space-2, 8px);
          padding: var(--space-4, 16px);
          border-radius: var(--radius-lg, 12px);
          text-decoration: none;
          color: var(--white, #FFFFFF);
          height: 100%;
        }
      `}</style>
      <section style={{ marginBottom: 'var(--space-7, 48px)' }}>
        <div className="areas-grid">
          {Object.keys(RESEARCH_AREAS).map((key) => {
            const meta = RESEARCH_AREAS[key];
            return (
              <Link
                key={key}
                href={`/research/area/${key}`}
                className="card-metal area-card"
              >
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--teal, #00C4BC)' }}>
                  {meta.label}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)' }}>{meta.blurb}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-8, 64px)' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(187, 163, 113, 0.3)',
          borderRadius: '999px',
          padding: '12px 24px',
        }}>
          <ShieldCheck size={18} color="#BBA371" />
          <span style={{ color: '#A8B4C0', fontSize: '0.9rem', letterSpacing: '0.02em' }}>
            Research Use Only <span style={{ color: '#BBA371', margin: '0 8px' }}>•</span> Not For Human Use
          </span>
        </div>
      </div>
    </div>
  );
}
