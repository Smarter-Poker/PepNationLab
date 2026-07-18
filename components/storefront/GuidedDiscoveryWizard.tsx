'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Compass } from 'lucide-react';
import type { Compound } from '@/lib/compounds';
import { labelForArea, DEFAULT_WIZARD, type WizardState } from './discovery-shared';
import { useModalA11y } from '@/lib/useModalA11y';

export function GuidedDiscoveryWizard({
  open,
  availableAreas,
  onClose,
  onSubmit,
  primaryColor,
}: {
  open: boolean;
  availableAreas: string[];
  onClose: () => void;
  onSubmit: (state: WizardState) => void;
  primaryColor: string;
}) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(DEFAULT_WIZARD);

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => {
        setStep(0);
        setState(s => ({ ...s, area: availableAreas[0] || 'healing' }));
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [open, availableAreas]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // A11y: initial focus, Tab trap, Escape-to-close, focus restore
  const dialogRef = useModalA11y<HTMLDivElement>(open, { onClose });

  const TOTAL_STEPS = 4;

  const variants = {
    initial: { x: 20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -20, opacity: 0 }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={dialogRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Guided Discovery"
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 850,
            background: 'rgba(5,10,15,0.82)',
            backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 560,
              background: 'rgba(15, 25, 35, 0.85)', color: '#FFFFFF',
              borderRadius: 20,
              border: '6px solid #E2E8F0',
              boxSizing: 'border-box',
              boxShadow: `0 20px 48px ${primaryColor}33`,
              display: 'flex', flexDirection: 'column',
              maxHeight: 'calc(100dvh - 32px)',
            }}
          >
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '14px 18px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: `linear-gradient(135deg, ${primaryColor}22 0%, transparent 60%)`,
                borderTopLeftRadius: 20, borderTopRightRadius: 20,
              }}
            >
              <Compass size={18} aria-hidden style={{ color: '#C0C5CE' }} />
              <div style={{ fontWeight: 800, fontSize: '0.98rem', flex: 1 }}>Let Us Guide You</div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.16)',
                  color: '#FFFFFF', borderRadius: 10, padding: 8, cursor: 'pointer',
                  minWidth: 40, minHeight: 40,
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '14px 18px 6px', display: 'flex', gap: 6 }}>
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1, height: 4, borderRadius: 999,
                    background: i <= step ? '#C0C5CE' : 'rgba(255,255,255,0.10)',
                    transition: 'background 0.3s ease',
                  }}
                />
              ))}
            </div>

            <div style={{ padding: '14px 18px 18px', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.div key="step0" variants={variants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>What Research Area Are You Focused On?</h3>
                    <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.88rem', lineHeight: 1.5, marginTop: 6 }}>
                      Pick The Area Closest To Your Goal. We Will Match Compounds Studied For That Area.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                      {availableAreas.map((area) => {
                        const active = state.area === area;
                        return (
                          <button
                            key={area}
                            type="button"
                            onClick={() => { setState(s => ({ ...s, area })); setStep(1); }}
                            style={{
                              padding: '10px 14px',
                              borderRadius: 12,
                              background: active ? 'rgba(192,197,206,0.2)' : 'rgba(255,255,255,0.05)',
                              border: active ? '1px solid #C0C5CE' : '1px solid rgba(255,255,255,0.14)',
                              color: active ? '#C0C5CE' : '#FFFFFF',
                              fontWeight: 700, fontSize: '0.86rem',
                              cursor: 'pointer', minHeight: 44, transition: 'all 0.2s ease',
                            }}
                          >
                            {labelForArea(area)}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div key="step1" variants={variants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Single Compounds Or Blended Stacks?</h3>
                    <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.88rem', lineHeight: 1.5, marginTop: 6 }}>
                      Stacks Bundle Multiple Peptides Into One Vial For Combined Effects. Singles Let You Mix Your Own Protocol.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginTop: 14 }}>
                      {([
                        { v: 'single', label: 'Single Compounds', sub: 'I Want To Build My Own Protocol.' },
                        { v: 'stack', label: 'Blended Stacks', sub: 'I Want A Pre-Built Combination.' },
                        { v: 'either', label: 'Show Me Both', sub: 'I Am Open To Either.' },
                      ] as const).map(o => {
                        const active = state.preference === o.v;
                        return (
                          <button
                            key={o.v}
                            type="button"
                            onClick={() => { setState(s => ({ ...s, preference: o.v })); setStep(2); }}
                            style={{
                              textAlign: 'left',
                              padding: '14px 16px',
                              borderRadius: 12,
                              background: active ? 'rgba(192,197,206,0.15)' : 'rgba(255,255,255,0.04)',
                              border: active ? '1px solid #C0C5CE' : '1px solid rgba(255,255,255,0.12)',
                              color: '#FFFFFF',
                              cursor: 'pointer', minHeight: 56, transition: 'all 0.2s ease',
                            }}
                          >
                            <div style={{ fontWeight: 800, fontSize: '0.96rem', color: active ? '#C0C5CE' : '#FFF' }}>{o.label}</div>
                            <div style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.82rem', marginTop: 2 }}>{o.sub}</div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="step2" variants={variants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>How Well-Studied Should The Compound Be?</h3>
                    <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.88rem', lineHeight: 1.5, marginTop: 6 }}>
                      Stricter Comfort Returns Fewer But More Established Compounds. Looser Comfort Opens Up Newer Research Areas.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginTop: 14 }}>
                      {([
                        { v: 'strict_human_only', label: 'Approved Compounds Only',     sub: 'Strongest Human Evidence.' },
                        { v: 'investigational_ok', label: 'Investigational Or Better', sub: 'Active Clinical Trials Allowed.' },
                        { v: 'preclinical_ok',     label: 'Preclinical Or Better',     sub: 'Animal And Cell Studies Allowed (Recommended).' },
                        { v: 'any',                label: 'Any Research Stage',        sub: 'Show Me Everything Studied For My Goal.' },
                      ] as const).map(o => {
                        const active = state.comfort === o.v;
                        return (
                          <button
                            key={o.v}
                            type="button"
                            onClick={() => { setState(s => ({ ...s, comfort: o.v })); setStep(3); }}
                            style={{
                              textAlign: 'left',
                              padding: '14px 16px',
                              borderRadius: 12,
                              background: active ? 'rgba(192,197,206,0.15)' : 'rgba(255,255,255,0.04)',
                              border: active ? '1px solid #C0C5CE' : '1px solid rgba(255,255,255,0.12)',
                              color: '#FFFFFF',
                              cursor: 'pointer', minHeight: 56, transition: 'all 0.2s ease',
                            }}
                          >
                            <div style={{ fontWeight: 800, fontSize: '0.96rem', color: active ? '#C0C5CE' : '#FFF' }}>{o.label}</div>
                            <div style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.82rem', marginTop: 2 }}>{o.sub}</div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div key="step-3" variants={variants} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>
                      Step 4 of 4
                    </div>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: 800 }}>What Is Your Budget Appetite?</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { v: 'conservative', label: 'Conservative', sub: 'Prioritize Single, Foundational Compounds' },
                        { v: 'standard', label: 'Standard', sub: 'Balanced Recommendations' },
                        { v: 'unlimited', label: 'Unlimited', sub: 'Show Me The Absolute Best, Regardless Of Price' },
                      ].map(o => {
                        const active = state.budget === o.v;
                        return (
                          <button
                            key={o.v}
                            type="button"
                            onClick={() => setState(s => ({ ...s, budget: o.v as 'conservative' | 'standard' | 'unlimited' }))}
                            style={{
                              textAlign: 'left',
                              padding: '14px 16px',
                              borderRadius: 12,
                              background: active ? 'rgba(192,197,206,0.15)' : 'rgba(255,255,255,0.04)',
                              border: active ? '1px solid #C0C5CE' : '1px solid rgba(255,255,255,0.12)',
                              color: '#FFFFFF',
                              cursor: 'pointer', minHeight: 56, transition: 'all 0.2s ease',
                            }}
                          >
                            <div style={{ fontWeight: 800, fontSize: '0.96rem', color: active ? '#C0C5CE' : '#FFF' }}>{o.label}</div>
                            <div style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.82rem', marginTop: 2 }}>{o.sub}</div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div
              style={{
                display: 'flex', gap: 10, padding: '12px 18px 16px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
              }}
            >
              <button
                type="button"
                onClick={() => (step > 0 ? setStep(step - 1) : onClose())}
                style={{
                  flex: 1,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.18)',
                  color: '#FFFFFF', fontWeight: 700, fontSize: '0.92rem',
                  padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                  minHeight: 48,
                }}
              >
                {step === 0 ? 'Cancel' : 'Back'}
              </button>
              {step < TOTAL_STEPS - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  style={{
                    flex: 1,
                    background: '#C0C5CE', color: '#0A1018', border: 0,
                    fontWeight: 900, fontSize: '0.92rem',
                    padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    minHeight: 48,
                    boxShadow: '0 4px 12px rgba(192,197,206,0.3)',
                  }}
                >
                  Next <ArrowRight size={16} aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSubmit(state)}
                  style={{
                    flex: 1,
                    background: '#C0C5CE', color: '#0A1018', border: 0,
                    fontWeight: 900, fontSize: '0.92rem',
                    padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                    minHeight: 48,
                    boxShadow: '0 4px 12px rgba(192,197,206,0.3)',
                  }}
                >
                  Reveal Top Matches
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
