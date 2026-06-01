'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, Check, Users, Gift, Clock, Award } from 'lucide-react';

interface Referral {
  id: string;
  referee_id: string | null;
  referee_email: string | null;
  code: string;
  status: string;
  referrer_reward_amount: number | null;
  referee_reward_amount: number | null;
  applied_at: string | null;
  rewarded_at: string | null;
  expires_at: string | null;
  qualifying_order_id: string | null;
  created_at: string;
  referee_name: string | null;
}

interface Settings {
  referrer_reward: number;
  referee_reward: number;
  min_order_total: number;
  is_active: boolean;
}

interface RedeemedReferral {
  id: string;
  code: string;
  status: string;
  referee_reward_amount: number | null;
  applied_at: string | null;
}

interface Summary {
  total: number;
  qualifying: number;
  rewarded: number;
  earned: number;
}

interface Props {
  code: string;
  settings: Settings | null;
  referrals: Referral[];
  redeemed: RedeemedReferral | null;
  summary: Summary;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  applied: 'Applied',
  qualifying: 'Qualifying',
  rewarded: 'Rewarded',
  expired: 'Expired',
  revoked: 'Revoked',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--grey-400)',
  applied: '#60A5FA',
  qualifying: '#00E5FF',
  rewarded: '#68D391',
  expired: 'var(--grey-500)',
  revoked: '#E53E3E',
};

function formatDate(iso: string | null): string {
  if (!iso) return 'Not Yet';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return 'Not Yet';
  }
}

export default function ReferralsClient({ code, settings, referrals, redeemed, summary }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [applyCode, setApplyCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');

  const programActive = settings?.is_active !== false;
  const shareLink = `https://pepnationlab.com/?ref=${code}`;

  function copy(text: string, setter: (b: boolean) => void) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setter(true);
        toast.success('Copied To Clipboard');
        setTimeout(() => setter(false), 2000);
      })
      .catch(() => {
        toast.error('Could Not Copy');
      });
  }

  async function applyCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApplyError('');
    const trimmed = applyCode.trim();
    if (!trimmed) {
      setApplyError('Code Is Required');
      return;
    }
    setApplying(true);
    try {
      const res = await fetch('/api/researcher/referrals/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApplyError(data?.error || 'Could Not Apply Code');
        setApplying(false);
        return;
      }
      toast.success('Referral Code Applied');
      router.refresh();
    } catch {
      setApplyError('Network Error');
      setApplying(false);
    }
  }

  const canApply = !redeemed && programActive;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)', padding: 'var(--space-6) var(--space-4)' }}>
      <div className="container" style={{ maxWidth: 980 }}>
        <h1 className="animated-gradient-text" style={{ color: 'var(--white)', fontSize: '1.6rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-2)' }}>
          Referrals
        </h1>
        <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-6)' }}>
          Invite Fellow Researchers. Earn Store Credit On Their First Qualifying Order.
        </p>

        {!programActive && (
          <div
            className="card"
            style={{
              padding: 'var(--space-4)',
              background: 'rgba(229,62,62,0.08)',
              border: '1px solid rgba(229,62,62,0.3)',
              marginBottom: 'var(--space-5)',
            }}
          >
            <div style={{ color: 'var(--red)', fontWeight: 700, fontSize: '0.92rem' }}>
              Referral Program Is Currently Paused
            </div>
            <div style={{ color: 'var(--silver)', fontSize: '0.82rem', marginTop: 4 }}>
              New Referrals Cannot Be Applied At This Time.
            </div>
          </div>
        )}

        {/* Code card */}
        <div
          className="card-metal"
          style={{
            padding: 'var(--space-6)',
            marginBottom: 'var(--space-5)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <Gift size={18} aria-hidden style={{ color: 'var(--teal)' }} />
            <div style={{ color: 'var(--grey-400)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Your Referral Code
            </div>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-brand)',
              fontSize: 'clamp(1.8rem, 8vw, 2.4rem)',
              fontWeight: 800,
              letterSpacing: '0.2em',
              color: 'var(--teal)',
              marginBottom: 'var(--space-4)',
              textShadow: '0 0 24px rgba(0,196,188,0.25)',
              wordBreak: 'break-all',
            }}
          >
            {code || '------'}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => copy(code, setCopied)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
            >
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              {copied ? 'Copied' : 'Copy Code'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => copy(shareLink, setCopiedLink)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
            >
              {copiedLink ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              {copiedLink ? 'Copied' : 'Copy Share Link'}
            </button>
          </div>

          {settings && (
            <div style={{ marginTop: 'var(--space-4)', fontSize: '0.82rem', color: 'var(--silver)' }}>
              Earn <strong style={{ color: 'var(--teal)' }}>${Number(settings.referrer_reward).toFixed(2)}</strong>{' '}
              When A Referred Researcher Completes A Qualifying Order Of{' '}
              <strong style={{ color: 'var(--teal)' }}>${Number(settings.min_order_total).toFixed(2)}</strong> Or More.
              They Also Receive <strong style={{ color: 'var(--teal)' }}>${Number(settings.referee_reward).toFixed(2)}</strong> In Store Credit.
            </div>
          )}
        </div>

        {/* Summary cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-5)',
          }}
        >
          <StatCard label="Total Referrals" value={String(summary.total)} Icon={Users} />
          <StatCard label="Qualifying" value={String(summary.qualifying)} Icon={Clock} />
          <StatCard label="Rewarded" value={String(summary.rewarded)} Icon={Award} />
          <StatCard label="Total Earned" value={`$${summary.earned.toFixed(2)}`} Icon={Gift} />
        </div>

        {/* Apply referral form / status */}
        {redeemed ? (
          <div
            className="card-metal"
            style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-5)' }}
          >
            <div style={{ color: 'var(--grey-400)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>
              You Applied A Referral Code
            </div>
            <div style={{ color: 'var(--white)', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>
              {redeemed.code}
            </div>
            <div style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>
              Status: <strong style={{ color: STATUS_COLORS[redeemed.status] ?? 'var(--silver)' }}>
                {STATUS_LABELS[redeemed.status] ?? redeemed.status}
              </strong>
              {redeemed.referee_reward_amount && redeemed.status === 'rewarded' && (
                <span> · Earned ${Number(redeemed.referee_reward_amount).toFixed(2)} In Store Credit</span>
              )}
              {redeemed.status === 'qualifying' && (
                <span> · Complete A Qualifying Order To Earn Your Bonus</span>
              )}
            </div>
          </div>
        ) : canApply ? (
          <div className="card-metal" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
            <div style={{ color: 'var(--grey-400)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-3)' }}>
              Apply A Referral Code
            </div>
            <form onSubmit={applyCodeSubmit} style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={applyCode}
                onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
                placeholder="ENTER CODE"
                maxLength={32}
                className="input"
                style={{ flex: '1 1 200px', fontFamily: 'var(--font-brand)', letterSpacing: '0.12em', textTransform: 'uppercase' as const }}
                disabled={applying}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={applying || applyCode.trim().length === 0}
                style={{ fontSize: '0.92rem' }}
              >
                {applying ? 'Applying...' : 'Apply'}
              </button>
            </form>
            {applyError && (
              <div
                style={{
                  marginTop: 'var(--space-2)',
                  color: 'var(--red)',
                  fontSize: '0.82rem',
                }}
              >
                {applyError}
              </div>
            )}
          </div>
        ) : null}

        {/* List of issued referrals */}
        <div className="card-metal" style={{ padding: 'var(--space-5)' }}>
          <div style={{ color: 'var(--grey-400)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-3)' }}>
            Your Referral History
          </div>
          {referrals.length === 0 ? (
            <p style={{ color: 'var(--silver)', textAlign: 'center', padding: 'var(--space-5)', fontSize: '0.92rem' }}>
              You Have Not Referred Anyone Yet. Share Your Code To Get Started.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Referee</th>
                    <th style={thStyle}>Applied</th>
                    <th style={thStyle}>Reward</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => {
                    const color = STATUS_COLORS[r.status] ?? 'var(--grey-400)';
                    return (
                      <tr key={r.id} className="table-row-hover" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={tdStyle}>
                          {r.referee_name || r.referee_email || 'Anonymous'}
                        </td>
                        <td style={tdStyle}>{formatDate(r.applied_at)}</td>
                        <td style={tdStyle}>
                          ${Number(r.referrer_reward_amount ?? 0).toFixed(2)}
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color,
                              background: `${color}18`,
                              border: `1px solid ${color}40`,
                              padding: '2px var(--space-2)',
                              borderRadius: 'var(--radius-full)',
                            }}
                          >
                            {STATUS_LABELS[r.status] ?? r.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, Icon }: { label: string; value: string; Icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }> }) {
  return (
    <div
      className="card-metal hover-lift"
      style={{
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--silver)', fontSize: '0.78rem' }}>
        <Icon size={14} aria-hidden />
        <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ color: 'var(--white)', fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-brand)' }}>{value}</div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  fontSize: '0.72rem',
  color: 'var(--grey-500)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  padding: 'var(--space-2)',
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: 'var(--space-2)',
  fontSize: '0.88rem',
  color: 'var(--silver)',
};
