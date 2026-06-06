export interface LegalSection {
  heading: string;
  body: string[];
  list?: string[];
}

export interface LegalDocumentProps {
  title: string;
  lastUpdated: string;
  intro: string[];
  sections: LegalSection[];
}

/**
 * Renders a structured legal/policy document with a numbered section
 * outline. Section headings are Title Case; body text is intentionally
 * sentence case, which is the documented exception for legally required
 * disclaimer wording.
 */
export default function LegalDocument({
  title,
  lastUpdated,
  intro,
  sections,
}: LegalDocumentProps) {
  return (
    <section className="section">
      <div className="container-sm">
        {/* Visible DRAFT badge - teal on black */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            background: 'var(--black)',
            color: 'var(--teal)',
            border: '1px solid var(--teal)',
            borderRadius: 'var(--radius-full)',
            padding: '6px 14px',
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 'var(--space-4)',
            boxShadow: '0 0 0 1px rgba(192,184,168,0.2), 0 0 12px rgba(192,184,168,0.2)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Draft - Pending Attorney Review
        </div>

        {/* Counsel review explanation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
            background: 'var(--red-bg)',
            border: '1px solid rgba(229,62,62,0.25)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-8)',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--red)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, marginTop: 2 }}
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p style={{ fontSize: '0.78rem', color: 'var(--silver)', margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--red)' }}>Template Document - Attorney Review Required.</strong>{' '}
            This document is a working template provided for platform completeness.
            It must be reviewed and approved by qualified legal counsel before public launch.
          </p>
        </div>

        {/* Document Body */}
        <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-8)' }}>
          {/* Title */}
          <h1 className="animated-gradient-text" style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>{title}</h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', marginBottom: 'var(--space-8)' }}>
            Last Updated: {lastUpdated}
          </p>

        {/* Intro */}
        <div className="glass-panel" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
          {intro.map((para, i) => (
            <p
              key={i}
              style={{
                fontSize: '0.9rem',
                color: 'var(--silver)',
                lineHeight: 1.7,
                marginBottom: i < intro.length - 1 ? 'var(--space-3)' : 0,
              }}
            >
              {para}
            </p>
          ))}
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
          {sections.map((section, i) => (
            <div key={section.heading}>
              <h2
                style={{
                  fontSize: '1.05rem',
                  color: 'var(--teal)',
                  marginBottom: 'var(--space-3)',
                  fontFamily: 'var(--font-brand)',
                }}
              >
                {i + 1}. {section.heading}
              </h2>
              {section.body.map((para, j) => (
                <p
                  key={j}
                  style={{
                    fontSize: '0.88rem',
                    color: 'var(--grey-300)',
                    lineHeight: 1.75,
                    marginBottom: 'var(--space-3)',
                  }}
                >
                  {para}
                </p>
              ))}
              {section.list && (
                <ul
                  style={{
                    fontSize: '0.88rem',
                    color: 'var(--grey-300)',
                    lineHeight: 1.7,
                    paddingLeft: 'var(--space-5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                  }}
                >
                  {section.list.map((item, k) => (
                    <li key={k}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

          {/* Contact footer */}
          <div
            style={{
              marginTop: 'var(--space-10)',
              paddingTop: 'var(--space-6)',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              fontSize: '0.82rem',
              color: 'var(--grey-400)',
            }}
          >
            Questions About This Document?{' '}
            <a href="mailto:support@pepnationlab.com" style={{ color: 'var(--teal)' }}>
              support@pepnationlab.com
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
