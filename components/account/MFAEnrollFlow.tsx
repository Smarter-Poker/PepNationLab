'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';

interface Props {
  onEnrolled?: () => void;
}

type Stage = 'idle' | 'qr' | 'verified';

export default function MFAEnrollFlow({ onEnrolled }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [busy, setBusy] = useState(false);

  const [factorId, setFactorId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [qrPng, setQrPng] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const startEnroll = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/agent/mfa/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendly_name: 'Authenticator App' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Start Enrollment.');
      setFactorId(json.factor_id);
      setSecret(json.secret);
      setQrPng(json.qr_png_data);
      setStage('qr');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed To Start Enrollment.';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }, []);

  const verify = useCallback(async () => {
    if (!factorId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/agent/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factor_id: factorId, code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Verification Failed.');
      toast.success('Two-Factor Authentication Enabled.');
      setStage('verified');
      onEnrolled?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification Failed.';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }, [factorId, code, onEnrolled]);

  const cancel = useCallback(() => {
    setStage('idle');
    setFactorId(null);
    setSecret(null);
    setQrPng(null);
    setCode('');
  }, []);

  if (stage === 'idle') {
    return (
      <div>
        <p style={{ color: 'var(--silver)', fontSize: '0.85rem', lineHeight: 1.6, margin: '0 0 var(--space-3)' }}>
          Add A Second Factor With An Authenticator App Like Google Authenticator, Authy, Or 1Password.
        </p>
        <button type="button" className="btn btn-primary" onClick={startEnroll} disabled={busy}>
          {busy ? 'Starting...' : 'Enroll Authenticator'}
        </button>
      </div>
    );
  }

  if (stage === 'qr') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <p style={{ color: 'var(--silver)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
          Step 1: Scan This QR Code With Your Authenticator App.
        </p>

        {qrPng && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Image
              src={qrPng}
              alt="Two-Factor QR Code"
              width={220}
              height={220}
              style={{ background: 'var(--white)', padding: 12, borderRadius: 12 }}
              unoptimized
            />
          </div>
        )}

        {secret && (
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--silver)', marginBottom: 4 }}>
              Or Paste This Secret Manually
            </div>
            <code
              style={{
                display: 'block',
                padding: 'var(--space-3)',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--teal)',
                fontSize: '0.9rem',
                wordBreak: 'break-all',
                userSelect: 'all',
              }}
            >
              {secret}
            </code>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="mfa-code">
            Step 2: Enter The 6-Digit Code From Your App
          </label>
          <input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="form-input"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
          />
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={cancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={verify} disabled={busy || code.length < 4}>
            {busy ? 'Verifying...' : 'Verify And Enable'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(192,184,168,0.08)',
          border: '1px solid rgba(192,184,168,0.3)',
          color: 'var(--teal)',
          marginBottom: 'var(--space-4)',
        }}
      >
        Two-Factor Authentication Is Enabled On This Account.
      </div>

      {secret && (
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--silver)', marginBottom: 'var(--space-2)' }}>
            Save Your Backup Secret In A Safe Place. If You Lose Your Phone, This Is The Only Way Back In.
          </div>
          <code
            style={{
              display: 'block',
              padding: 'var(--space-3)',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--white)',
              fontSize: '0.9rem',
              wordBreak: 'break-all',
              userSelect: 'all',
            }}
          >
            {secret}
          </code>
        </div>
      )}

      <div style={{ marginTop: 'var(--space-4)' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={cancel}>
          Done
        </button>
      </div>
    </div>
  );
}
