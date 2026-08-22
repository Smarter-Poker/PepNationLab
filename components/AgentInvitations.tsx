'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserPlus, Copy, Check, X, RefreshCw, QrCode, Mail, Clock } from 'lucide-react';
import QRCodeGenerator from './QRCodeGenerator';

// Agent / super-agent recruiting: mint, share and manage one-time invitation
// links that let a recipient self-provision an account with a pre-decided role
// and tier. Talks to /api/agent/invitations and the public redeem flow.

type InviteStatus = 'pending' | 'redeemed' | 'expired' | 'revoked';

interface Invitation {
  id: string;
  email: string;
  full_name: string | null;
  intended_role: string;
  intended_tier: string | null;
  intended_account_type: string | null;
  expires_at: string;
  redeemed_at: string | null;
  created_at: string;
  status: InviteStatus;
  invite_url: string | null;
}

const STATUS_STYLES: Record<InviteStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'Pending', bg: 'rgba(0, 196, 188, 0.12)', fg: '#00C4BC' },
  redeemed: { label: 'Redeemed', bg: 'rgba(72, 187, 120, 0.14)', fg: '#48BB78' },
  expired: { label: 'Expired', bg: 'rgba(168, 180, 192, 0.14)', fg: '#A8B4C0' },
  revoked: { label: 'Revoked', bg: 'rgba(229, 62, 62, 0.14)', fg: '#E53E3E' },
};

const TIER_LABELS: Record<string, string> = {
  tier_1: 'Tier 1',
  tier_2: 'Tier 2',
  tier_3: 'Tier 3',
};

interface Props {
  canInviteSuperAgents?: boolean;
}

export default function AgentInvitations({ canInviteSuperAgents = false }: Props) {
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('agent');
  const [tier, setTier] = useState('tier_3');
  const [accountType, setAccountType] = useState('prepaid');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrForId, setQrForId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/agent/invitations', { cache: 'no-store' });
      if (!res.ok) throw new Error('load failed');
      const json = await res.json();
      setInvites(Array.isArray(json.data) ? json.data : []);
    } catch {
      setLoadError('Could Not Load Your Invitations. Please Try Again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/agent/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          full_name: fullName || null,
          intended_role: role,
          intended_tier: tier,
          intended_account_type: accountType,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(json?.error || 'Could Not Send The Invitation.');
        return;
      }
      setEmail('');
      setFullName('');
      await load();
    } catch {
      setFormError('Something Went Wrong. Please Try Again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async (invite: Invitation) => {
    if (!invite.invite_url) return;
    try {
      await navigator.clipboard.writeText(invite.invite_url);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId((c) => (c === invite.id ? null : c)), 2000);
    } catch {
      // Clipboard blocked -- select-and-copy fallback is the browser's job.
    }
  };

  const handleRevoke = async (invite: Invitation) => {
    if (!confirm(`Revoke The Invitation For ${invite.email}? The Link Will Stop Working.`)) return;
    try {
      const res = await fetch(`/api/agent/invitations/${invite.id}`, { method: 'DELETE' });
      if (res.ok) await load();
    } catch {
      // no-op; the list reload on next action will reconcile
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.65rem 0.85rem',
    background: '#0F1923',
    border: '1px solid #1D2D3E',
    borderRadius: '10px',
    color: '#FFFFFF',
    fontSize: '0.95rem',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#A8B4C0',
    marginBottom: '0.35rem',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#FFFFFF', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <UserPlus size={26} color="#00C4BC" /> Invite Agents
        </h1>
        <p style={{ color: '#A8B4C0', marginTop: '0.4rem', fontSize: '0.95rem' }}>
          Send A One-Time Link That Lets A New Agent Set Their Password And Join Your Downline With The Role And Tier You Choose.
        </p>
      </div>

      {/* Mint form */}
      <form onSubmit={handleSubmit} className="card" style={{ padding: '1.5rem', background: '#0F1923', border: '1px solid #1D2D3E', borderRadius: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="new.agent@example.com"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Full Name (Optional)</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jordan Rivera"
              style={inputStyle}
            />
          </div>
          {canInviteSuperAgents && (
            <div>
              <label style={labelStyle}>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
                <option value="agent">Agent</option>
                <option value="super_agent">Super Agent</option>
              </select>
            </div>
          )}
          <div>
            <label style={labelStyle}>Pricing Tier</label>
            <select value={tier} onChange={(e) => setTier(e.target.value)} style={inputStyle}>
              <option value="tier_1">Tier 1 (Best Pricing)</option>
              <option value="tier_2">Tier 2</option>
              <option value="tier_3">Tier 3 (Entry)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Account Type</label>
            <select value={accountType} onChange={(e) => setAccountType(e.target.value)} style={inputStyle}>
              <option value="prepaid">Prepaid</option>
              <option value="credit">Credit</option>
            </select>
          </div>
        </div>

        {formError && (
          <p role="alert" style={{ color: '#FC8181', fontSize: '0.85rem', marginTop: '0.85rem', marginBottom: 0 }}>{formError}</p>
        )}

        <div style={{ marginTop: '1.15rem' }}>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.7rem 1.3rem', background: '#00C4BC', color: '#050A0F',
              border: 'none', borderRadius: '10px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.65 : 1,
            }}
          >
            <Mail size={17} /> {submitting ? 'Sending...' : 'Create Invitation'}
          </button>
        </div>
      </form>

      {/* List */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>Sent Invitations</h2>
          <button
            onClick={load}
            aria-label="Refresh Invitations"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'transparent', border: '1px solid #1D2D3E', color: '#A8B4C0', borderRadius: '8px', padding: '0.4rem 0.7rem', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <p style={{ color: '#A8B4C0' }}>Loading Your Invitations...</p>
        ) : loadError ? (
          <p role="alert" style={{ color: '#FC8181' }}>{loadError}</p>
        ) : invites.length === 0 ? (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', background: '#0F1923', border: '1px dashed #1D2D3E', borderRadius: '16px', color: '#A8B4C0' }}>
            No Invitations Yet. Create One Above To Start Building Your Downline.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {invites.map((invite) => {
              const s = STATUS_STYLES[invite.status];
              return (
                <div key={invite.id} className="card" style={{ padding: '1.1rem 1.25rem', background: '#0F1923', border: '1px solid #1D2D3E', borderRadius: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{invite.email}</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '999px', background: s.bg, color: s.fg }}>
                          {s.label}
                        </span>
                      </div>
                      <div style={{ color: '#A8B4C0', fontSize: '0.82rem', marginTop: '0.35rem', display: 'flex', gap: '0.9rem', flexWrap: 'wrap' }}>
                        <span>{invite.intended_role === 'super_agent' ? 'Super Agent' : 'Agent'}</span>
                        {invite.intended_tier && <span>{TIER_LABELS[invite.intended_tier] ?? invite.intended_tier}</span>}
                        {invite.status === 'pending' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Clock size={13} /> Expires {new Date(invite.expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {invite.status === 'pending' && invite.invite_url && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleCopy(invite)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#162230', border: '1px solid #1D2D3E', color: '#FFFFFF', borderRadius: '8px', padding: '0.45rem 0.75rem', cursor: 'pointer', fontSize: '0.82rem' }}
                        >
                          {copiedId === invite.id ? <><Check size={14} color="#48BB78" /> Copied</> : <><Copy size={14} /> Copy Link</>}
                        </button>
                        <button
                          onClick={() => setQrForId((q) => (q === invite.id ? null : invite.id))}
                          aria-label="Show QR Code"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#162230', border: '1px solid #1D2D3E', color: '#FFFFFF', borderRadius: '8px', padding: '0.45rem 0.6rem', cursor: 'pointer', fontSize: '0.82rem' }}
                        >
                          <QrCode size={14} /> QR
                        </button>
                        <button
                          onClick={() => handleRevoke(invite)}
                          aria-label="Revoke Invitation"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'transparent', border: '1px solid rgba(229,62,62,0.4)', color: '#FC8181', borderRadius: '8px', padding: '0.45rem 0.6rem', cursor: 'pointer', fontSize: '0.82rem' }}
                        >
                          <X size={14} /> Revoke
                        </button>
                      </div>
                    )}
                  </div>

                  {qrForId === invite.id && invite.invite_url && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: '#FFFFFF', borderRadius: '12px', width: 'fit-content' }}>
                      <QRCodeGenerator url={invite.invite_url} size={160} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
