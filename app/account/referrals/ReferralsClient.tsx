'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Gift, Copy, Check, ChevronLeft, Users, DollarSign, Info } from 'lucide-react';
import { toast } from 'sonner';

interface Referral {
  id: string;
  status: string;
  referee_email: string | null;
  applied_at: string | null;
  rewarded_at: string | null;
  referrer_reward_amount: number | null;
  referee_reward_amount: number | null;
  created_at: string;
}

interface Settings {
  referrer_reward: number;
  referee_reward: number;
  min_order_total: number;
  is_active: boolean;
}

interface Props {
  referralCode: string | null;
  referrals: Referral[];
  settings: Settings;
  /** Status of a referral where the current user is the referee, if any. */
  myReferralStatus?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  applied: 'Code Applied',
  qualifying: 'Awaiting Order',
  rewarded: 'Rewarded',
  expired: 'Expired',
  revoked: 'Revoked',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--silver)',
  applied: '#63B3ED',
  qualifying: '#F6AD55',
  rewarded: 'var(--teal)',
  expired: 'rgba(255,255,255,0.3)',
  revoked: 'var(--red)',
};

export default function ReferralsClient({ referralCode, referrals, settings, myReferralStatus = null }: Props) {
  const [copied, setCopied] = useState(false);

  // "Enter A Code" state for users who signed up without a referral link.
  const [enteredCode, setEnteredCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [appliedStatus, setAppliedStatus] = useState<string | null>(myReferralStatus);

  async function applyCode() {
    const code = enteredCode.trim();
    if (!code || applying) return;
    setApplying(true);
    try {
      const res = await fetch('/api/researcher/referrals/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAppliedStatus('qualifying');
        toast.success('Referral Code Applied. Your Credit Unlocks After Your First Qualifying Order.');
      } else {
        toast.error(data?.error || 'Could Not Apply That Referral Code.');
      }
    } catch {
      toast.error('Could Not Apply That Referral Code.');
    } finally {
      setApplying(false);
    }
  }

  const [originUrl, setOriginUrl] = useState('https://pepnationlab.com');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOriginUrl(window.location.origin);
    }
  }, []);
  
  const referralLink = referralCode
    ? `${originUrl}/signup?ref=${referralCode}`
    : null;

  async function copyCode() {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast.success('Referral Code Copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy Failed');
    }
  }

  async function copyLink() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success('Referral Link Copied');
    } catch {
      toast.error('Copy Failed');
    }
  }

  const rewarded = referrals.filter(r => r.status === 'rewarded').length;
  const totalEarned = referrals
    .filter(r => r.status === 'rewarded')
    .reduce((sum, r) => sum + (Number(r.referrer_reward_amount) || 0), 0);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)', padding: 'var(--space-6) var(--space-4)' }}>
      <div className="container" style={{ maxWidth: 700 }}>

        {/* Back */}
        <Link href="/account" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--silver)', textDecoration: 'none', fontSize: '0.88rem', marginBottom: 'var(--space-5)' }}>
          <ChevronLeft size={16} aria-hidden />
          Back To Account
        </Link>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <Gift size={22} aria-hidden style={{ color: 'var(--teal)' }} />
          <h1 className="animated-gradient-text" style={{ color: 'var(--white)', fontSize: '1.6rem', fontFamily: 'var(--font-brand)' }}>
            Referrals
          </h1>
        </div>
        <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-6)' }}>
          Share Your Code And Earn Store Credit When A Friend Places Their First Qualifying Order.
        </p>

        {/* Program paused banner */}
        {!settings.is_active && (
          <div className="glass-panel" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-5)', border: '1px solid rgba(229,62,62,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Info size={16} aria-hidden style={{ color: 'var(--red)', flexShrink: 0 }} />
              <span style={{ color: 'var(--silver)', fontSize: '0.9rem' }}>The Referral Program Is Currently Paused. Check Back Soon.</span>
            </div>
          </div>
        )}

        {/* Stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          {[
            { label: 'Total Referrals', value: referrals.length, Icon: Users },
            { label: 'Rewarded', value: rewarded, Icon: Check },
            { label: 'Total Earned', value: `$${totalEarned.toFixed(2)}`, Icon: DollarSign },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="glass-panel" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
              <Icon size={18} aria-hidden style={{ color: 'var(--teal)', marginBottom: 8 }} />
              <div style={{ color: 'var(--white)', fontWeight: 700, fontSize: '1.3rem' }}>{value}</div>
              <div style={{ color: 'var(--silver)', fontSize: '0.78rem', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Referral Code Card */}
        <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }}>
          <h2 style={{ color: 'var(--white)', marginBottom: 'var(--space-2)', fontSize: '1.1rem' }}>Your Referral Code</h2>
          <p style={{ color: 'var(--silver)', fontSize: '0.88rem', marginBottom: 'var(--space-4)' }}>
            Share this code with friends. They earn ${settings.referee_reward} in store credit, and you earn ${settings.referrer_reward} after their first qualifying order over ${settings.min_order_total}.
          </p>

          {referralCode ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div style={{
                  flex: 1,
                  background: 'rgba(0,196,188,0.08)',
                  border: '1px solid rgba(0,196,188,0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: 'var(--teal)',
                  fontFamily: 'var(--font-mono, monospace)',
                  textAlign: 'center',
                }}>
                  {referralCode}
                </div>
                <button
                  onClick={copyCode}
                  className="btn btn-secondary"
                  style={{ flexShrink: 0, gap: 6, display: 'flex', alignItems: 'center' }}
                  aria-label="Copy Referral Code"
                >
                  {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                  {copied ? 'Copied' : 'Copy Code'}
                </button>
              </div>

              <button
                onClick={copyLink}
                className="btn btn-ghost"
                style={{ fontSize: '0.85rem', color: 'var(--silver)', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Copy size={14} aria-hidden />
                Copy Referral Link
              </button>
            </>
          ) : (
            <div style={{ color: 'var(--silver)', fontSize: '0.9rem' }}>
              Unable To Load Your Referral Code. Please Refresh The Page.
            </div>
          )}
        </div>

        {/* Enter A Referral Code (referee side) */}
        {settings.is_active && (
          <div className="glass-panel" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }}>
            <h2 style={{ color: 'var(--white)', marginBottom: 'var(--space-2)', fontSize: '1.1rem' }}>Have A Referral Code?</h2>
            {appliedStatus ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Check size={16} aria-hidden style={{ color: 'var(--teal)', flexShrink: 0 }} />
                <span style={{ color: 'var(--silver)', fontSize: '0.9rem' }}>
                  {appliedStatus === 'rewarded'
                    ? 'Your Referral Credit Has Been Issued.'
                    : `A Referral Code Is Applied To Your Account. Your $${settings.referee_reward} Credit Unlocks After Your First Qualifying Order Over $${settings.min_order_total}.`}
                </span>
              </div>
            ) : (
              <>
                <p style={{ color: 'var(--silver)', fontSize: '0.88rem', marginBottom: 'var(--space-4)' }}>
                  Enter A Friend&apos;s Code To Earn ${settings.referee_reward} In Store Credit After Your First Qualifying Order Over ${settings.min_order_total}.
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <input
                    type="text"
                    value={enteredCode}
                    onChange={e => setEnteredCode(e.target.value.toUpperCase())}
                    placeholder="Enter Code"
                    maxLength={20}
                    aria-label="Referral Code"
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 16px',
                      fontSize: '1rem',
                      letterSpacing: '0.08em',
                      color: 'var(--white)',
                      fontFamily: 'var(--font-mono, monospace)',
                    }}
                  />
                  <button
                    onClick={applyCode}
                    disabled={applying || !enteredCode.trim()}
                    className="btn btn-primary"
                    style={{ flexShrink: 0 }}
                  >
                    {applying ? 'Applying...' : 'Apply Code'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Referral History */}
        <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 style={{ color: 'var(--white)', fontSize: '1rem', margin: 0 }}>Referral History</h2>
          </div>

          {referrals.length === 0 ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
              <Gift size={32} aria-hidden style={{ color: 'rgba(255,255,255,0.15)', marginBottom: 'var(--space-3)' }} />
              <p style={{ color: 'var(--silver)', fontSize: '0.9rem', margin: 0 }}>No Referrals Yet. Share Your Code To Get Started.</p>
            </div>
          ) : (
            <div>
              {referrals.map(r => (
                <div key={r.id} style={{
                  padding: 'var(--space-4) var(--space-5)',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                }}>
                  <div>
                    <div style={{ color: 'var(--white)', fontSize: '0.9rem', fontWeight: 500 }}>
                      {r.referee_email || 'Pending Signup'}
                    </div>
                    <div style={{ color: 'var(--silver)', fontSize: '0.78rem', marginTop: 2 }}>
                      {new Date(r.created_at).toLocaleDateString()}
                      {r.rewarded_at && ` - Rewarded ${new Date(r.rewarded_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
                    {r.status === 'rewarded' && r.referrer_reward_amount && (
                      <span style={{ color: 'var(--teal)', fontSize: '0.88rem', fontWeight: 600 }}>
                        +${Number(r.referrer_reward_amount).toFixed(2)}
                      </span>
                    )}
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: 12,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: 'rgba(255,255,255,0.05)',
                      color: STATUS_COLORS[r.status] || 'var(--silver)',
                    }}>
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
