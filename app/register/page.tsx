'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const DISCLAIMER_CHECKBOXES = [
  {
    id: 'research-only',
    text: 'I confirm that all compounds purchased are strictly for in vitro laboratory research purposes only — NOT for human or animal consumption, ingestion, or injection of any kind.',
  },
  {
    id: 'no-delivery',
    text: 'I understand that Pep Nation Lab does not sell BAC water, needles, syringes, or any injection/delivery devices, and I will not attempt to purchase them.',
  },
  {
    id: 'qualified',
    text: 'I am a qualified researcher or represent a legitimate research institution, and I accept full legal responsibility for compliance with all applicable federal, state, and local laws.',
  },
];

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<'disclaimer' | 'form'>('disclaimer');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    referralCode: searchParams.get('ref') ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const allChecked = DISCLAIMER_CHECKBOXES.every(c => checked[c.id]);

  function handleCheck(id: string) {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function handleField(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords Do Not Match.');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password Must Be At Least 8 Characters.');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.fullName,
          phone: formData.phone,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const newUserId = authData.user?.id;

    // Log disclaimer acceptance with user linkage
    await supabase.from('disclaimer_acceptances').insert({
      user_id: newUserId ?? null,
      disclaimer_version: 'v1.0',
      layer: 'registration',
      user_agent: navigator.userAgent,
    });

    // Wire referral code -> referring_agent_id
    if (formData.referralCode.trim() && newUserId) {
      const { data: agentProfile } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('slug', formData.referralCode.trim().toLowerCase())
        .eq('is_active', true)
        .single();

      if (agentProfile) {
        await supabase
          .from('profiles')
          .update({ referring_agent_id: agentProfile.id })
          .eq('id', newUserId);
      }
    }

    router.push('/dashboard?welcome=1');
    router.refresh();
  }

  if (step === 'disclaimer') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--black)',
        padding: 'var(--space-6)'
      }}>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(229,62,62,0.04) 0%, transparent 60%)', pointerEvents: 'none' }} />

        <div style={{ width: '100%', maxWidth: 540, position: 'relative' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
            <Link href="/" style={{ display: 'inline-block' }} aria-label="Pep Nation Lab Home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Pep Nation Lab" style={{ height: 100, width: 'auto', display: 'inline-block' }} />
            </Link>
          </div>

          <div className="card-metal" style={{ padding: 'var(--space-8)' }}>
            {/* Warning header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(229,62,62,0.12)', border: '2px solid rgba(229,62,62,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <h2 style={{ fontSize: '1.2rem', marginBottom: 2 }}>Research Use Only Acknowledgment</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)' }}>You Must Accept All Terms To Create An Account</p>
              </div>
            </div>

            <div className="disclaimer-warning" style={{ marginBottom: 'var(--space-6)' }}>
              <p style={{ fontSize: '0.82rem', lineHeight: 1.7, color: 'var(--silver)' }}>
                All compounds sold on PepNationLab.com are strictly for <strong style={{ color: 'var(--red)' }}>in vitro research use only</strong>. They are NOT approved by the FDA and are NOT intended for human or animal use. Pep Nation Lab does not sell delivery devices of any kind.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
              {DISCLAIMER_CHECKBOXES.map((item, i) => (
                <label
                  key={item.id}
                  htmlFor={item.id}
                  style={{
                    display: 'flex',
                    gap: 'var(--space-3)',
                    cursor: 'pointer',
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    background: checked[item.id] ? 'rgba(0,196,188,0.06)' : 'var(--surface-2)',
                    border: `1px solid ${checked[item.id] ? 'rgba(0,196,188,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    transition: 'all 0.2s',
                  }}
                >
                  <input
                    type="checkbox"
                    id={item.id}
                    checked={!!checked[item.id]}
                    onChange={() => handleCheck(item.id)}
                    style={{ marginTop: 3, accentColor: 'var(--teal)', flexShrink: 0, width: 16, height: 16 }}
                  />
                  <span style={{ fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--silver)' }}>
                    <strong style={{ color: 'var(--white)' }}>{i + 1}.</strong> {item.text}
                  </span>
                </label>
              ))}
            </div>

            <button
              id="disclaimer-accept-btn"
              onClick={() => setStep('form')}
              disabled={!allChecked}
              className="btn btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                opacity: allChecked ? 1 : 0.4,
                cursor: allChecked ? 'pointer' : 'not-allowed',
              }}
            >
              I Agree — Continue To Registration
            </button>

            <p style={{ textAlign: 'center', marginTop: 'var(--space-4)', fontSize: '0.8rem', color: 'var(--grey-400)' }}>
              Already Have An Account?{' '}
              <Link href="/login" style={{ color: 'var(--teal)' }}>Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--black)',
      padding: 'var(--space-6)'
    }}>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(0,196,188,0.06) 0%, transparent 60%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 480, position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <Link href="/" style={{ display: 'inline-block' }} aria-label="Pep Nation Lab Home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Pep Nation Lab" style={{ height: 100, width: 'auto', display: 'inline-block' }} />
          </Link>
          <p style={{ marginTop: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--grey-400)' }}>Create Researcher Account</p>
        </div>

        <div className="card-metal" style={{ padding: 'var(--space-8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
            <div className="badge badge-teal" style={{ fontSize: '0.7rem' }}>Disclaimer Accepted</div>
          </div>

          {error && (
            <div className="disclaimer-warning" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--red)' }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label" htmlFor="fullName">Full Name</label>
              <input id="fullName" name="fullName" type="text" className="form-input" placeholder="Dr. Jane Smith" value={formData.fullName} onChange={handleField} required />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Email Address</label>
              <input id="reg-email" name="email" type="email" className="form-input" placeholder="researcher@lab.com" value={formData.email} onChange={handleField} required />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="phone">Phone Number</label>
              <input id="phone" name="phone" type="tel" className="form-input" placeholder="+1 (555) 000-0000" value={formData.phone} onChange={handleField} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Password</label>
              <input id="reg-password" name="password" type="password" className="form-input" placeholder="Minimum 8 Characters" value={formData.password} onChange={handleField} required />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" className="form-input" placeholder="Repeat Password" value={formData.confirmPassword} onChange={handleField} required />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="referralCode">
                Agent Referral Code{' '}
                <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input id="referralCode" name="referralCode" type="text" className="form-input" placeholder="E.g. marcela" value={formData.referralCode} onChange={handleField} />
            </div>

            <button
              type="submit"
              id="register-submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--space-2)', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Creating Account...' : 'Create Researcher Account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: '0.8rem', color: 'var(--grey-400)' }}>
            Already Have An Account?{' '}
            <Link href="/login" style={{ color: 'var(--teal)' }}>Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// Suspense wrapper required by Next.js for useSearchParams() in App Router
export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--black)' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <RegisterPageInner />
    </Suspense>
  );
}
