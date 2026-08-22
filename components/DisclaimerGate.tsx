'use client';

import { useState } from 'react';
import { useModalA11y } from '@/lib/useModalA11y';

interface DisclaimerGateProps {
  onAccept: () => void;
}

export default function DisclaimerGate({ onAccept }: DisclaimerGateProps) {
  const [checks, setChecks] = useState({ c1: false, c2: false, c3: false });
  const allChecked = checks.c1 && checks.c2 && checks.c3;

  const toggle = (key: keyof typeof checks) =>
    setChecks(prev => ({ ...prev, [key]: !prev[key] }));

  // A11y: move focus into the mandatory gate and trap Tab inside it
  // (WCAG 2.1.2, 2.4.3). No onClose: this legal gate cannot be dismissed
  // with Escape by design.
  const gateRef = useModalA11y<HTMLDivElement>(true);

  return (
    <div data-nosnippet className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '5vh', paddingBottom: '5vh' }}>
      {/* Pep Nation wordmark */}
      <div ref={gateRef} className="modal-content" role="dialog" aria-modal="true" aria-label="Mandatory Research-Only Acknowledgment" style={{ maxWidth: 680 }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div style={{ 
            fontFamily: 'var(--font-brand)', 
            fontSize: '1.1rem', 
            color: 'var(--teal)', 
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: 'var(--space-2)',
            textShadow: '0 0 20px rgba(192,184,168,0.5)'
          }}>
            Pep Nation Lab
          </div>
          <div className="disclaimer-title" style={{ justifyContent: 'center' }}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Mandatory Research-Only Acknowledgment
          </div>
          <div style={{ 
            width: 60, height: 2, 
            background: 'linear-gradient(90deg, transparent, var(--red), transparent)',
            margin: '0 auto var(--space-4)'
          }}/>
        </div>

        {/* Main disclaimer text */}
        <div className="disclaimer-box" style={{ marginBottom: 'var(--space-6)' }}>
          <p className="disclaimer-text" style={{ marginBottom: 'var(--space-4)' }}>
            <strong style={{ color: 'var(--white)' }}>Stop. Read Carefully Before Entering Pep Nation Lab.</strong>
          </p>
          <p className="disclaimer-text" style={{ marginBottom: 'var(--space-4)' }}>
            By Entering This Site And Purchasing Products, You Expressly Acknowledge And Warrant:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {[
              { num: '1', text: <><strong style={{color:'var(--white)'}}>Research Use Only.</strong> All Products Are Sold Strictly For <em>In Vitro</em> (Outside The Body) Laboratory Research And Analytical Science Purposes Only. They Are <strong style={{color:'var(--red)'}}>NOT</strong> Intended For Human Or Animal Consumption, Ingestion, Injection, Or Any Clinical, Therapeutic, Diagnostic, Or Cosmetic Use.</> },
              { num: '2', text: <><strong style={{color:'var(--white)'}}>Not FDA Approved.</strong> None Of Our Products Have Been Evaluated Or Approved By The FDA For Use In Humans Or Animals. These Are Not Drugs, Supplements, Food, Or Medical Devices.</> },
              { num: '3', text: <><strong style={{color:'var(--white)'}}>You Are A Qualified Researcher.</strong> You Are At Least <strong style={{color:'var(--white)'}}>21 Years Of Age</strong> And A Qualified Scientist, Researcher, Or Institutional Purchaser With The Training, Facilities, And Authority To Handle Research-Grade Chemical Compounds.</> },
              { num: '4', text: <><strong style={{color:'var(--white)'}}>No Human Or Animal Use.</strong> You Will NOT Use These Products For Any Human Or Veterinary Purpose, And Will NOT Provide Them To Anyone For Consumption Or Injection.</> },
              { num: '5', text: <><strong style={{color:'var(--white)'}}>Banned Items.</strong> Pep Nation Lab <strong style={{color:'var(--red)'}}>NEVER</strong> Sells Needles, Syringes, Or Any Injection Delivery Devices - And Neither Do Any Of Our Agents. Period.</> },
              { num: '6', text: <><strong style={{color:'var(--white)'}}>Indemnification.</strong> You Assume Full Responsibility For Safe Handling, Storage, And Disposal Of All Products And Agree To Hold Pep Nation Lab LLC Harmless From Any Claims Arising From Your Use Of These Products.</> },
              { num: '7', text: <><strong style={{color:'var(--white)'}}>Legal Compliance.</strong> You Are Solely Responsible For Ensuring Your Purchase And Use Complies With All Applicable Local, State, Federal, And International Laws.</> },
            ].map(({ num, text }) => (
              <div key={num} style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <div style={{
                  minWidth: 24, height: 24, borderRadius: '50%',
                  background: 'rgba(229,62,62,0.15)', border: '1px solid rgba(229,62,62,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 700, color: 'var(--red)', flexShrink: 0
                }}>{num}</div>
                <p className="disclaimer-text" style={{ fontSize: '0.85rem' }}>{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Three mandatory checkboxes */}
        <div role="group" aria-label="Required Acknowledgments" style={{
          background: 'var(--surface-2)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
          border: 'var(--border-silver)',
          marginBottom: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)'
        }}>
          <p style={{ 
            fontSize: '0.8rem', 
            color: 'var(--grey-400)', 
            textTransform: 'uppercase', 
            letterSpacing: '0.08em',
            fontWeight: 600
          }}>
            You Must Check All Three Boxes To Proceed:
          </p>

          {[
            { key: 'c1' as const, text: 'I Confirm I Am At Least 21 Years Of Age And A Qualified Researcher Or Institutional Purchaser.' },
            { key: 'c2' as const, text: 'I Confirm That All Products I Purchase Are For In Vitro Laboratory Research Purposes Only And Will Not Be Used For Human Or Animal Consumption Or Injection.' },
            { key: 'c3' as const, text: 'I Confirm I Have Read And Agree To The Pep Nation Lab Research-Only Terms Of Service And Assume Full Legal Responsibility For My Purchases.' },
          ].map(({ key, text }) => (
            <label
              key={key}
              className="form-checkbox"
              onClick={() => toggle(key)}
              role="checkbox"
              aria-checked={checks[key]}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  if (e.key === ' ') e.preventDefault();
                  toggle(key);
                }
              }}
            >
              <div style={{
                width: 22, height: 22, minWidth: 22, borderRadius: 4,
                border: `2px solid ${checks[key] ? 'var(--teal)' : 'var(--silver-dark)'}`,
                background: checks[key] ? 'var(--teal)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease', cursor: 'pointer', marginTop: 2
              }}>
                {checks[key] && (
                  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#050A0F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span style={{ 
                fontSize: '0.875rem', 
                color: checks[key] ? 'var(--white)' : 'var(--silver)',
                cursor: 'pointer',
                lineHeight: 1.5,
                transition: 'color 0.2s ease'
              }}>
                {text}
              </span>
            </label>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexDirection: 'column', alignItems: 'center' }}>
          <button
            className="btn btn-primary btn-xl"
            onClick={onAccept}
            disabled={!allChecked}
            style={{
              opacity: allChecked ? 1 : 0.4,
              cursor: allChecked ? 'pointer' : 'not-allowed',
              fontSize: '1rem',
              fontFamily: 'var(--font-brand)',
              letterSpacing: '0.05em',
              textAlign: 'center',
              justifyContent: 'center'
            }}
          >
            I Understand And Agree - Enter Site
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => { try { window.close(); } catch (_) { /* browser may block */ } window.location.href = 'about:blank'; }}
            style={{ fontSize: '0.85rem', color: 'var(--grey-400)', textAlign: 'center', justifyContent: 'center' }}
          >
            I Do Not Agree - Exit
          </button>
        </div>

        <p style={{ 
          textAlign: 'center', 
          fontSize: '0.7rem', 
          color: 'var(--grey-600)',
          marginTop: 'var(--space-4)',
          lineHeight: 1.5
        }}>
          By Entering This Site, You Enter Into A Legally Binding Acknowledgment Of The Above Terms.
          Your Acceptance Is Logged With Timestamp And IP Address.
        </p>
      </div>
    </div>
  );
}
