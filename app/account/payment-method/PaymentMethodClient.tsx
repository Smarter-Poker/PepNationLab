'use client';

/**
 * PaymentMethodClient — Round 25
 * --------------------------------------------------------------
 * Full CRUD over the user's payment methods.
 *
 *   - Add or edit the handle / contact for any supported method
 *     (Venmo @, Zelle email or phone, Cash App $cashtag, Apple Pay
 *      contact, PayPal email, etc.)
 *   - Pick which one is the default at checkout
 *   - Remove a saved handle without removing the method as an option
 *
 * Server state lives in two columns on `profiles`:
 *   default_payment_method  TEXT      slug of the default method
 *   payment_handles         JSONB     { [methodSlug]: handleString }
 *
 * Both columns exist in the live schema (initial_schema +
 * 20260604000005_update_payment_methods.sql).
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Edit2, Plus, Trash2, Check, Star } from 'lucide-react';

type MethodId =
  | 'zelle'
  | 'venmo'
  | 'cashapp'
  | 'apple_cash'
  | 'paypal'
  | 'google_wallet'
  | 'wise'
  | 'chime';

interface MethodSpec {
  id: MethodId;
  label: string;
  description: string;
  handleLabel: string;
  placeholder: string;
}

const METHODS: MethodSpec[] = [
  { id: 'zelle', label: 'Zelle', description: 'Bank-To-Bank Transfer. Common For Larger Orders.', handleLabel: 'Email Or Phone Linked To Your Zelle', placeholder: 'you@email.com or +1 555 555 0123' },
  { id: 'venmo', label: 'Venmo', description: 'Fast Mobile Settlement. Most Popular.', handleLabel: 'Venmo Username', placeholder: '@yourhandle' },
  { id: 'cashapp', label: 'Cash App', description: 'Mobile Wallet Settlement.', handleLabel: 'Cash App Cashtag', placeholder: '$yourtag' },
  { id: 'apple_cash', label: 'Apple Cash', description: 'Person-To-Person Payments Through iMessage.', handleLabel: 'Apple Cash Contact (Phone Or Email)', placeholder: '+1 555 555 0123' },
  { id: 'paypal', label: 'PayPal', description: 'Goods-Or-Services Send To Your Agent.', handleLabel: 'PayPal Email', placeholder: 'you@email.com' },
  { id: 'google_wallet', label: 'Google Wallet', description: 'Google Pay Transfer Via Email Or Phone.', handleLabel: 'Google Wallet Email Or Phone', placeholder: 'you@gmail.com' },
  { id: 'wise', label: 'Wise', description: 'International Settlement. Bank Or Email Linked.', handleLabel: 'Wise Account Email', placeholder: 'you@email.com' },
  { id: 'chime', label: 'Chime', description: 'Chime Pay Anyone Transfer.', handleLabel: 'Chime Sign In (Email Or Phone)', placeholder: 'you@email.com' },
];

const baseStyle = { height: 28, width: 'auto', objectFit: 'contain' as const };
const scaleStyle = (scale: number) => ({ ...baseStyle, transform: `scale(${scale})` });

const PAYMENT_ICONS: Record<MethodId, React.ReactNode> = {
  zelle: <img src="/payment-logos/zelle.svg" alt="Zelle" style={baseStyle} />,
  venmo: <img src="/payment-logos/venmo.svg" alt="Venmo" style={scaleStyle(1.4)} />,
  cashapp: <img src="/payment-logos/cashapp.svg" alt="Cash App" style={baseStyle} />,
  apple_cash: <img src="/payment-logos/apple_cash.svg" alt="Apple Cash" style={scaleStyle(1.4)} />,
  paypal: <img src="/payment-logos/paypal.svg" alt="PayPal" style={baseStyle} />,
  google_wallet: <img src="/payment-logos/google_wallet.svg" alt="Google Wallet" style={scaleStyle(1.4)} />,
  wise: <img src="/payment-logos/wise.svg" alt="Wise" style={baseStyle} />,
  chime: <img src="/payment-logos/chime.png" alt="Chime" style={baseStyle} />,
};

interface Props {
  initialDefault: MethodId | string | null;
  initialHandles: Record<string, string>;
}

export default function PaymentMethodClient({ initialDefault, initialHandles }: Props) {
  const [defaultMethod, setDefaultMethod] = useState<MethodId | null>(
    (initialDefault as MethodId | null) ?? null,
  );
  const [handles, setHandles] = useState<Record<string, string>>(initialHandles ?? {});
  const [editing, setEditing] = useState<MethodId | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  function startEdit(id: MethodId) { setEditing(id); setDraft(handles[id] ?? ''); }
  function cancelEdit() { setEditing(null); setDraft(''); }

  async function persist(next: { default_payment_method?: MethodId | null; payment_handles?: Record<string, string> }) {
    setBusy(true);
    try {
      const res = await fetch('/api/account/payment-method', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Save Failed');
      }
    } finally { setBusy(false); }
  }

  async function saveHandle() {
    if (!editing) return;
    const trimmed = draft.trim();
    const nextHandles = { ...handles };
    if (trimmed.length === 0) delete nextHandles[editing];
    else nextHandles[editing] = trimmed;
    try {
      await persist({ payment_handles: nextHandles });
      setHandles(nextHandles);
      setEditing(null);
      setDraft('');
      toast.success(trimmed.length === 0 ? 'Handle Removed' : 'Handle Saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save Failed');
    }
  }

  async function removeHandle(id: MethodId) {
    if (!confirm('Remove The Saved Handle For This Method?')) return;
    const nextHandles = { ...handles };
    delete nextHandles[id];
    try {
      await persist({ payment_handles: nextHandles });
      setHandles(nextHandles);
      toast.success('Handle Removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Remove Failed');
    }
  }

  async function makeDefault(id: MethodId) {
    try {
      await persist({ default_payment_method: id });
      setDefaultMethod(id);
      toast.success('Default Payment Method Updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save Failed');
    }
  }

  async function clearDefault() {
    try {
      await persist({ default_payment_method: null });
      setDefaultMethod(null);
      toast.success('Default Payment Method Cleared');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save Failed');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {METHODS.map((opt, index) => {
        const handle = handles[opt.id];
        const isDefault = defaultMethod === opt.id;
        const isEditing = editing === opt.id;
        return (
          <div
            key={opt.id}
            className="card-glass hover-lift stagger-fade-in"
            style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: isDefault ? '2px solid var(--teal)' : '1px solid rgba(255,255,255,0.08)',
              background: isDefault ? 'rgba(0,196,188,0.06)' : 'var(--surface-2)',
              animationDelay: `${0.1 + index * 0.04}s`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, display: 'flex', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 32 }}>
                  {PAYMENT_ICONS[opt.id]}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ color: 'var(--white)', fontWeight: 700, fontSize: '1rem' }}>{opt.label}</span>
                    {isDefault && (
                      <span style={{ background: 'var(--teal)', color: 'var(--black)', fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>
                        Default
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'var(--silver)', fontSize: '0.85rem', marginTop: 4 }}>{opt.description}</div>
                  {handle && !isEditing && (
                    <div style={{ color: 'var(--white)', fontSize: '0.92rem', marginTop: 8, wordBreak: 'break-all', textTransform: 'none' }}>
                      Saved: <span style={{ color: 'var(--teal)', fontWeight: 700 }}>{handle}</span>
                    </div>
                  )}
                </div>
              </div>
              {!isEditing && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                  {!isDefault && handle && (
                    <button className="btn btn-ghost btn-sm btn-icon" disabled={busy} onClick={() => makeDefault(opt.id)} title="Set Default">
                      <Star size={16} />
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm btn-icon" disabled={busy} onClick={() => startEdit(opt.id)} title={handle ? 'Edit Handle' : 'Add Handle'}>
                    {handle ? <Edit2 size={16} /> : <Plus size={16} />}
                  </button>
                  {handle && (
                    <button className="btn btn-ghost btn-sm btn-icon" disabled={busy} onClick={() => removeHandle(opt.id)} title="Remove Handle" style={{ color: 'var(--red)' }}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {isEditing && (
              <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label style={{ color: 'var(--silver)', fontSize: '0.8rem' }}>{opt.handleLabel}</label>
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={opt.placeholder}
                  autoFocus
                  style={{ width: '100%', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 'var(--radius-sm)', padding: '0.7rem 0.85rem', color: 'var(--white)', fontSize: '0.95rem', textTransform: 'none' }}
                />
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={saveHandle}>{busy ? 'Saving' : 'Save Info'}</button>
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={cancelEdit}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {defaultMethod && (
        <button className="btn btn-ghost" disabled={busy} onClick={clearDefault} style={{ alignSelf: 'flex-start', marginTop: 'var(--space-2)' }}>
          Clear Default Method
        </button>
      )}
    </div>
  );
}
