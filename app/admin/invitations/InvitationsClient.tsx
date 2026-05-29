'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

/**
 * Reusable invitations panel.
 *
 * Used by the admin /admin/invitations page (mode="admin") and also embedded
 * inside the super-agent dashboard tab (mode="super_agent"). The server-side
 * route already enforces the privilege; this component only changes which
 * options are exposed in the form (super agents can only create `agent`
 * invites, never `super_agent`).
 */

type Status = 'pending' | 'redeemed' | 'revoked' | 'expired';

interface InviteRow {
  id: string;
  token: string;
  email: string;
  full_name: string | null;
  intended_role: 'agent' | 'super_agent';
  intended_tier: string | null;
  intended_account_type: string | null;
  intended_credit_limit: number | null;
  intended_prepaid_balance: number | null;
  parent_agent_id: string | null;
  expires_at: string;
  redeemed_at: string | null;
  created_at: string;
  invite_url: string;
  status: Status;
}

interface Props {
  mode: 'admin' | 'super_agent';
}

const STATUS_COLORS: Record<Status, string> = {
  pending: 'var(--teal)',
  redeemed: '#68D391',
  expired: 'var(--grey-400)',
  revoked: 'var(--red)',
};

const STATUS_LABELS: Record<Status, string> = {
  pending: 'Pending',
  redeemed: 'Redeemed',
  expired: 'Expired',
  revoked: 'Revoked',
};

const ROLE_LABELS: Record<string, string> = {
  agent: 'Agent',
  super_agent: 'Super Agent',
};

const TIER_LABELS: Record<string, string> = {
  tier_1: 'Tier 1',
  tier_2: 'Tier 2',
  tier_3: 'Tier 3',
};

export default function InvitationsClient({ mode }: Props) {
  const [items, setItems] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'agent' | 'super_agent'>('agent');
  const [tier, setTier] = useState<string>('tier_2');
  const [accountType, setAccountType] = useState<string>('prepaid');
  const [creditLimit, setCreditLimit] = useState('');
  const [prepaidBalance, setPrepaidBalance] = useState('');

  const [lastCreated, setLastCreated] = useState<InviteRow | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/agent-invitations');
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error || 'Failed To Load Invitations.');
      } else {
        setItems(json.items ?? []);
      }
    } catch {
      toast.error('Failed To Load Invitations.');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setShowCreate(true);
    setFormError('');
    setLastCreated(null);
    setEmail('');
    setFullName('');
    setRole('agent');
    setTier('tier_2');
    setAccountType('prepaid');
    setCreditLimit('');
    setPrepaidBalance('');
  }

  function closeCreate() {
    setShowCreate(false);
    setFormError('');
    setLastCreated(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!email.trim()) {
      setFormError('Email Required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError('Valid Email Required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        email: email.trim(),
        full_name: fullName.trim() || null,
        intended_role: role,
        intended_tier: tier || null,
        intended_account_type: accountType || null,
      };
      if (accountType === 'credit' && creditLimit) {
        payload.intended_credit_limit = Number(creditLimit);
      }
      if (accountType === 'prepaid' && prepaidBalance) {
        payload.intended_prepaid_balance = Number(prepaidBalance);
      }

      const res = await fetch('/api/admin/agent-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json?.error || 'Failed To Create Invite.');
        return;
      }

      toast.success('Invite Created.');
      setLastCreated(json as InviteRow);
      await load();
    } catch {
      setFormError('Failed To Create Invite.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke This Invitation?')) return;
    try {
      const res = await fetch(`/api/admin/agent-invitations/${id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error || 'Failed To Revoke.');
        return;
      }
      toast.success('Invite Revoked.');
      await load();
    } catch {
      toast.error('Failed To Revoke.');
    }
  }

  function copyLink(url: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(url).then(
        () => toast.success('Invite Link Copied.'),
        () => toast.error('Failed To Copy.')
      );
    }
  }

  const showRoleSelector = mode === 'admin';

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-5)', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          Send New Invite
        </button>
      </div>

      <div className="card-metal" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead style={{ background: 'var(--surface-2)' }}>
            <tr>
              <th style={th}>Email</th>
              <th style={th}>Role / Tier</th>
              <th style={th}>Status</th>
              <th style={th}>Expires</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--grey-400)' }}>Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--grey-400)' }}>No Invitations Yet.</td></tr>
            ) : items.map((row) => (
              <tr key={row.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={td}>
                  <div style={{ color: 'var(--silver)', textTransform: 'none' as const }}>{row.email}</div>
                  {row.full_name ? <div style={{ fontSize: '0.75rem', color: 'var(--grey-500)' }}>{row.full_name}</div> : null}
                </td>
                <td style={td}>
                  <div style={{ color: 'var(--silver)' }}>{ROLE_LABELS[row.intended_role] ?? row.intended_role}</div>
                  {row.intended_tier ? <div style={{ fontSize: '0.75rem', color: 'var(--grey-500)' }}>{TIER_LABELS[row.intended_tier] ?? row.intended_tier}</div> : null}
                </td>
                <td style={td}>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: STATUS_COLORS[row.status],
                    background: `${STATUS_COLORS[row.status]}15`,
                    border: `1px solid ${STATUS_COLORS[row.status]}40`,
                    padding: '4px var(--space-3)',
                    borderRadius: 'var(--radius-full)',
                  }}>
                    {STATUS_LABELS[row.status]}
                  </span>
                </td>
                <td style={{ ...td, color: 'var(--grey-400)' }}>
                  {new Date(row.expires_at).toLocaleDateString()}
                </td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {row.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                          onClick={() => copyLink(row.invite_url)}
                        >
                          Copy Link
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                          onClick={() => handleRevoke(row.id)}
                        >
                          Revoke
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div
          onClick={closeCreate}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 'var(--space-4)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card-metal"
            style={{ padding: 'var(--space-6)', maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-4)' }}>
              Send New <span style={{ color: 'var(--teal)' }}>Invitation</span>
            </h2>

            {lastCreated ? (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>
                  Invite Created. Share The Link Below With The Invitee. Email Notifications Are Disabled - Copy And Send Manually.
                </p>
                <div style={{ padding: 'var(--space-3)', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', wordBreak: 'break-all', fontSize: '0.78rem', color: 'var(--teal)', textTransform: 'none' as const }}>
                  {lastCreated.invite_url}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => copyLink(lastCreated.invite_url)}
                  >
                    Copy Link
                  </button>
                  <button type="button" className="btn btn-primary" onClick={closeCreate}>
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ textTransform: 'none' as const }}
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label style={labelStyle}>Full Name (Optional)</label>
                  <input
                    type="text"
                    className="input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                {showRoleSelector && (
                  <div>
                    <label style={labelStyle}>Role</label>
                    <select
                      className="input"
                      value={role}
                      onChange={(e) => setRole(e.target.value as 'agent' | 'super_agent')}
                    >
                      <option value="agent">Agent</option>
                      <option value="super_agent">Super Agent</option>
                    </select>
                  </div>
                )}

                {role === 'agent' && (
                  <div>
                    <label style={labelStyle}>Pricing Tier</label>
                    <select
                      className="input"
                      value={tier}
                      onChange={(e) => setTier(e.target.value)}
                    >
                      <option value="tier_1">Tier 1 (Best Pricing)</option>
                      <option value="tier_2">Tier 2 (Standard)</option>
                      <option value="tier_3">Tier 3 (Entry)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Account Type</label>
                  <select
                    className="input"
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                  >
                    <option value="prepaid">Prepaid</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>

                {accountType === 'credit' && (
                  <div>
                    <label style={labelStyle}>Credit Limit ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(e.target.value)}
                      placeholder="2500"
                    />
                  </div>
                )}

                {accountType === 'prepaid' && (
                  <div>
                    <label style={labelStyle}>Starting Prepaid Balance ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      value={prepaidBalance}
                      onChange={(e) => setPrepaidBalance(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                )}

                {formError && (
                  <div style={{ padding: 'var(--space-3)', background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.35)', borderRadius: 'var(--radius-md)', color: 'var(--red)', fontSize: '0.82rem' }}>
                    {formError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-ghost" onClick={closeCreate}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create Invite'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: 'var(--space-3) var(--space-4)',
  textAlign: 'left',
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--grey-400)',
  fontWeight: 700,
};
const td: React.CSSProperties = {
  padding: 'var(--space-3) var(--space-4)',
  fontSize: '0.85rem',
  color: 'var(--silver)',
};
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.74rem',
  color: 'var(--grey-400)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 4,
};
