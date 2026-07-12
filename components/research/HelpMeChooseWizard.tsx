'use client';

import React, { useState } from 'react';
import { X, Sparkles, Flame, Shield, Heart, Moon } from 'lucide-react';
import { useModalA11y } from '@/lib/useModalA11y';

interface WizardFilters {
  area: string;
  form: string;
  budget: string;
  prep: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (filters: WizardFilters) => void;
}

export default function HelpMeChooseWizard({ isOpen, onClose, onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [area, setArea] = useState('all');
  const [form, setForm] = useState('all');
  const [budget, setBudget] = useState('all');
  const [prep, setPrep] = useState('all');

  // A11y: initial focus, Tab trap, Escape-to-close, focus restore
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, { onClose });

  if (!isOpen) return null;

  const handleNext = () => {
    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setStep((prev) => prev - 1);
  };

  const handleFinish = () => {
    onComplete({ area, form, budget, prep });
    setStep(1);
    onClose();
  };

  const handleReset = () => {
    setArea('all');
    setForm('all');
    setBudget('all');
    setPrep('all');
    setStep(1);
  };

  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  };

  const modalContainerStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(22, 34, 48, 0.95), rgba(15, 23, 32, 0.98))',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 'var(--radius-lg, 12px)',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
    width: '90%',
    maxWidth: '520px',
    padding: 'var(--space-6, 32px)',
    color: 'var(--white, #FFFFFF)',
    position: 'relative',
  };

  const buttonBaseStyle: React.CSSProperties = {
    padding: '10px 20px',
    fontSize: '0.9rem',
    fontWeight: 700,
    borderRadius: 'var(--radius-md, 8px)',
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s ease',
  };

  const optionCardStyle = (selected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 18px',
    borderRadius: 'var(--radius-md, 8px)',
    border: `1px solid ${selected ? 'var(--teal, #00C4BC)' : 'rgba(255,255,255,0.06)'}`,
    background: selected ? 'rgba(0, 196, 188, 0.1)' : 'rgba(255,255,255,0.02)',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    transition: 'all 0.2s ease',
    color: selected ? 'var(--white, #FFFFFF)' : 'var(--silver, #A8B4C0)',
  });

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div ref={dialogRef} style={modalContainerStyle} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Help Me Choose Wizard">
        <button
          onClick={onClose}
          aria-label="Close Wizard"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: 'var(--silver, #A8B4C0)',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>

        <header style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={20} color="var(--teal, #00C4BC)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
            Help Me Choose Wizard
          </h2>
        </header>

        {/* Step Indicator */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '999px',
                background: s <= step ? 'var(--teal, #00C4BC)' : 'rgba(255,255,255,0.1)',
                transition: 'background 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Question 1: Goal */}
        {step === 1 && (
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '18px' }}>
              What Is The Primary Target Of Your Study?
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setArea('weight_management')}
                style={optionCardStyle(area === 'weight_management')}
              >
                <Flame size={18} color="var(--teal, #00C4BC)" />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)' }}>Fat Loss</div>
                  <div style={{ fontSize: '0.75rem' }}>Weight Management And Fat Loss Axis</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setArea('healing')}
                style={optionCardStyle(area === 'healing')}
              >
                <Shield size={18} color="var(--teal, #00C4BC)" />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)' }}>Healing</div>
                  <div style={{ fontSize: '0.75rem' }}>Tissue Repair And Wound Healing Recovery</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setArea('longevity')}
                style={optionCardStyle(area === 'longevity')}
              >
                <Heart size={18} color="var(--teal, #00C4BC)" />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)' }}>Anti-Aging</div>
                  <div style={{ fontSize: '0.75rem' }}>Cellular Longevity And Healthspan Research</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setArea('sleep')}
                style={optionCardStyle(area === 'sleep')}
              >
                <Moon size={18} color="var(--teal, #00C4BC)" />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)' }}>Sleep</div>
                  <div style={{ fontSize: '0.75rem' }}>Deep Sleep And Circadian Rhythm Optimization</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Question 2: Route */}
        {step === 2 && (
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '18px' }}>
              Preferred Administration Route?
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setForm('injection')}
                style={optionCardStyle(form === 'injection')}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)' }}>Injectable</div>
                  <div style={{ fontSize: '0.75rem' }}>Lyophilized Powder Vials For Subcutaneous Preparation</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setForm('oral')}
                style={optionCardStyle(form === 'oral')}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)' }}>Oral Capsule</div>
                  <div style={{ fontSize: '0.75rem' }}>Gastric-Stable Capsules Or Oral Liquids</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setForm('topical')}
                style={optionCardStyle(form === 'topical')}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)' }}>Topical</div>
                  <div style={{ fontSize: '0.75rem' }}>Creams, Serums, Or Intranasal Sprays</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setForm('all')}
                style={optionCardStyle(form === 'all')}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)' }}>No Constraint</div>
                  <div style={{ fontSize: '0.75rem' }}>Show All Available Formats</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Question 3: Budget */}
        {step === 3 && (
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '18px' }}>
              What Is Your Target Budget Per Vial?
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setBudget('conservative')}
                style={optionCardStyle(budget === 'conservative')}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)' }}>Conservative Budget</div>
                  <div style={{ fontSize: '0.75rem' }}>Prioritize Cost-Efficient Options</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setBudget('standard')}
                style={optionCardStyle(budget === 'standard')}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)' }}>Standard Budget</div>
                  <div style={{ fontSize: '0.75rem' }}>Balanced Value And Premium Reference Peptides</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setBudget('all')}
                style={optionCardStyle(budget === 'all')}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)' }}>No Constraint</div>
                  <div style={{ fontSize: '0.75rem' }}>Show All Available Peptides Regardless Of Cost</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Question 4: Reconstitution Prep */}
        {step === 4 && (
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '18px' }}>
              Do You Have Reconstitution Equipment?
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setPrep('reconstitution')}
                style={optionCardStyle(prep === 'reconstitution')}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)' }}>Yes (Lyophilized Vials)</div>
                  <div style={{ fontSize: '0.75rem' }}>Reconstitution Prep With Sterile Bacteriostatic Water Required</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPrep('no_reconstitution')}
                style={optionCardStyle(prep === 'no_reconstitution')}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)' }}>No (Premixed / Oral / Topical)</div>
                  <div style={{ fontSize: '0.75rem' }}>Show Ready-To-Use Formats (Capsules, Nasal Sprays, Creams Only)</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPrep('all')}
                style={optionCardStyle(prep === 'all')}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)' }}>No Constraint</div>
                  <div style={{ fontSize: '0.75rem' }}>Show Both Lyophilized Vials And Premixed Formats</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div
          style={{
            marginTop: '32px',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: '20px',
          }}
        >
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              style={{
                ...buttonBaseStyle,
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--white, #FFFFFF)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={handleReset}
              style={{
                ...buttonBaseStyle,
                background: 'transparent',
                color: 'var(--silver, #A8B4C0)',
              }}
            >
              Reset
            </button>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                style={{
                  ...buttonBaseStyle,
                  background: 'var(--teal, #00C4BC)',
                  color: 'var(--black, #0C151D)',
                }}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                style={{
                  ...buttonBaseStyle,
                  background: 'var(--teal, #00C4BC)',
                  color: 'var(--black, #0C151D)',
                  boxShadow: '0 0 15px rgba(0, 196, 188, 0.4)',
                }}
              >
                Finish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
