'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface Props {
  /** Fields missing from the user profile (subset of 'first_name'|'last_name'|'phone') */
  missingFields: string[];
  /** Current profile values so we can pre-fill any field that IS already set */
  initialValues: { first_name: string; last_name: string; phone: string };
  /** Called after a successful profile save — parent should router.refresh() */
  onComplete: () => void;
}

type Step = 'alert' | 'form';

/** Format raw digit string as XXX-XXX-XXXX */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function ProfileGateModal({ missingFields, initialValues, onComplete }: Props) {
  const [step, setStep] = useState<Step>('alert');
  const [firstName, setFirstName] = useState(initialValues.first_name);
  const [lastName, setLastName] = useState(initialValues.last_name);
  const [phone, setPhone] = useState(initialValues.phone);
  const [saving, setSaving] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  // Move focus to panel whenever step changes
  useEffect(() => {
    panelRef.current?.focus();
  }, [step]);

  // Non-dismissible: suppress Escape + implement Tab trap
  useEffect(() => {
    const trap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    window.addEventListener('keydown', trap, true);
    return () => window.removeEventListener('keydown', trap, true);
  }, []);

  const needsFirstName = missingFields.includes('first_name');
  const needsLastName  = missingFields.includes('last_name');
  const needsPhone     = missingFields.includes('phone');

  const canSave =
    (!needsFirstName || firstName.trim().length > 0) &&
    (!needsLastName  || lastName.trim().length > 0) &&
    (!needsPhone     || phone.replace(/\D/g, '').length >= 10);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const patch: Record<string, string> = {};
      if (needsFirstName) patch.first_name = firstName.trim();
      if (needsLastName)  patch.last_name  = lastName.trim();
      if (needsPhone)     patch.phone      = phone.trim();

      const res = await fetch('/api/agent/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save profile.');
      toast.success('Profile updated — continuing to checkout.');
      onComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-gate-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div
        ref={panelRef}
        className="glass-panel"
        tabIndex={-1}
        style={{ maxWidth: 480, width: '100%', padding: 'var(--space-6)', outline: 'none' }}
      >

        {/* ── Step 1: Alert ── */}
        {step === 'alert' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(251,191,36,0.12)',
                border: '2px solid rgba(251,191,36,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.75rem',
              }}>
                ⚠️
              </div>
            </div>

            <h3
              id="profile-gate-title"
              style={{
                margin: '0 0 var(--space-3)', textAlign: 'center',
                color: 'var(--white)', fontSize: '1.15rem', fontWeight: 700, lineHeight: 1.35,
              }}
            >
              Before Completing Your Purchase, You Must Finish Your Profile
            </h3>

            <p style={{
              margin: '0 0 var(--space-5)', textAlign: 'center',
              color: 'var(--silver)', fontSize: '0.9rem', lineHeight: 1.65,
            }}>
              Your profile is missing required information. You&apos;ll be asked to fill it in before placing your order.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                autoFocus
                className="btn btn-primary"
                style={{ minWidth: 160, fontSize: '0.95rem', padding: '10px 28px' }}
                onClick={() => setStep('form')}
              >
                OK
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Inline profile form ── */}
        {step === 'form' && (
          <>
            <h3
              id="profile-gate-title"
              style={{ margin: '0 0 var(--space-2)', color: 'var(--white)', fontSize: '1.1rem', fontWeight: 700 }}
            >
              Finish Your Profile
            </h3>
            <p style={{ margin: '0 0 var(--space-5)', color: 'var(--silver)', fontSize: '0.85rem', lineHeight: 1.6 }}>
              All fields marked <span style={{ color: 'var(--red, #E53E3E)' }}>*</span> are required to continue.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

              {needsFirstName && (
                <div className="form-group">
                  <label className="form-label" htmlFor="pg-first-name">
                    First Name <span style={{ color: 'var(--red, #E53E3E)' }}>*</span>
                  </label>
                  <input
                    id="pg-first-name"
                    type="text"
                    className="form-input"
                    autoFocus
                    autoComplete="given-name"
                    maxLength={60}
                    placeholder="Jane"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={saving}
                  />
                </div>
              )}

              {needsLastName && (
                <div className="form-group">
                  <label className="form-label" htmlFor="pg-last-name">
                    Last Name <span style={{ color: 'var(--red, #E53E3E)' }}>*</span>
                  </label>
                  <input
                    id="pg-last-name"
                    type="text"
                    className="form-input"
                    autoComplete="family-name"
                    maxLength={60}
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={saving}
                  />
                </div>
              )}

              {needsPhone && (
                <div className="form-group">
                  <label className="form-label" htmlFor="pg-phone">
                    Phone Number <span style={{ color: 'var(--red, #E53E3E)' }}>*</span>
                  </label>
                  <input
                    id="pg-phone"
                    type="tel"
                    className="form-input"
                    autoComplete="tel"
                    inputMode="numeric"
                    maxLength={12}
                    placeholder="555-867-5309"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    disabled={saving}
                  />
                  {phone.replace(/\D/g, '').length > 0 && phone.replace(/\D/g, '').length < 10 && (
                    <p style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--red, #E53E3E)' }}>
                      Please enter a 10-digit US phone number.
                    </p>
                  )}
                </div>
              )}

            </div>

            <div style={{ marginTop: 'var(--space-5)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !canSave}
                style={{ minWidth: 140, fontSize: '0.95rem' }}
              >
                {saving ? 'Saving...' : 'Save & Continue to Checkout'}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
