'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Prefs {
  sms_enabled: boolean;
  sms_phone: string | null;
  sms_phone_verified: boolean;
  events_order_approved: boolean;
  events_order_shipped: boolean;
  events_order_delivered: boolean;
  events_payment_reminder: boolean;
}

interface Props {
  initialPrefs: Prefs;
  userEmail: string;
}

const TEAL = '#00C4BC';
const SILVER = '#A8B4C0';
const SURFACE_2 = '#162230';
const PHONE_RE = /^\+\d{10,15}$/;

export default function NotificationsClient({ initialPrefs, userEmail }: Props) {
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [phoneInput, setPhoneInput] = useState<string>(initialPrefs.sms_phone ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const phoneIsValid = phoneInput === '' || PHONE_RE.test(phoneInput.trim());

  function update<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  async function save() {
    if (!phoneIsValid) {
      setMessage({ kind: 'err', text: 'Phone Number Must Be In E.164 Format (Example: +12025550100).' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/account/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sms_enabled: prefs.sms_enabled,
          sms_phone: phoneInput.trim() === '' ? null : phoneInput.trim(),
          events_order_approved: prefs.events_order_approved,
          events_order_shipped: prefs.events_order_shipped,
          events_order_delivered: prefs.events_order_delivered,
          events_payment_reminder: prefs.events_payment_reminder,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ kind: 'err', text: data?.error || 'Save Failed.' });
      } else {
        setMessage({ kind: 'ok', text: 'Preferences Saved.' });
        if (data?.preferences) {
          setPrefs({
            sms_enabled: !!data.preferences.sms_enabled,
            sms_phone: data.preferences.sms_phone ?? null,
            sms_phone_verified: !!data.preferences.sms_phone_verified,
            events_order_approved: data.preferences.events_order_approved !== false,
            events_order_shipped: data.preferences.events_order_shipped !== false,
            events_order_delivered: data.preferences.events_order_delivered !== false,
            events_payment_reminder: data.preferences.events_payment_reminder !== false,
          });
          setPhoneInput(data.preferences.sms_phone ?? '');
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save Failed.';
      setMessage({ kind: 'err', text: msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <header style={{ marginBottom: '1.5rem' }}>
          <Link
            href="/dashboard"
            style={{ fontSize: '0.78rem', color: TEAL, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back To Dashboard
          </Link>
          <h1 style={{ marginTop: '0.75rem', fontSize: '1.5rem', color: '#FFFFFF' }}>
            Notification Preferences
          </h1>
          <p style={{ marginTop: '0.5rem', color: SILVER, fontSize: '0.85rem' }}>
            Signed In As {userEmail}. Control How Pep Nation Lab Reaches You About Your Orders.
          </p>
        </header>

        <section className="card" style={{ padding: '1.5rem', background: SURFACE_2, borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 style={{ fontSize: '1.05rem', color: '#FFFFFF', marginBottom: '0.5rem' }}>
            SMS Text Messages
          </h2>
          <p style={{ fontSize: '0.8rem', color: SILVER, marginBottom: '1.25rem' }}>
            Standard Carrier Rates May Apply. Reply STOP To Unsubscribe.
          </p>

          {/* SMS Enabled Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', marginBottom: '1rem' }}>
            <input
              type="checkbox"
              checked={prefs.sms_enabled}
              onChange={(e) => update('sms_enabled', e.target.checked)}
              style={{ width: 18, height: 18, accentColor: TEAL, cursor: 'pointer' }}
            />
            <span style={{ color: '#FFFFFF', fontSize: '0.92rem', fontWeight: 600 }}>
              Enable SMS Notifications
            </span>
          </label>

          {/* Phone */}
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="sms-phone" style={{ display: 'block', fontSize: '0.78rem', color: SILVER, marginBottom: 6 }}>
              Mobile Number (E.164 Format)
            </label>
            <input
              id="sms-phone"
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="+12025550100"
              autoComplete="tel"
              style={{
                width: '100%',
                background: 'var(--black-2)',
                border: `1px solid ${phoneIsValid ? 'rgba(255,255,255,0.12)' : '#E53E3E'}`,
                borderRadius: '0.4rem',
                padding: '0.6rem 0.75rem',
                color: '#FFFFFF',
                fontSize: '0.95rem',
                letterSpacing: '0.05em',
              }}
            />
            <div style={{ marginTop: 6, fontSize: '0.72rem', color: phoneIsValid ? SILVER : '#E53E3E' }}>
              Format: Country Code Plus Number, No Spaces. Example: +12025550100.
              {prefs.sms_phone_verified && phoneIsValid && phoneInput.trim() === (prefs.sms_phone ?? '') && (
                <span style={{ marginLeft: 8, color: TEAL, fontWeight: 600 }}>Verified On File</span>
              )}
            </div>
          </div>

          {/* Event Toggles */}
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.25rem' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#FFFFFF', marginBottom: '0.75rem' }}>
              Send Me A Text When:
            </h3>
            {([
              { key: 'events_order_approved', label: 'My Order Is Approved' },
              { key: 'events_order_shipped', label: 'My Order Ships' },
              { key: 'events_order_delivered', label: 'My Order Is Delivered' },
              { key: 'events_payment_reminder', label: 'A Payment Reminder Is Sent' },
            ] as const).map((row) => (
              <label
                key={row.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  cursor: 'pointer', padding: '0.5rem 0',
                  opacity: prefs.sms_enabled ? 1 : 0.5,
                }}
              >
                <input
                  type="checkbox"
                  disabled={!prefs.sms_enabled}
                  checked={prefs[row.key]}
                  onChange={(e) => update(row.key, e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: TEAL, cursor: prefs.sms_enabled ? 'pointer' : 'not-allowed' }}
                />
                <span style={{ color: '#FFFFFF', fontSize: '0.88rem' }}>{row.label}</span>
              </label>
            ))}
          </div>

          {/* Save */}
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={save}
              disabled={saving || !phoneIsValid}
              style={{
                background: TEAL,
                color: '#050A0F',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.65rem 1.5rem',
                fontWeight: 700,
                cursor: saving || !phoneIsValid ? 'not-allowed' : 'pointer',
                opacity: saving || !phoneIsValid ? 0.5 : 1,
                fontSize: '0.88rem',
              }}
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
            {message && (
              <span style={{ fontSize: '0.82rem', color: message.kind === 'ok' ? TEAL : '#E53E3E' }}>
                {message.text}
              </span>
            )}
          </div>
        </section>

        <p style={{ marginTop: '1.5rem', fontSize: '0.72rem', color: 'var(--grey-400)', textAlign: 'center' }}>
          Looking For Account Security? <Link href="/account/security" style={{ color: TEAL }}>Manage Two-Factor Authentication</Link>
        </p>
      </div>
    </div>
  );
}
