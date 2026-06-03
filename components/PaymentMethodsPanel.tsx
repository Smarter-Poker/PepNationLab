'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

/* ─────────────────────────────────────────────────────────
   All supported payment methods with labels and placeholders
   ───────────────────────────────────────────────────────── */
const baseStyle = { height: 20, width: 60, objectFit: 'contain' as const };
const scaleStyle = (scale: number) => ({ ...baseStyle, transform: `scale(${scale})` });

export const PAYMENT_METHODS = [
  {
    key: 'zelle',
    label: 'Zelle',
    placeholder: 'Phone Number Or Email',
    icon: <img src="/payment-logos/zelle.svg" alt="Zelle" style={baseStyle} />,
    color: '#6B35C4',
  },
  {
    key: 'cashapp',
    label: 'Cash App',
    placeholder: '$Cashtag (E.g. $YourName)',
    icon: <img src="/payment-logos/cashapp.svg" alt="Cash App" style={baseStyle} />,
    color: '#00D632',
  },
  {
    key: 'venmo',
    label: 'Venmo',
    placeholder: '@Username (E.g. @YourName)',
    icon: <img src="/payment-logos/venmo.svg" alt="Venmo" style={scaleStyle(1.4)} />,
    color: '#3D95CE',
  },
  {
    key: 'paypal',
    label: 'PayPal',
    placeholder: 'Email Or @Username',
    icon: <img src="/payment-logos/paypal.svg" alt="PayPal" style={baseStyle} />,
    color: '#003087',
  },
  {
    key: 'apple_cash',
    label: 'Apple Cash',
    placeholder: 'Phone Number Or Apple ID Email',
    icon: <img src="/payment-logos/apple_cash.svg" alt="Apple Cash" style={scaleStyle(1.4)} />,
    color: '#E0E0E0',
  },
  {
    key: 'google_wallet',
    label: 'Google Wallet',
    placeholder: 'Gmail Address',
    icon: <img src="/payment-logos/google_wallet.svg" alt="Google Wallet" style={scaleStyle(1.4)} />,
    color: '#4285F4',
  },
  {
    key: 'wise',
    label: 'Wise',
    placeholder: 'Email Or Wise Username',
    icon: <img src="/payment-logos/wise.svg" alt="Wise" style={baseStyle} />,
    color: '#9FE870',
  },
  {
    key: 'chime',
    label: 'Chime',
    placeholder: 'Chime Username Or Link',
    icon: <img src="/payment-logos/chime.png" alt="Chime" style={baseStyle} />,
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
    <div className="glass-panel" style={{ marginTop: 'var(--space-6)' }}>
      <div className="" style={{ padding: 'var(--space-8)' }}>
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
            background: 'rgba(0,196,188,0.1)',
            border: '1px solid rgba(0,196,188,0.25)',
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
                borderRadius: 'var(--radius-md)',
                border: state.enabled
                  ? `1px solid rgba(0,196,188,0.4)`
                  : '1px solid rgba(255,255,255,0.08)',
                background: state.enabled
                  ? 'rgba(0,196,188,0.06)'
                  : 'var(--surface-3)',
                boxShadow: state.enabled ? 'inset 0 1px 4px rgba(0,0,0,0.4)' : 'none',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                  {/* Method icon container */}
                  <div style={{
                    width: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                    opacity: state.enabled ? 1 : 0.6,
                    filter: state.enabled ? 'none' : 'grayscale(100%)',
                  }}>
                    {method.icon}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <span style={{
                      fontWeight: 600,
                      fontSize: '0.92rem',
                      color: state.enabled ? 'var(--white)' : 'var(--grey-400)',
                      transition: 'color 0.2s',
                      whiteSpace: 'nowrap'
                    }}>
                      {method.label}
                    </span>
                    {state.enabled && state.handle.trim() && (
                      <span style={{ fontSize: '0.92rem', color: 'var(--white)', fontWeight: 400 }}>
                        — {state.handle}
                      </span>
                    )}
                    {state.enabled && !state.handle.trim() && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--orange)' }}>
                        - Contact Info Required
                      </span>
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
                      background: 'var(--surface-2)',
                      border: '1px solid',
                      borderColor: hasError
                        ? 'var(--red)'
                        : 'rgba(0,196,188,0.4)',
                      boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.4)',
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
          className="btn-neon-cyan"
          style={{
            minWidth: 160,
            padding: '10px 24px',
            fontSize: '1rem',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save Payment Methods'}
        </button>
      </div>
      </div>
    </div>
  );
}
