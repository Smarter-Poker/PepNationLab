'use client';

/**
 * AccountSecurityClient - Round 25
 * --------------------------------------------------------------
 * Audit findings (pre-Round-25):
 *   - Only MFA TOTP enroll/unenroll was wired.
 *   - Custom in-component top nav duplicated the global Navbar mounted
 *     by /account/layout.tsx.
 *   - No password change.
 *   - No active sessions listing or revoke.
 *
 * This rewrite adds:
 *   1. Password change form    -> POST /api/auth/change-password (existing)
 *   2. Active sessions list    -> GET  /api/agent/sessions (existing)
 *      and the "Sign Out Other Sessions" action
 *                              -> DELETE /api/agent/sessions (existing)
 *   3. Removes the duplicate top nav (global Navbar wraps the page).
 *   4. Keeps MFA TOTP enroll/unenroll exactly as before.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

interface MfaFactor {
  id: string;
  factor_type: string;
  status: 'verified' | 'unverified';
  friendly_name?: string | null;
  created_at?: string;
}

interface UserSession {
  id: string;
  device_name: string | null;
  user_agent: string | null;
  ip: string | null;
  last_seen: string;
  created_at: string;
  revoked_at: string | null;
}

interface Props {
  userEmail: string;
  role: string;
  reason: string | null;
}

const TEAL = '#C0B8A8';
const SILVER = '#A8B4C0';
const SURFACE = '#0F1923';
const SURFACE_2 = '#162230';

export default function AccountSecurityClient({
  userEmail,
  role,
  reason,
}: Props) {
  const supabase = useMemo(() => createClient(), []);

  /* -- MFA factors ---------------------------------------------------- */
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  /* -- Password change ----------------------------------------------- */
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  /* -- Active sessions ----------------------------------------------- */
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);

  const requiresMfa = role === 'admin' || role === 'super_agent';

  /* ============ MFA ============ */
  const refreshFactors = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        toast.error(error.message || 'Failed To Load MFA Factors.');
        setFactors([]);
        return;
      }
      const all = (data?.all || []) as unknown as MfaFactor[];
      setFactors(all);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { void refreshFactors(); }, [refreshFactors]);

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
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
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
    } catch {
      toast.error('Failed To Begin Enrollment.');
      setEnrolling(false);
    }
  }, [supabase]);

  const cancelEnroll = useCallback(async () => {
    if (pendingFactorId) {
      try { await supabase.auth.mfa.unenroll({ factorId: pendingFactorId }); } catch { /* noop */ }
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
      toast.success('Authenticator Enrolled. Two-Factor Is Now Active.');
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

  const unenroll = useCallback(async (factorId: string) => {
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
  }, [refreshFactors, supabase]);

  /* ============ Password ============ */
  async function changePassword() {
    if (pw1.length < 8) {
      toast.error('Use At Least 8 Characters.');
      return;
    }
    if (pw1 !== pw2) {
      toast.error('Passwords Do Not Match.');
      return;
    }
    setPwBusy(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: pw1 }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Password Change Failed');
      }
      toast.success('Password Updated.');
      setPw1('');
      setPw2('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Password Change Failed');
    } finally {
      setPwBusy(false);
    }
  }

  /* ============ Sessions ============ */
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch('/api/agent/sessions', { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        setSessions(j.sessions ?? []);
      }
    } catch { /* noop */ } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  async function revokeOthers() {
    if (!confirm('Sign Out All Other Devices? Your Current Session Stays Active.')) return;
    setRevoking(true);
    try {
      const res = await fetch('/api/agent/sessions', { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Failed To Revoke Sessions');
      }
      toast.success('Other Sessions Signed Out.');
      await loadSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setRevoking(false);
    }
  }

  /* ============ Render ============ */
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)', color: 'var(--white)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
        <h1
          className="animated-gradient-text"
          style={{
            fontSize: '1.6rem',
            fontFamily: 'var(--font-brand)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Account Security
        </h1>
        <p style={{ color: SILVER, fontSize: '0.9rem', marginBottom: 'var(--space-5)' }}>
          Manage Your Password, Two-Factor Authentication, And The Devices Signed In To Your Account.
        </p>

        {reason === 'mfa_required' && (
          <div
            style={{
              background: 'rgba(229,62,62,0.08)',
              border: '1px solid rgba(229,62,62,0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem 1.25rem',
              marginBottom: 'var(--space-5)',
            }}
          >
            <strong style={{ color: '#FF7A7A', display: 'block', marginBottom: '0.25rem' }}>
              Two-Factor Authentication Is Required
            </strong>
            <p style={{ color: SILVER, fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
              Your Role Requires An Authenticator App. Scan The QR Code Below With Any TOTP App
              (Google Authenticator, 1Password, Authy) To Continue.
            </p>
          </div>
        )}

        {requiresMfa && verifiedFactors.length === 0 && reason !== 'mfa_required' && (
          <div
            style={{
              background: 'rgba(255,193,7,0.08)',
              border: '1px solid rgba(255,193,7,0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem 1.25rem',
              marginBottom: 'var(--space-5)',
            }}
          >
            <strong style={{ color: '#FFD16A', display: 'block', marginBottom: '0.25rem' }}>
              Two-Factor Required For This Role
            </strong>
            <p style={{ color: SILVER, fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
              Admin And Super Agent Accounts Must Have Two-Factor Authentication
              Enabled. Enroll An Authenticator App Below.
            </p>
          </div>
        )}

        {/* ============ Status Summary ============ */}
        <section className="glass-panel hover-lift" style={cardStyle}>
          <h2 style={h2Style}>What's Enabled</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <StatusRow label="Email" value={userEmail} ok />
            <StatusRow
              label="Password"
              value="Set"
              ok
            />
            <StatusRow
              label="Two-Factor Authentication"
              value={verifiedFactors.length > 0 ? `${verifiedFactors.length} Active` : 'Not Enrolled'}
              ok={verifiedFactors.length > 0}
            />
            <StatusRow
              label="Active Sessions"
              value={sessionsLoading ? 'Loading' : `${sessions.length} Device${sessions.length === 1 ? '' : 's'}`}
              ok={sessions.length <= 3}
            />
          </div>
        </section>

        {/* ============ Password ============ */}
        <section className="glass-panel hover-lift" style={cardStyle}>
          <h2 style={h2Style}>Change Password</h2>
          <p style={{ color: SILVER, fontSize: '0.85rem', marginBottom: 'var(--space-3)' }}>
            Use At Least 8 Characters. Mix Letters, Numbers, And Symbols.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="New Password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              style={inputStyle}
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Confirm New Password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={changePassword}
              disabled={pwBusy || pw1.length === 0}
              style={{
                background: TEAL,
                color: 'var(--black)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '0.7rem 1.25rem',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: pwBusy || pw1.length === 0 ? 'not-allowed' : 'pointer',
                opacity: pwBusy || pw1.length === 0 ? 0.5 : 1,
                alignSelf: 'flex-start',
              }}
            >
              {pwBusy ? 'Saving' : 'Update Password'}
            </button>
          </div>
        </section>

        {/* ============ Two-Factor ============ */}
        <section className="glass-panel hover-lift" style={cardStyle}>
          <h2 style={h2Style}>Two-Factor Authentication</h2>
          {loading ? (
            <p style={{ color: SILVER, fontSize: '0.85rem' }}>Loading</p>
          ) : factors.length === 0 ? (
            <p style={{ color: SILVER, fontSize: '0.85rem', marginBottom: 'var(--space-3)' }}>
              No Authenticators Enrolled Yet.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {factors.map(f => (
                <li key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: SURFACE_2, borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                      {f.friendly_name || 'Authenticator App'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: SILVER }}>
                      {f.factor_type.toUpperCase()} .{' '}
                      <span style={{ color: f.status === 'verified' ? TEAL : '#FFD16A', fontWeight: 600 }}>
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
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.55rem 0.85rem',
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

          {!enrolling ? (
            <button
              type="button"
              onClick={startEnroll}
              style={{
                background: TEAL,
                color: '#050A0F',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '0.7rem 1.25rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Enroll Authenticator App
            </button>
          ) : (
            <div>
              {qrDataUrl ? (
                <Image
                  src={qrDataUrl}
                  alt="MFA QR Code"
                  width={240}
                  height={240}
                  unoptimized
                  style={{
                    width: 240,
                    height: 240,
                    background: '#fff',
                    padding: 12,
                    borderRadius: 'var(--radius-md)',
                    display: 'block',
                  }}
                />
              ) : (
                <p style={{ color: SILVER, fontSize: '0.85rem' }}>Loading QR Code</p>
              )}
              {secret && (
                <p style={{ color: SILVER, fontSize: '0.78rem', marginTop: '0.75rem', wordBreak: 'break-all', textTransform: 'none' }}>
                  Manual Entry: <code style={{ color: TEAL }}>{secret}</code>
                </p>
              )}
              <div style={{ marginTop: '1.25rem', maxWidth: 240 }}>
                <label style={{ display: 'block', color: SILVER, fontSize: '0.8rem', marginBottom: '0.4rem' }}>
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
                  style={{ ...inputStyle, letterSpacing: '0.15em' }}
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
                    borderRadius: 'var(--radius-md)',
                    padding: '0.7rem 1.25rem',
                    fontWeight: 700,
                    cursor: verifying || code.length !== 6 ? 'not-allowed' : 'pointer',
                    opacity: verifying || code.length !== 6 ? 0.5 : 1,
                    fontSize: '0.85rem',
                  }}
                >
                  {verifying ? 'Verifying' : 'Verify And Enable'}
                </button>
                <button
                  type="button"
                  onClick={cancelEnroll}
                  disabled={verifying}
                  style={{
                    background: 'transparent',
                    color: SILVER,
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 'var(--radius-md)',
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

        {/* ============ Active Sessions ============ */}
        <section className="glass-panel hover-lift" style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h2 style={{ ...h2Style, marginBottom: 0 }}>Active Sessions</h2>
            {sessions.length > 1 && (
              <button
                type="button"
                onClick={revokeOthers}
                disabled={revoking}
                style={{
                  background: 'transparent',
                  color: '#FF7A7A',
                  border: '1px solid rgba(255,122,122,0.3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.5rem 0.8rem',
                  fontSize: '0.78rem',
                  cursor: revoking ? 'wait' : 'pointer',
                  opacity: revoking ? 0.6 : 1,
                }}
              >
                {revoking ? 'Working' : 'Sign Out Other Devices'}
              </button>
            )}
          </div>

          {sessionsLoading ? (
            <p style={{ color: SILVER, fontSize: '0.85rem' }}>Loading</p>
          ) : sessions.length === 0 ? (
            <p style={{ color: SILVER, fontSize: '0.85rem' }}>
              No Recorded Sessions Yet. Your Current Sign-In Will Appear Here Once Logged.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessions.map(s => (
                <li
                  key={s.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: SURFACE_2,
                    borderRadius: 'var(--radius-md)',
                    padding: '0.7rem 0.9rem',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--white)' }}>
                      {s.device_name || 'Unknown Device'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: SILVER, marginTop: 2, wordBreak: 'break-all', textTransform: 'none' }}>
                      {s.user_agent ? s.user_agent.slice(0, 80) : 'No User Agent Recorded'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: SILVER, marginTop: 2 }}>
                      Last Seen: {new Date(s.last_seen).toLocaleString()}{s.ip ? ` . IP ${s.ip}` : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ----- styled fragments ----- */
const cardStyle: React.CSSProperties = {
  background: SURFACE,
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-5)',
  marginBottom: 'var(--space-5)',
};

const h2Style: React.CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 700,
  color: 'var(--white)',
  marginBottom: 'var(--space-3)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: SURFACE_2,
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 'var(--radius-md)',
  padding: '0.7rem 0.85rem',
  color: '#FFFFFF',
  fontSize: '0.95rem',
  textTransform: 'none',
};

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
      <span style={{ color: SILVER, fontSize: '0.85rem' }}>{label}</span>
      <span
        style={{
          color: ok ? TEAL : '#FFD16A',
          fontWeight: 700,
          fontSize: '0.85rem',
          wordBreak: 'break-all',
          textTransform: 'none',
        }}
      >
        {value}
      </span>
    </div>
  );
}
