'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import SessionsTable from './SessionsTable';
import MFAEnrollFlow from './MFAEnrollFlow';

interface Props {
  userId: string;
  userEmail: string;
}

interface MfaFactor {
  id: string;
  factor_type: string;
  status: 'verified' | 'unverified';
  friendly_name?: string | null;
  created_at?: string;
}

export default function SecurityTab({ userEmail }: Props) {
  const supabase = useMemo(() => createClient(), []);

  // Change-password state
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // MFA state
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [unenrollCode, setUnenrollCode] = useState('');
  const [unenrollingId, setUnenrollingId] = useState<string | null>(null);

  const refreshFactors = useCallback(async () => {
    setLoadingFactors(true);
    try {
      const res = await fetch('/api/agent/mfa');
      const json = await res.json();
      if (res.ok && Array.isArray(json.factors)) {
        setFactors(json.factors as MfaFactor[]);
      } else {
        setFactors([]);
      }
    } finally {
      setLoadingFactors(false);
    }
  }, []);

  useEffect(() => {
    void refreshFactors();
  }, [refreshFactors]);

  const verifiedFactors = factors.filter((f) => f.status === 'verified');
  const hasMfa = verifiedFactors.length > 0;

  const handleChangePassword = useCallback(async () => {
    if (pwNew.length < 12) {
      toast.error('Password Must Be At Least 12 Characters.');
      return;
    }
    if (pwNew !== pwConfirm) {
      toast.error('Passwords Do Not Match.');
      return;
    }
    setPwSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwNew });
      if (error) {
        toast.error(error.message || 'Failed To Change Password.');
        return;
      }
      toast.success('Password Updated.');
      setPwNew('');
      setPwConfirm('');
    } finally {
      setPwSaving(false);
    }
  }, [pwNew, pwConfirm, supabase]);

  const handleUnenroll = useCallback(
    async (factorId: string) => {
      if (unenrollCode.length < 4) {
        toast.error('Enter Your Current 6-Digit Code First.');
        return;
      }
      setUnenrollingId(factorId);
      try {
        const res = await fetch('/api/agent/mfa', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ factor_id: factorId, code: unenrollCode }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed To Remove MFA.');
        toast.success('Two-Factor Authentication Removed.');
        setUnenrollCode('');
        await refreshFactors();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed To Remove MFA.';
        toast.error(msg);
      } finally {
        setUnenrollingId(null);
      }
    },
    [unenrollCode, refreshFactors],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Change Password */}
      <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
        <h3 style={{ marginTop: 0, marginBottom: 'var(--space-2)', color: 'var(--teal)' }}>
          Change Password
        </h3>
        <p style={{ color: 'var(--silver)', fontSize: '0.82rem', margin: '0 0 var(--space-4)', lineHeight: 1.6 }}>
          You Are Signed In As <code style={{ color: 'var(--teal)' }}>{userEmail || 'this account'}</code>. New Passwords Must Be At Least 12 Characters.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--space-4)',
            alignItems: 'end',
          }}
        >
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="pw-new">New Password</label>
            <input
              id="pw-new"
              type="password"
              className="form-input"
              value={pwNew}
              onChange={(e) => setPwNew(e.target.value)}
              autoComplete="new-password"
              minLength={12}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="pw-confirm">Confirm New Password</label>
            <input
              id="pw-confirm"
              type="password"
              className="form-input"
              value={pwConfirm}
              onChange={(e) => setPwConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={12}
            />
          </div>
        </div>
        <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pwSaving || pwNew.length === 0}
            onClick={handleChangePassword}
          >
            {pwSaving ? 'Saving...' : 'Update Password'}
          </button>
        </div>
      </div>

      {/* MFA */}
      <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
            flexWrap: 'wrap',
          }}
        >
          <h3 style={{ margin: 0, color: 'var(--teal)' }}>Two-Factor Authentication</h3>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 999,
              background: hasMfa ? 'rgba(192,184,168,0.12)' : 'rgba(229,62,62,0.12)',
              color: hasMfa ? 'var(--teal)' : 'var(--red, #E53E3E)',
              border: '1px solid',
              borderColor: hasMfa ? 'rgba(192,184,168,0.3)' : 'rgba(229,62,62,0.3)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {hasMfa ? 'Enabled' : 'Not Enabled'}
          </span>
        </div>

        {loadingFactors ? (
          <p style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>Loading Factors...</p>
        ) : !hasMfa ? (
          <MFAEnrollFlow onEnrolled={refreshFactors} />
        ) : (
          <div>
            <p style={{ color: 'var(--silver)', fontSize: '0.85rem', margin: '0 0 var(--space-4)' }}>
              The Following Factor Is Active On This Account.
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {verifiedFactors.map((f) => (
                <li
                  key={f.id}
                  style={{
                    padding: 'var(--space-3)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ color: 'var(--white)', fontWeight: 600, fontSize: '0.9rem' }}>
                    {f.friendly_name || f.factor_type.toUpperCase()}
                  </div>
                  <div style={{ color: 'var(--silver)', fontSize: '0.75rem', marginTop: 2 }}>
                    Added {f.created_at ? new Date(f.created_at).toLocaleDateString() : '—'}
                  </div>
                  <div
                    style={{
                      marginTop: 'var(--space-3)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 'var(--space-2)',
                      alignItems: 'flex-end',
                    }}
                  >
                    <div className="form-group" style={{ flex: '1 1 180px', margin: 0 }}>
                      <label className="form-label" htmlFor={`unenroll-code-${f.id}`}>
                        Code From App
                      </label>
                      <input
                        id={`unenroll-code-${f.id}`}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        className="form-input"
                        value={unenrollCode}
                        onChange={(e) => setUnenrollCode(e.target.value.replace(/\D/g, ''))}
                        maxLength={10}
                        placeholder="123456"
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={unenrollingId === f.id}
                      onClick={() => handleUnenroll(f.id)}
                    >
                      {unenrollingId === f.id ? 'Removing...' : 'Remove This Factor'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Active Sessions */}
      <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
        <SessionsTable />
      </div>
    </div>
  );
}
