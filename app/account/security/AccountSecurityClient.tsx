'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface MfaFactor {
  id: string;
  factor_type: string;
  status: 'verified' | 'unverified';
  friendly_name?: string | null;
  created_at?: string;
}

interface Props {
  userEmail: string;
  role: string;
  fullName: string | null;
  reason: string | null;
}

const TEAL = '#C0B8A8';
const SILVER = '#A8B4C0';
const SURFACE = '#0F1923';
const SURFACE_2 = '#162230';

export default function AccountSecurityClient({
  userEmail,
  role,
  fullName,
  reason,
}: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [loading, setLoading] = useState(true);

  // Enrollment workflow state
  const [enrolling, setEnrolling] = useState(false);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const requiresMfa = role === 'admin' || role === 'super_agent';

  const refreshFactors = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        toast.error(error.message || 'Failed To Load MFA Factors.');
        setFactors([]);
        return;
      }
      // listFactors returns { totp: [...], all: [...], phone: [...] } shape
      const all = (data?.all || []) as unknown as MfaFactor[];
      setFactors(all);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void refreshFactors();
  }, [refreshFactors]);

  const verifiedFactors = factors.filter(f => f.status === 'verified');

  const startEnroll = useCallback(async () => {
    setEnrolling(true);
    setQrDataUrl(null);
    setSecret(null);
    setCode('');
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Authenticator App (${new Date().toISOString().slice(0, 10)})`,
      });
      if (error || !data) {
        toast.error(error?.message || 'Failed To Begin Enrollment.');
        setEnrolling(false);
        return;
      }
      setPendingFactorId(data.id);
      // Supabase returns either an SVG-ish data URL in `qr_code` or just a
      // raw otpauth URI in `uri`. If we get the URI only, draw it locally
      // using the qrcode package.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totp = (data as any).totp ?? {};
      setSecret(totp.secret ?? null);
      if (totp.qr_code && typeof totp.qr_code === 'string' && totp.qr_code.startsWith('data:')) {
        setQrDataUrl(totp.qr_code);
      } else if (totp.uri && typeof totp.uri === 'string') {
        try {
          const url = await QRCode.toDataURL(totp.uri, { margin: 1, width: 240 });
          setQrDataUrl(url);
        } catch {
          setQrDataUrl(null);
        }
      }
    } catch (err) {
      toast.error('Failed To Begin Enrollment.');
      // eslint-disable-next-line no-console
      console.error('[mfa] enroll failed', err);
      setEnrolling(false);
    }
  }, [supabase]);

  const cancelEnroll = useCallback(async () => {
    if (pendingFactorId) {
      try {
        await supabase.auth.mfa.unenroll({ factorId: pendingFactorId });
      } catch {
        // Silent — the row will be cleaned up by Supabase's TTL anyway.
      }
    }
    setEnrolling(false);
    setPendingFactorId(null);
    setQrDataUrl(null);
    setSecret(null);
    setCode('');
    void refreshFactors();
  }, [pendingFactorId, refreshFactors, supabase]);

  const verifyCode = useCallback(async () => {
    if (!pendingFactorId) return;
    const cleaned = code.replace(/\s+/g, '');
    if (cleaned.length !== 6) {
      toast.error('Enter The 6-Digit Code From Your Authenticator App.');
      return;
    }
    setVerifying(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: pendingFactorId,
        code: cleaned,
      });
      if (error) {
        toast.error(error.message || 'Verification Failed. Try Again.');
        return;
      }
      toast.success('Authenticator Enrolled. MFA Is Now Active.');
      setEnrolling(false);
      setPendingFactorId(null);
      setQrDataUrl(null);
      setSecret(null);
      setCode('');
      await refreshFactors();
    } finally {
      setVerifying(false);
    }
  }, [code, pendingFactorId, refreshFactors, supabase]);

  const unenroll = useCallback(
    async (factorId: string) => {
      const confirmed = window.confirm(
        'Remove This Authenticator? You Will Need To Enroll A New One To Sign In.'
      );
      if (!confirmed) return;
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) {
        toast.error(error.message || 'Failed To Remove Factor.');
        return;
      }
      toast.success('Authenticator Removed.');
      await refreshFactors();
    },
    [refreshFactors, supabase]
  );

  return (
    <div style={{ minHeight: '100dvh', background: '#050A0F', color: '#FFFFFF' }}>
      {/* Top bar */}
      <nav
        style={{
          height: 64,
          background: SURFACE,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.5rem',
        }}
      >
        <Link
          href={role === 'admin' ? '/admin' : '/dashboard'}
          style={{
            fontFamily: 'var(--font-brand, Inter)',
            fontSize: '0.9rem',
            fontWeight: 800,
            letterSpacing: '0.12em',
            color: TEAL,
            textDecoration: 'none',
          }}
        >
          PEP NATION LAB
        </Link>
        <span style={{ fontSize: '0.85rem', color: SILVER }}>
          {fullName ?? userEmail}
        </span>
      </nav>

      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '2rem 1.5rem',
        }}
      >
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>
          Account Security
        </h1>
        <p style={{ color: SILVER, fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Manage Two-Factor Authentication For This Account.
        </p>

        {reason === 'mfa_required' && (
          <div
            style={{
              background: 'rgba(229,62,62,0.08)',
              border: '1px solid rgba(229,62,62,0.3)',
              borderRadius: '0.5rem',
              padding: '1rem 1.25rem',
              marginBottom: '1.5rem',
            }}
          >
            <strong style={{ color: '#FF7A7A', display: 'block', marginBottom: '0.25rem' }}>
              Two-Factor Authentication Is Required
            </strong>
            <p style={{ color: SILVER, fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
              Your Role Requires An Authenticator App Before You Can Access The
              Rest Of The Platform. Scan The QR Code Below With Any TOTP App
              (Google Authenticator, 1Password, Authy) To Continue.
            </p>
          </div>
        )}

        {requiresMfa && verifiedFactors.length === 0 && reason !== 'mfa_required' && (
          <div
            style={{
              background: 'rgba(255,193,7,0.08)',
              border: '1px solid rgba(255,193,7,0.3)',
              borderRadius: '0.5rem',
              padding: '1rem 1.25rem',
              marginBottom: '1.5rem',
            }}
          >
            <strong style={{ color: '#FFD16A', display: 'block', marginBottom: '0.25rem' }}>
              MFA Required For This Role
            </strong>
            <p style={{ color: SILVER, fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
              Admin And Super Agent Accounts Must Have Two-Factor Authentication
              Enabled. Enroll An Authenticator App Below.
            </p>
          </div>
        )}

        {/* Factor list */}
        <section
          className="card-metal hover-lift stagger-fade-in"
          style={{
            background: SURFACE,
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            animationDelay: '0.1s',
          }}
        >
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
            Enrolled Authenticators
          </h2>

          {loading ? (
            <p style={{ color: SILVER, fontSize: '0.85rem' }}>Loading...</p>
          ) : factors.length === 0 ? (
            <p style={{ color: SILVER, fontSize: '0.85rem' }}>
              No Authenticators Enrolled Yet.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {factors.map(f => (
                <li
                  key={f.id}
                  className="table-row-hover"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: SURFACE_2,
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '0.5rem',
                    padding: '0.75rem 1rem',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                      {f.friendly_name || 'Authenticator App'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: SILVER }}>
                      {f.factor_type.toUpperCase()} ·{' '}
                      <span
                        style={{
                          color: f.status === 'verified' ? TEAL : '#FFD16A',
                          fontWeight: 600,
                        }}
                      >
                        {f.status === 'verified' ? 'Verified' : 'Pending Verification'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => unenroll(f.id)}
                    style={{
                      background: 'transparent',
                      color: '#FF7A7A',
                      border: '1px solid rgba(255,122,122,0.3)',
                      borderRadius: '0.4rem',
                      padding: '0.75rem 0.85rem',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Enrollment workflow */}
        <section
          className="card-metal hover-lift stagger-fade-in"
          style={{
            background: SURFACE,
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            animationDelay: '0.2s',
          }}
        >
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Enroll A New Authenticator
          </h2>
          <p style={{ color: SILVER, fontSize: '0.85rem', marginBottom: '1rem' }}>
            Scan The QR Code With Your Authenticator App, Then Enter The
            Generated 6-Digit Code To Complete Setup.
          </p>

          {!enrolling ? (
            <button
              type="button"
              onClick={startEnroll}
              style={{
                background: TEAL,
                color: '#050A0F',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.75rem 1.5rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Enroll Authenticator App
            </button>
          ) : (
            <div>
              {qrDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrDataUrl}
                  alt="MFA QR Code"
                  style={{
                    width: 240,
                    height: 240,
                    background: '#fff',
                    padding: 12,
                    borderRadius: '0.5rem',
                    display: 'block',
                  }}
                />
              ) : (
                <p style={{ color: SILVER, fontSize: '0.85rem' }}>
                  Loading QR Code...
                </p>
              )}

              {secret && (
                <p style={{ color: SILVER, fontSize: '0.78rem', marginTop: '0.75rem', wordBreak: 'break-all', textTransform: 'none' }}>
                  Manual Entry: <code style={{ color: TEAL }}>{secret}</code>
                </p>
              )}

              <div style={{ marginTop: '1.25rem', maxWidth: 240 }}>
                <label
                  style={{
                    display: 'block',
                    color: SILVER,
                    fontSize: '0.8rem',
                    marginBottom: '0.4rem',
                  }}
                >
                  Verification Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="123456"
                  style={{
                    width: '100%',
                    background: SURFACE_2,
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '0.4rem',
                    padding: '0.75rem 0.75rem',
                    color: '#FFFFFF',
                    fontSize: '1rem',
                    letterSpacing: '0.15em',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={verifyCode}
                  disabled={verifying || code.length !== 6}
                  style={{
                    background: TEAL,
                    color: '#050A0F',
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '0.75rem 1.25rem',
                    fontWeight: 600,
                    cursor: verifying || code.length !== 6 ? 'not-allowed' : 'pointer',
                    opacity: verifying || code.length !== 6 ? 0.5 : 1,
                    fontSize: '0.85rem',
                  }}
                >
                  {verifying ? 'Verifying...' : 'Verify And Enable'}
                </button>
                <button
                  type="button"
                  onClick={cancelEnroll}
                  disabled={verifying}
                  style={{
                    background: 'transparent',
                    color: SILVER,
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '0.5rem',
                    padding: '0.6rem 1.25rem',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Footer link to notification preferences */}
        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: SILVER }}>
          <Link href="/account/notifications" style={{ color: TEAL, textDecoration: 'none' }}>
            Notification Preferences
          </Link>
        </p>
      </div>
    </div>
  );
}
