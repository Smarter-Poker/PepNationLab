'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

/* ─────────────────────────────────────────────────────────
   All supported payment methods with labels and placeholders
   ───────────────────────────────────────────────────────── */
export const PAYMENT_METHODS = [
  {
    key: 'zelle',
    label: 'Zelle',
    placeholder: 'Phone Number Or Email',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><path d="M5 5h14L5 19h14"/></svg>,
    color: '#6B35C4',
  },
  {
    key: 'cashapp',
    label: 'Cash App',
    placeholder: '$Cashtag (E.g. $YourName)',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    color: '#00D632',
  },
  {
    key: 'venmo',
    label: 'Venmo',
    placeholder: '@Username (E.g. @YourName)',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M13 3l-6 13h5l4.5-9.5A3.5 3.5 0 0 0 13 3z"/></svg>,
    color: '#3D95CE',
  },
  {
    key: 'paypal',
    label: 'PayPal',
    placeholder: 'Email Or @Username',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M7 4h7a5 5 0 0 1 0 10H9v6H5V4zm4 6v-2h-2v2h2z"/></svg>,
    color: '#003087',
  },
  {
    key: 'apple_cash',
    label: 'Apple Cash',
    placeholder: 'Phone Number Or Apple ID Email',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 2C11 2 10 3 10 4s1 2 2 2 2-1 2-2-1-2-2-2zm-1 5a5.5 5.5 0 0 0-4 4.5c-.5 3 .5 6.5 2.5 9.5 1 1.5 2.5 2.5 4 2.5.5 0 1-.5 1.5-.5s1 .5 1.5.5c1.5 0 3-1 4-2.5 2-3 3-6.5 2.5-9.5A5.5 5.5 0 0 0 19 7c-1.5 0-2.5.5-3.5 1C14.5 7.5 13.5 7 12 7c-1 0-2 0-3 .5z"/></svg>,
    color: '#E0E0E0',
  },
  {
    key: 'google_wallet',
    label: 'Google Wallet',
    placeholder: 'Gmail Address',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><rect x="3" y="4" width="18" height="16" rx="2" ry="2"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M16 14h.01"/></svg>,
    color: '#4285F4',
  },
  {
    key: 'wise',
    label: 'Wise',
    placeholder: 'Email Or Wise Username',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M2 12l5-9h6l-5 9h-4zm15-9l-5 9h-4l5-9h4z"/></svg>,
    color: '#9FE870',
  },
  {
    key: 'chime',
    label: 'Chime',
    placeholder: 'Chime Username Or Link',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="12" cy="12" r="10"/><path d="M15 9a4 4 0 0 0-6 0v6a4 4 0 0 0 6 0"/></svg>,
    color: '#3ABA78',
  },
] as const;

export type PaymentKey = (typeof PAYMENT_METHODS)[number]['key'];

/* ─────────────────────────────────────────────────────────
   PaymentMethodsPanel — Settings tab UI
   ───────────────────────────────────────────────────────── */
interface PaymentMethodsPanelProps {
  agentId: string;
  /** Current payment_handles JSON from agent_profiles row */
  initialHandles: Record<string, string> | null;
  onSaveSuccess?: (newHandles: Record<string, string>) => void;
}

export default function PaymentMethodsPanel({
  agentId,
  initialHandles,
  onSaveSuccess,
}: PaymentMethodsPanelProps) {
  // Build initial state from existing handles — a key present and non-empty = enabled
  const buildInitial = () => {
    const state: Record<PaymentKey, { enabled: boolean; handle: string }> = {} as any;
    for (const m of PAYMENT_METHODS) {
      const existing = initialHandles?.[m.key] ?? '';
      state[m.key] = {
        enabled: existing.trim().length > 0,
        handle: existing,
      };
    }
    return state;
  };

  const [methods, setMethods] = useState(buildInitial);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleMethod = (key: PaymentKey) => {
    setMethods(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        enabled: !prev[key].enabled,
        // Clear handle when disabling so it doesn't accidentally save empty-enabled
        handle: prev[key].enabled ? '' : prev[key].handle,
      },
    }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const setHandle = (key: PaymentKey, value: string) => {
    setMethods(prev => ({ ...prev, [key]: { ...prev[key], handle: value } }));
    if (value.trim()) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSave = async () => {
    // Validate: enabled methods must have a handle
    const newErrors: Record<string, string> = {};
    for (const m of PAYMENT_METHODS) {
      if (methods[m.key].enabled && !methods[m.key].handle.trim()) {
        newErrors[m.key] = `Enter Your ${m.label} Contact Info To Enable This Method`;
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      // Build payment_handles object — only include enabled methods with non-empty handles
      const handles: Record<string, string> = {};
      for (const m of PAYMENT_METHODS) {
        // Always write all keys. Disabled = empty string.
        handles[m.key] = methods[m.key].enabled ? methods[m.key].handle.trim() : '';
      }

      const supabase = createClient();
      const { error } = await supabase
        .from('agent_profiles')
        .update({ payment_handles: handles })
        .eq('id', agentId);

      if (error) {
        toast.error(`Save Failed: ${error.message}`);
      } else {
        toast.success('Payment Methods Updated');
        if (onSaveSuccess) {
          onSaveSuccess(handles);
        }
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Failed To Save Payment Methods');
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = PAYMENT_METHODS.filter(m => methods[m.key].enabled).length;

  return (
    <div className="card-metal" style={{
      padding: 'var(--space-6)', marginTop: 'var(--space-6)',
      border: '2px solid rgba(192,184,168,0.4)',
      boxShadow: '0 12px 40px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.1)',
      borderRadius: '12px',
      background: 'linear-gradient(180deg, var(--surface-1) 0%, var(--surface-2) 100%)'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-2)', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div>
          <h4 style={{ color: 'var(--teal)', marginBottom: 'var(--space-1)' }}>
            Preferred Payment Methods
          </h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', margin: 0 }}>
            Turn On Each Method You Accept And Enter Your Contact Info. Only Enabled Methods
            Will Be Shown To Your Researchers At Checkout.
          </p>
        </div>
        {enabledCount > 0 && (
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'var(--teal)',
            background: 'rgba(192,184,168,0.1)',
            border: '1px solid rgba(192,184,168,0.25)',
            borderRadius: 'var(--radius-full)',
            padding: '3px 10px',
            whiteSpace: 'nowrap',
          }}>
            {enabledCount} Active
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
        {PAYMENT_METHODS
          .map(m => ({ ...m, state: methods[m.key] }))
          .sort((a, b) => {
            if (a.state.enabled === b.state.enabled) return 0;
            return a.state.enabled ? -1 : 1;
          })
          .map((method) => {
          const state = method.state;
          const hasError = !!errors[method.key];

          return (
            <div
              key={method.key}
              style={{
                borderRadius: 'var(--radius-lg)',
                border: state.enabled
                  ? `1px solid rgba(192,184,168,0.35)`
                  : '1px solid rgba(255,255,255,0.06)',
                background: state.enabled
                  ? 'rgba(192,184,168,0.05)'
                  : 'rgba(255,255,255,0.02)',
                overflow: 'hidden',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Header row — toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-4)',
                cursor: 'pointer',
                gap: 'var(--space-3)',
              }}
                onClick={() => toggleMethod(method.key)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  {/* Method icon circle */}
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: state.enabled
                      ? `${method.color}22`
                      : 'rgba(255,255,255,0.04)',
                    border: state.enabled
                      ? `1.5px solid ${method.color}55`
                      : '1.5px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.1rem',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                  }}>
                    {method.icon}
                  </div>
                  <div>
                    <span style={{
                      fontWeight: 600,
                      fontSize: '0.92rem',
                      color: state.enabled ? 'var(--white)' : 'var(--grey-400)',
                      transition: 'color 0.2s',
                    }}>
                      {method.label}
                    </span>
                    {state.enabled && state.handle.trim() && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--teal)', marginTop: 1 }}>
                        {state.handle}
                      </div>
                    )}
                    {state.enabled && !state.handle.trim() && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--orange)', marginTop: 1 }}>
                        Contact Info Required
                      </div>
                    )}
                  </div>
                </div>

                {/* Toggle switch */}
                <div
                  style={{
                    width: 46,
                    height: 26,
                    borderRadius: 13,
                    background: state.enabled
                      ? 'linear-gradient(135deg, var(--teal-dark), var(--teal))'
                      : 'rgba(255,255,255,0.1)',
                    position: 'relative',
                    transition: 'background 0.25s ease',
                    flexShrink: 0,
                    border: state.enabled ? 'none' : '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 3,
                    left: state.enabled ? 'calc(100% - 23px)' : 3,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: state.enabled ? '#fff' : 'rgba(255,255,255,0.5)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
                  }} />
                </div>
              </div>

              {/* Expandable handle input — visible only when enabled */}
              {state.enabled && (
                <div style={{
                  padding: '0 var(--space-4) var(--space-4)',
                  animation: 'fadeIn 0.15s ease',
                }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={method.placeholder}
                    value={state.handle}
                    onChange={e => setHandle(method.key, e.target.value)}
                    onClick={e => e.stopPropagation()}
                    style={{
                      borderColor: hasError
                        ? 'var(--red)'
                        : 'rgba(192,184,168,0.25)',
                    }}
                    autoComplete="off"
                    aria-label={`${method.label} Contact Info`}
                  />
                  {hasError && (
                    <p style={{ color: 'var(--red)', fontSize: '0.78rem', marginTop: 4, marginBottom: 0 }}>
                      {errors[method.key]}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save button */}
      <div style={{ marginTop: 'var(--space-5)', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            minWidth: 160,
            background: 'linear-gradient(180deg, rgba(0,196,188,1) 0%, rgba(0,140,135,1) 100%)',
            border: '1px solid #00C4BC',
            boxShadow: '0 4px 12px rgba(0,196,188,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
            color: '#fff',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
            fontWeight: 600,
            borderRadius: '8px',
            padding: '10px 24px',
            transition: 'all 0.2s ease',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save Payment Methods'}
        </button>
      </div>
    </div>
  );
}
