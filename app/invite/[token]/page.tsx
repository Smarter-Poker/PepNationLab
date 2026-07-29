'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { UserPlus, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

// Public invitation redemption landing. The one-time token is the credential;
// no session is required. Validates the token, then lets the recipient set a
// password to provision their account through /api/agent-invitations/redeem.

type ValidState =
  | { phase: 'loading' }
  | { phase: 'invalid'; reason: string }
  | { phase: 'valid'; email: string; role: string; tier: string | null; invitedByName: string | null; fullName: string | null };

const REASON_COPY: Record<string, string> = {
  not_found: 'This Invitation Link Is Not Valid.',
  redeemed: 'This Invitation Has Already Been Used.',
  revoked: 'This Invitation Was Revoked By The Sender.',
  expired: 'This Invitation Has Expired. Please Ask For A New One.',
};

export default function InviteRedeemPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [state, setState] = useState<ValidState>({ phase: 'loading' });
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/agent-invitations/redeem?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (json?.valid) {
          setState({
            phase: 'valid',
            email: json.email,
            role: json.intended_role,
            tier: json.intended_tier ?? null,
            invitedByName: json.invited_by_name ?? null,
            fullName: json.full_name ?? null,
          });
          if (json.full_name) setFullName(json.full_name);
        } else {
          setState({ phase: 'invalid', reason: json?.reason ?? 'not_found' });
        }
      } catch {
        if (!cancelled) setState({ phase: 'invalid', reason: 'not_found' });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (password.length !== 8) {
      setError('Password Must Be Exactly 8 Characters.');
      return;
    }
    if (password !== confirm) {
      setError('The Passwords Do Not Match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/agent-invitations/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, full_name: fullName || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || 'Could Not Complete Your Signup. Please Try Again.');
        return;
      }
      setDone(true);
    } catch {
      setError('Something Went Wrong. Please Try Again.');
    } finally {
      setSubmitting(false);
    }
  };

  const shell: React.CSSProperties = {
    minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#050A0F', padding: '1.5rem',
  };
  const card: React.CSSProperties = {
    width: '100%', maxWidth: '440px', background: '#0F1923', border: '1px solid #1D2D3E',
    borderRadius: '18px', padding: '2rem',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.7rem 0.85rem', background: '#050A0F', border: '1px solid #1D2D3E',
    borderRadius: '10px', color: '#FFFFFF', fontSize: '0.95rem',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#A8B4C0', marginBottom: '0.35rem',
  };

  if (state.phase === 'loading') {
    return <div style={shell}><div style={{ ...card, textAlign: 'center', color: '#A8B4C0' }}>Checking Your Invitation...</div></div>;
  }

  if (state.phase === 'invalid') {
    return (
      <div style={shell}>
        <div style={{ ...card, textAlign: 'center' }}>
          <AlertCircle size={40} color="#E53E3E" style={{ margin: '0 auto 1rem' }} />
          <h1 style={{ color: '#FFFFFF', fontSize: '1.3rem', fontWeight: 800, margin: '0 0 0.6rem' }}>Invitation Unavailable</h1>
          <p style={{ color: '#A8B4C0', margin: '0 0 1.5rem' }}>{REASON_COPY[state.reason] ?? REASON_COPY.not_found}</p>
          <Link href="/login" style={{ color: '#00C4BC', fontWeight: 700, textDecoration: 'none' }}>Go To Sign In</Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={shell}>
        <div style={{ ...card, textAlign: 'center' }}>
          <CheckCircle2 size={44} color="#48BB78" style={{ margin: '0 auto 1rem' }} />
          <h1 style={{ color: '#FFFFFF', fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.6rem' }}>Your Account Is Ready</h1>
          <p style={{ color: '#A8B4C0', margin: '0 0 1.5rem' }}>
            Welcome To Pep Nation Lab. Sign In With {state.email} To Set Up Your Storefront.
          </p>
          <Link
            href="/login"
            style={{ display: 'inline-block', background: '#00C4BC', color: '#050A0F', fontWeight: 700, padding: '0.7rem 1.4rem', borderRadius: '10px', textDecoration: 'none' }}
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const roleLabel = state.role === 'super_agent' ? 'Super Agent' : 'Agent';
  const tierLabel = state.tier ? ({ tier_1: 'Tier 1', tier_2: 'Tier 2', tier_3: 'Tier 3' } as Record<string, string>)[state.tier] ?? state.tier : null;

  return (
    <div style={shell}>
      <form onSubmit={handleSubmit} style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
          <UserPlus size={24} color="#00C4BC" />
          <h1 style={{ color: '#FFFFFF', fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>Accept Your Invitation</h1>
        </div>
        <p style={{ color: '#A8B4C0', fontSize: '0.92rem', margin: '0 0 1.25rem' }}>
          {state.invitedByName ? `${state.invitedByName} Invited You` : 'You Have Been Invited'} To Join Pep Nation Lab As {tierLabel ? `A ${roleLabel} On ${tierLabel}` : `A ${roleLabel}`}.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Email Address</label>
            <input type="email" value={state.email} disabled style={{ ...inputStyle, opacity: 0.7 }} />
          </div>
          <div>
            <label style={labelStyle}>Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your Name" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Create Password</label>
            <input type="password" required minLength={8} maxLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Exactly 8 Characters" style={inputStyle} autoComplete="new-password" />
          </div>
          <div>
            <label style={labelStyle}>Confirm Password</label>
            <input type="password" required minLength={8} maxLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-Enter Password" style={inputStyle} autoComplete="new-password" />
          </div>
        </div>

        {error && <p style={{ color: '#E53E3E', fontSize: '0.85rem', margin: '0.9rem 0 0' }}>{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%', marginTop: '1.35rem', padding: '0.8rem', background: '#00C4BC', color: '#050A0F',
            border: 'none', borderRadius: '10px', fontWeight: 800, fontSize: '1rem',
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.65 : 1,
          }}
        >
          {submitting ? 'Creating Your Account...' : 'Create My Account'}
        </button>

        <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', color: '#A8B4C0', fontSize: '0.78rem', margin: '1rem 0 0' }}>
          <ShieldCheck size={14} color="#00C4BC" /> Research Use Only. Your Link Is Private And Single-Use.
        </p>
      </form>
    </div>
  );
}
