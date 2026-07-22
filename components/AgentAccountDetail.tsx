'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { freshDefaultLadder } from '@/lib/gamification';
import AgentFreezeToggle from '@/components/AgentFreezeToggle';
import AdminTierOverrideControl from '@/components/AdminTierOverrideControl';
import ViewAsButton from '@/components/ViewAsButton';
import { createClient } from '@/lib/supabase/client';

/**
 * AgentAccountDetail - full management drawer for a single downline FULL agent.
 *
 * Opened from AgentDownline ("My Agent Accounts") when a Super Agent clicks an
 * agent name. Lets the Super Agent:
 *   - Edit First/Last Name + Storefront Display Name
 *   - Switch Payment Model (Prepaid / Credit Line) and set the Credit Limit
 *   - Choose the Markup Structure: Fixed Markup or Gamification Scale
 *     (FULL AGENTS ONLY - super-agents use the Tier 1/2/3 multiplier)
 *   - Activate / Deactivate the account (also toggles the storefront)
 *   - Freeze / Unfreeze transactions (Invoice v2 - login keeps working,
 *     order approval refuses; cascades down the chain)
 *   - Give Wallet Credit (adds to prepaid balance, recorded in the ledger)
 *   - Review Sales History + the Wallet Ledger
 *
 * All writes go through /api/agent/agents/[id] (PATCH) and
 * /api/agent/agents/[id]/credit (POST), which enforce downline ownership.
 */

type Detail = {
  agent: {
    id: string;
    full_name: string | null;
    role: string | null;
    is_super_agent?: boolean;
    username: string | null;
    email: string | null;
    phone: string | null;
    account_type: 'credit' | 'prepaid' | string | null;
    credit_limit: number | null;
    max_auto_approve_limit: number | null;
    prepaid_balance: number;
    commission_pct: number | null;
    commission_max_pct: number | null;
    velocity_cap: number | null;
    commission_ladder_config?: any[];
    commission_active_since: string | null;
    is_active: boolean;
    is_sub_agent?: boolean;
    // Present when this account is a parented downline (non-sub-agent).
    // Chain-aware pricing means ITS cost is commission_pct compounded on its
    // parent's cost - the Global Pricing Override (house tier / flat
    // custom_markup_override) below only applies to a TOP-LEVEL account.
    parent_agent_id?: string | null;
    // Invoice v2 - freeze state surfaced on the detail row so the panel
    // shows the current toggle position without a separate request.
    is_transactions_frozen?: boolean;
    frozen_at?: string | null;
    frozen_reason?: string | null;
    created_at: string;
    last_sign_in_at?: string | null;
    first_sign_in_at?: string | null;
    sign_in_count?: number;
  };
  storefront: { slug: string | null; display_name: string | null; is_active: boolean } | null;
  ledger: Array<{ id: string; type: string; amount: number; balance_after: number | null; description: string | null; created_at: string }>;
  sales: {
    ordersCount: number;
    nonCancelledCount: number;
    grossTotal: number;
    last30Total: number;
    recent: Array<{ id: string; status: string; total: number; created_at: string; buyer_name: string | null; payment_method: string | null }>;
  };
  sub_agents: Array<{
    id: string;
    full_name: string | null;
    username: string | null;
    email: string | null;
    is_active: boolean;
    commission_pct: number | null;
    created_at: string;
    provisioned_password?: string | null;
  }>;
  downline_agents?: Array<{
    id: string;
    full_name: string | null;
    username: string | null;
    email: string | null;
    is_active: boolean;
    is_super_agent?: boolean;
    commission_pct: number | null;
    created_at: string;
  }>;
  researchers: Array<{
    id: string;
    full_name: string | null;
    username: string | null;
    email: string | null;
    is_active: boolean;
    created_at: string;
    provisioned_password?: string | null;
  }>;
};

const fmtMoney = (v: number | null | undefined) => `$${(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n: number) => `${Number.isInteger(n) ? n : Number(n.toFixed(1))}%`;
const fmtDate = (s: string | null | undefined) => {
  if (!s) return '-';
  try { return new Date(s).toLocaleDateString(); } catch { return String(s); }
};
const fmtLastSignIn = (s: string | null | undefined) => {
  if (!s) return 'Never Logged In';
  try {
    return new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return 'Never Logged In'; }
};
const titleCaseStatus = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const MAX_CAP_LIMIT = 40;

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 6, color: 'var(--grey-300)', fontSize: '0.8rem', fontWeight: 600,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  background: 'var(--bg-metal-dark)', fontSize: 16,
  border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: 6,
};

export default function AgentAccountDetail({
  agentId,
  agentName,
  onClose,
  onChanged,
  onViewDownline,
}: {
  agentId: string;
  agentName: string;
  onClose: () => void;
  onChanged: () => void;
  onViewDownline?: (agent: any) => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  // PLATFORM RULE: super agents may ONLY promote researchers in their own
  // downline to full Agent. Granting or revoking SUPER agent status is an
  // admin-only action (the API already rejects non-admins), so the Make
  // Super button must only render for admin viewers.
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      setViewerIsAdmin(data?.role === 'admin');
    });
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [accountType, setAccountType] = useState<'credit' | 'prepaid'>('prepaid');
  const [creditLimit, setCreditLimit] = useState('');
  const [maxAutoApproveLimit, setMaxAutoApproveLimit] = useState('');
  const [commissionPct, setCommissionPct] = useState('');
  const [commissionMode, setCommissionMode] = useState<'fixed' | 'gamified'>('fixed');
  const [customSteps, setCustomSteps] = useState(freshDefaultLadder());
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<'Overview' | 'Downline Agents' | 'Sub Agents' | 'Researchers'>('Overview');

  // Password management for sub-agents and researchers in this drawer
  const [revealedDownlinePasswords, setRevealedDownlinePasswords] = useState<Set<string>>(new Set());
  const toggleRevealDownlinePassword = (id: string) => {
    setRevealedDownlinePasswords(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };
  const [downlinePasswordAgent, setDownlinePasswordAgent] = useState<{ id: string; full_name: string | null; username: string | null } | null>(null);
  const [downlineNewPassword, setDownlineNewPassword] = useState('');
  const [downlinePasswordSaving, setDownlinePasswordSaving] = useState(false);

  const handleDownlinePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!downlinePasswordAgent || !downlineNewPassword) return;
    setDownlinePasswordSaving(true);
    try {
      const res = await fetch('/api/agent/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: downlinePasswordAgent.id, newPassword: downlineNewPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Password Updated Successfully');
      setDownlinePasswordAgent(null);
      setDownlineNewPassword('');
      load(); // Refresh so the new provisioned_password is shown
    } catch (err: any) {
      toast.error(err.message || 'Failed To Update Password');
    } finally {
      setDownlinePasswordSaving(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent/agents/${agentId}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Load Agent.');
      const d = json as Detail;
      setDetail(d);
      const _fn = (d.agent.full_name || '').trim();
      const _parts = _fn.split(/\s+/);
      setFirstName(_parts[0] || '');
      setLastName(_parts.slice(1).join(' ') || '');
      setEmail(d.agent.email || '');
      setPhone(d.agent.phone || '');
      setDisplayName(d.storefront?.display_name || '');
      setSlug(d.storefront?.slug || '');
      setAccountType(d.agent.account_type === 'credit' ? 'credit' : 'prepaid');
      setCreditLimit(d.agent.credit_limit != null ? String(d.agent.credit_limit) : '');
      setMaxAutoApproveLimit(d.agent.max_auto_approve_limit != null ? String(d.agent.max_auto_approve_limit) : '');
      setCommissionPct(d.agent.commission_pct != null ? String(d.agent.commission_pct) : '');
      const basePct = d.agent.commission_pct == null ? 0 : Number(d.agent.commission_pct);
      const capPct = d.agent.commission_max_pct;
      setCommissionMode(capPct != null && Number(capPct) > basePct ? 'gamified' : 'fixed');

      const hasCustomSteps = Array.isArray(d.agent.commission_ladder_config) && d.agent.commission_ladder_config.length > 0;
      if (hasCustomSteps) {
        const defaultNames = ['Premium', 'Pro', 'Rookie'];
        const mappedSteps = d.agent.commission_ladder_config!.map((s, idx) => ({
          level: idx + 1,
          name: defaultNames[idx] || `Level ${idx + 1}`,
          min_volume: Number(s.min_volume) || 0,
          bonus_pct: (Number(s.bonus_pct) || 0) + basePct,
        }));
        while (mappedSteps.length < 3) {
          const idx = mappedSteps.length;
          mappedSteps.push({ level: idx + 1, name: defaultNames[idx] || `Level ${idx + 1}`, min_volume: 0, bonus_pct: 0 });
        }
        const finalSteps = mappedSteps.slice(0, 3);
        setCustomSteps(finalSteps);
      } else {
        setCustomSteps(freshDefaultLadder());
      }

      setIsActive(!!d.agent.is_active);
    } catch (err: any) {
      setError(err.message || 'Failed To Load Agent.');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

  const isSubAgent = detail?.agent?.is_sub_agent === true;

  async function saveChanges() {
    setSaving(true);
    try {
      // Markup (commission_pct) is editable below for parented full agents and
      // is added to the payload further down, but ONLY when a value is present,
      // so an unrelated edit (e.g. fixing a phone number) can never clobber an
      // unset (50% default) markup by coercing an empty input to 0.
      const payload: Record<string, any> = {
        full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        email,
        phone,
        account_type: accountType,
        is_active: isActive,
        display_name: isSubAgent ? undefined : (displayName || undefined),
        slug: isSubAgent ? undefined : (slug || undefined),
      };
      if (accountType === 'credit') {
        payload.credit_limit = creditLimit === '' ? 0 : Number(creditLimit);
        payload.max_auto_approve_limit = maxAutoApproveLimit === '' ? null : Number(maxAutoApproveLimit);
      }

      // Fixed markup for a parented full agent: persist the % the admin/super
      // entered. Sending commission_max_pct === commission_pct puts the agent on
      // a FLAT fixed markup (the volume ladder is fully neutralized). Only sent
      // for parented non-sub-agents, and only when a value is present, so an
      // unrelated edit never overwrites an unset (50% default) markup.
      if (!isSubAgent && detail?.agent?.parent_agent_id && commissionPct.trim() !== '') {
        const pct = Number(commissionPct);
        if (Number.isFinite(pct) && pct >= 0 && pct <= 200) {
          payload.commission_pct = pct;
          payload.commission_max_pct = pct;
        }
      }

      const res = await fetch(`/api/agent/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Save.');
      toast.success('Agent Updated.');
      await load();
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed To Save.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActiveQuick(next: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/agent/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Update.');
      setIsActive(next);
      toast.success(next ? 'Account Activated.' : 'Account Deactivated.');
      await load();
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed To Update.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
        zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: 'var(--space-4)', overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel"
        style={{ width: '100%', maxWidth: 760, margin: 'var(--space-6) 0' }}
      >
        <div className="" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
            <div>
              <h2 className="metal-text" style={{ fontSize: '1.4rem', fontFamily: 'var(--font-brand)', margin: 0 }}>
                {detail?.agent.full_name || agentName}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {detail && detail.agent.is_super_agent && onViewDownline && (
                <button onClick={() => onViewDownline(detail.agent)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                  View Downline
                </button>
              )}
              {detail && viewerIsAdmin && (
                <button 
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/admin/agents/super-upgrade', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ agentId: detail.agent.id, is_super_agent: !detail.agent.is_super_agent })
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error);
                      toast.success(detail.agent.is_super_agent ? 'Super Agent Status Revoked' : 'Promoted To Super Agent');
                      load();
                      onChanged();
                    } catch (err: any) {
                      toast.error(err.message || 'Failed To Update Super Agent Status');
                    }
                  }}
                  className="btn-silver" style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  disabled={detail.agent.is_sub_agent}
                >
                  {detail.agent.is_super_agent ? 'Revoke Super' : 'Make Super'}
                </button>
              )}
              {detail && (
                <ViewAsButton
                  targetUserId={detail.agent.id}
                  targetLabel={detail.agent.full_name ?? detail.agent.email ?? 'Agent'}
                />
              )}
              <button type="button" className="btn-silver" onClick={onClose} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Close</button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--silver)' }}>Loading Agent...</div>
          ) : error ? (
            <div style={{ padding: 'var(--space-6)', color: 'var(--red)' }}>Error: {error}</div>
          ) : detail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

              <div style={{ display: 'flex', gap: 'var(--space-4)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'var(--space-2)' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('Overview')}
                  style={{
                    background: 'none', border: 'none', padding: '0 0 8px 0', cursor: 'pointer',
                    fontSize: '1rem', fontWeight: 700,
                    color: activeTab === 'Overview' ? '#00C4BC' : 'var(--grey-400)',
                    borderBottom: activeTab === 'Overview' ? '2px solid #00C4BC' : '2px solid transparent',
                    textTransform: 'uppercase', letterSpacing: '0.05em'
                  }}
                >
                  Overview
                </button>
                {!isSubAgent && (detail.agent.is_super_agent === true || (detail.downline_agents?.length ?? 0) > 0) && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('Downline Agents')}
                    style={{
                      background: 'none', border: 'none', padding: '0 0 8px 0', cursor: 'pointer',
                      fontSize: '1rem', fontWeight: 700,
                      color: activeTab === 'Downline Agents' ? '#00C4BC' : 'var(--grey-400)',
                      borderBottom: activeTab === 'Downline Agents' ? '2px solid #00C4BC' : '2px solid transparent',
                      textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}
                  >
                    Downline Agents ({detail.downline_agents?.length || 0})
                  </button>
                )}
                {!isSubAgent && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('Sub Agents')}
                    style={{
                      background: 'none', border: 'none', padding: '0 0 8px 0', cursor: 'pointer',
                      fontSize: '1rem', fontWeight: 700,
                      color: activeTab === 'Sub Agents' ? '#00C4BC' : 'var(--grey-400)',
                      borderBottom: activeTab === 'Sub Agents' ? '2px solid #00C4BC' : '2px solid transparent',
                      textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}
                  >
                    Sub Agents ({detail.sub_agents?.length || 0})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('Researchers')}
                  style={{
                    background: 'none', border: 'none', padding: '0 0 8px 0', cursor: 'pointer',
                    fontSize: '1rem', fontWeight: 700,
                    color: activeTab === 'Researchers' ? '#00C4BC' : 'var(--grey-400)',
                    borderBottom: activeTab === 'Researchers' ? '2px solid #00C4BC' : '2px solid transparent',
                    textTransform: 'uppercase', letterSpacing: '0.05em'
                  }}
                >
                  Researchers ({detail.researchers?.length || 0})
                </button>
              </div>

              {activeTab === 'Overview' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-3)' }}>
                    <Stat label="Status" value={isActive ? 'Active' : 'Inactive'} color={isActive ? '#2DD4BF' : '#F87171'} />
                    <Stat label="Last Logged In" value={fmtLastSignIn(detail.agent.last_sign_in_at)} color={detail.agent.last_sign_in_at ? 'var(--silver)' : 'var(--grey-500)'} />
                    <Stat label="Wallet Balance" value={detail.agent.account_type === 'credit' ? fmtMoney(detail.agent.credit_limit) : fmtMoney(detail.agent.prepaid_balance)} color="var(--teal)" />
                    <Stat label="Lifetime Sales" value={fmtMoney(detail.sales.grossTotal)} />
                    <Stat label="Last 30 Days" value={fmtMoney(detail.sales.last30Total)} />
                    <Stat label="Orders" value={String(detail.sales.nonCancelledCount)} />
                  </div>

                  {/* Edit form */}
                  <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <h3 className="metal-text" style={{ fontSize: '1rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {isSubAgent ? 'Edit Sub-Agent' : 'Edit Agent'}
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                      <div>
                        <label style={labelStyle}>First Name</label>
                        <input style={inputStyle} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                      </div>
                      <div>
                        <label style={labelStyle}>Last Name</label>
                        <input style={inputStyle} value={lastName} onChange={(e) => setLastName(e.target.value)} />
                      </div>
                      <div>
                        <label style={labelStyle}>Email Address</label>
                        <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="" />
                      </div>
                      <div>
                        <label style={labelStyle}>Phone Number</label>
                        <input style={inputStyle} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="" />
                      </div>
                      {!(detail?.agent.is_sub_agent === true) && (
                        <>
                          <div>
                            <label style={labelStyle}>Storefront Name</label>
                            <input style={inputStyle} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="User Name" />
                          </div>
                          <div>
                            <label style={labelStyle}>URL Slug</label>
                            <input style={inputStyle} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, ''))} placeholder="e.g. john-store" />
                          </div>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                      <div>
                        <label style={labelStyle}>Payment Model</label>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                          <label style={{ flex: 1, ...inputStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderColor: accountType === 'prepaid' ? 'var(--teal)' : 'rgba(0,0,0,0.8)' }}>
                            <input type="radio" checked={accountType === 'prepaid'} onChange={() => setAccountType('prepaid')} /> Prepaid
                          </label>
                          <label style={{ flex: 1, ...inputStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderColor: accountType === 'credit' ? 'var(--teal)' : 'rgba(0,0,0,0.8)' }}>
                            <input type="radio" checked={accountType === 'credit'} onChange={() => setAccountType('credit')} /> Credit Line
                          </label>
                        </div>
                      </div>
                      {accountType === 'credit' && (
                        <>
                          <div>
                            <label style={labelStyle}>Credit Limit ($)</label>
                            <input style={inputStyle} type="number" min="0" step="0.01" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="0.00" />
                          </div>
                          <div>
                            <label style={labelStyle}>Max Auto-Approve Limit ($)</label>
                            <input style={inputStyle} type="number" min="0" step="0.01" value={maxAutoApproveLimit} onChange={(e) => setMaxAutoApproveLimit(e.target.value)} placeholder="Unlimited" />
                          </div>
                        </>
                      )}
                    </div>

                    <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                      {!isSubAgent && detail.agent.parent_agent_id ? (
                        // Chain-aware pricing (2026-07-21, editable 2026-07-22):
                        // a parented account's real cost is commission_pct, a
                        // FIXED markup over its super's cost. It is editable here;
                        // saving sends commission_max_pct === commission_pct so the
                        // agent stays on a flat fixed markup (no volume ladder).
                        <>
                          <label style={{ ...labelStyle, marginBottom: 8, display: 'block' }}>Agent Markup % (Over Your Cost)</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              style={{ ...inputStyle, width: 120 }}
                              type="number"
                              min="0"
                              max="200"
                              step="1"
                              value={commissionPct}
                              onChange={(e) => setCommissionPct(e.target.value.replace(/[^0-9.]/g, ''))}
                              placeholder="50"
                            />
                            <span style={{ fontSize: '0.85rem', color: 'var(--silver)' }}>% Markup</span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginTop: 6 }}>
                            This Agent Pays Your Cost Plus This Fixed Markup. Leave Blank For The 50% Default.
                          </div>
                        </>
                      ) : (
                        <>
                          <label style={{ ...labelStyle, marginBottom: 8, display: 'block' }}>Global Pricing Override</label>
                          <AdminTierOverrideControl agentId={agentId} />
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                      <button type="button" className="btn-neon-cyan" disabled={saving} onClick={saveChanges}>
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>

                  {/* Sales history */}
                  <div className="glass-panel">
                    <h3 className="metal-text" style={{ fontSize: '1rem', margin: '0 0 var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Sales</h3>
                    {detail.sales.recent.length === 0 ? (
                      <div style={{ color: 'var(--grey-400)', fontSize: '0.85rem', padding: 'var(--space-3) 0' }}>No Orders Yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {detail.sales.recent.map((o) => (
                          <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', gap: 8 }}>
                            <span style={{ color: 'var(--silver)', fontFamily: 'monospace' }}>#{o.id.slice(0, 8).toUpperCase()}</span>
                            <span style={{ color: 'var(--grey-400)', flex: 1, textAlign: 'center' }}>{o.buyer_name || '-'}</span>
                            <span style={{ color: 'var(--grey-400)' }}>{fmtDate(o.created_at)}</span>
                            <span style={{ color: o.status === 'cancelled' ? 'var(--grey-500)' : 'var(--teal)', minWidth: 70, textAlign: 'right' }}>{titleCaseStatus(o.status)}</span>
                            <span style={{ color: 'var(--white)', fontWeight: 700, minWidth: 70, textAlign: 'right' }}>{fmtMoney(o.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Wallet ledger */}
                  <div className="glass-panel">
                    <h3 className="metal-text" style={{ fontSize: '1rem', margin: '0 0 var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wallet Ledger</h3>
                    {detail.ledger.length === 0 ? (
                      <div style={{ color: 'var(--grey-400)', fontSize: '0.85rem', padding: 'var(--space-3) 0' }}>No Wallet Transactions Yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {detail.ledger.map((t) => (
                          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', gap: 8 }}>
                            <span style={{ color: 'var(--silver)', flex: 1 }}>{t.description || titleCaseStatus(t.type)}</span>
                            <span style={{ color: 'var(--grey-400)' }}>{fmtDate(t.created_at)}</span>
                            <span style={{ color: t.amount < 0 ? '#F87171' : '#2DD4BF', fontWeight: 700, minWidth: 80, textAlign: 'right' }}>
                              {t.amount < 0 ? '-' : '+'}{fmtMoney(Math.abs(t.amount))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Account Access + Transactions (Invoice v2) */}
                  <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--white)' }}>Account Access</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)' }}>
                          Deactivating Blocks Login And Takes The Storefront Offline.
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ color: isActive ? '#2DD4BF' : 'var(--grey-400)', fontWeight: 600, fontSize: '0.9rem' }}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                        <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                          <input
                            type="checkbox"
                            style={{ opacity: 0, width: 0, height: 0 }}
                            checked={isActive}
                            disabled={saving}
                            onChange={(e) => {
                              const next = e.target.checked;
                              if (!next) {
                                if (window.confirm("Are You Sure You Want To Deactivate This Account?")) {
                                  toggleActiveQuick(false);
                                }
                              } else {
                                toggleActiveQuick(true);
                              }
                            }}
                          />
                          <span style={{
                            position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: isActive ? '#2DD4BF' : 'var(--grey-500)',
                            transition: '.4s', borderRadius: 24,
                          }}>
                            <span style={{
                              position: 'absolute', content: '""', height: 18, width: 18, left: 3, bottom: 3,
                              backgroundColor: 'var(--bg-metal-dark)', transition: '.4s', borderRadius: '50%',
                              transform: isActive ? 'translateX(20px)' : 'translateX(0)'
                            }}></span>
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Invoice v2 - Transactions Freeze (separate from full account deactivation).
                        Frozen accounts can still log in and view; order approval refuses for
                        them AND their downline. */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 'var(--space-4)' }}>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontWeight: 700, color: 'var(--white)' }}>Transactions</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)' }}>
                          Freezing Stops Order Approval For This Account And Their Entire Downline. Login And Browsing Stay Active.
                        </div>
                      </div>
                      <AgentFreezeToggle
                        targetId={agentId}
                        targetName={detail.agent.full_name || agentName}
                        initiallyFrozen={detail.agent.is_transactions_frozen === true}
                        initialReason={detail.agent.frozen_reason || null}
                        onChanged={() => { load(); onChanged(); }}
                      />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'Downline Agents' && (
                <div className="glass-panel">
                  <h3 className="metal-text" style={{ fontSize: '1rem', margin: '0 0 var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Downline Agents</h3>
                  {!detail.downline_agents || detail.downline_agents.length === 0 ? (
                    <div style={{ color: 'var(--grey-400)', fontSize: '0.85rem', padding: 'var(--space-3) 0' }}>No Downline Agents Yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {detail.downline_agents.map((a) => (
                        <div key={a.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, gap: 12 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 160px' }}>
                            <span style={{ color: 'var(--white)', fontWeight: 700 }}>
                              {a.full_name || a.username || 'Anonymous'}
                              {a.is_super_agent && <span style={{ marginLeft: 6, fontSize: '0.66rem', color: 'var(--teal)', border: '1px solid var(--teal)', borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Super</span>}
                            </span>
                            <span style={{ color: a.is_active ? '#2DD4BF' : '#F87171', fontSize: '0.75rem' }}>{a.is_active ? 'Active' : 'Inactive'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 140px' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--grey-500)', minWidth: 52 }}>Username</span>
                            <span style={{ fontFamily: 'monospace', color: 'var(--teal)', fontWeight: 700, fontSize: '0.82rem' }}>{a.username || '-'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {/* NULL means the 50% platform default, not 0 -- match the Overview
                                Pricing block's own copy so this list doesn't understate the
                                assigned markup for accounts left on the default. */}
                            <span style={{ color: '#00C4BC', fontWeight: 700, fontSize: '0.82rem' }}>{a.commission_pct != null ? fmtPct(Number(a.commission_pct)) : '50% (Default)'} Markup</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'Sub Agents' && (
                <div className="glass-panel">
                  <h3 className="metal-text" style={{ fontSize: '1rem', margin: '0 0 var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sub Agents</h3>
                  {!detail.sub_agents || detail.sub_agents.length === 0 ? (
                    <div style={{ color: 'var(--grey-400)', fontSize: '0.85rem', padding: 'var(--space-3) 0' }}>No Sub Agents Yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {detail.sub_agents.map((sa) => (
                        <div key={sa.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, gap: 12 }}>
                          {/* Name & Status */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 140px' }}>
                            <span style={{ color: 'var(--white)', fontWeight: 700 }}>{sa.full_name || sa.username || 'Anonymous'}</span>
                            <span style={{ color: sa.is_active ? '#2DD4BF' : '#F87171', fontSize: '0.75rem' }}>{sa.is_active ? 'Active' : 'Inactive'}</span>
                          </div>
                          {/* Credentials */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: '0.68rem', color: 'var(--grey-500)', minWidth: 52 }}>Username</span>
                              <span style={{ fontFamily: 'monospace', color: 'var(--teal)', fontWeight: 700, fontSize: '0.82rem' }}>{sa.username || '-'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: '0.68rem', color: 'var(--grey-500)', minWidth: 52 }}>Password</span>
                              {sa.provisioned_password ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: revealedDownlinePasswords.has(sa.id) ? '#00C4BC' : 'var(--silver)', letterSpacing: revealedDownlinePasswords.has(sa.id) ? 'normal' : '0.1em' }}>
                                    {revealedDownlinePasswords.has(sa.id) ? sa.provisioned_password : '••••••••'}
                                  </span>
                                  <button onClick={() => toggleRevealDownlinePassword(sa.id)} title={revealedDownlinePasswords.has(sa.id) ? 'Hide' : 'Reveal'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px 3px', color: revealedDownlinePasswords.has(sa.id) ? 'var(--teal)' : 'var(--grey-500)', lineHeight: 1 }}>
                                    {revealedDownlinePasswords.has(sa.id) ? (
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                    ) : (
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.78rem', color: 'var(--grey-500)', fontStyle: 'italic' }}>Not set by admin</span>
                              )}
                            </div>
                          </div>
                          {/* Commission & Edit */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: '#00C4BC', fontWeight: 700, fontSize: '0.82rem' }}>{sa.commission_pct ?? 0}%</span>
                            <button
                              onClick={() => { setDownlinePasswordAgent({ id: sa.id, full_name: sa.full_name, username: sa.username }); setDownlineNewPassword(''); }}
                              style={{ fontSize: '0.7rem', color: 'var(--teal)', background: 'none', border: '1px solid rgba(0,196,188,0.25)', borderRadius: 4, cursor: 'pointer', padding: '3px 8px' }}
                            >
                              Edit Password
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'Researchers' && (
                <div className="glass-panel">
                  <h3 className="metal-text" style={{ fontSize: '1rem', margin: '0 0 var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Researchers</h3>
                  {!detail.researchers || detail.researchers.length === 0 ? (
                    <div style={{ color: 'var(--grey-400)', fontSize: '0.85rem', padding: 'var(--space-3) 0' }}>No Researchers Yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {detail.researchers.map((r) => (
                        <div key={r.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, gap: 12 }}>
                          {/* Name & Status */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 140px' }}>
                            <span style={{ color: 'var(--white)', fontWeight: 700 }}>{r.full_name || r.username || 'Anonymous'}</span>
                            <span style={{ color: r.is_active ? '#2DD4BF' : '#F87171', fontSize: '0.75rem' }}>{r.is_active ? 'Active' : 'Inactive'}</span>
                          </div>
                          {/* Credentials */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: '0.68rem', color: 'var(--grey-500)', minWidth: 52 }}>Username</span>
                              <span style={{ fontFamily: 'monospace', color: 'var(--teal)', fontWeight: 700, fontSize: '0.82rem' }}>{r.username || '-'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: '0.68rem', color: 'var(--grey-500)', minWidth: 52 }}>Password</span>
                              {r.provisioned_password ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: revealedDownlinePasswords.has(r.id) ? '#00C4BC' : 'var(--silver)', letterSpacing: revealedDownlinePasswords.has(r.id) ? 'normal' : '0.1em' }}>
                                    {revealedDownlinePasswords.has(r.id) ? r.provisioned_password : '••••••••'}
                                  </span>
                                  <button onClick={() => toggleRevealDownlinePassword(r.id)} title={revealedDownlinePasswords.has(r.id) ? 'Hide' : 'Reveal'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px 3px', color: revealedDownlinePasswords.has(r.id) ? 'var(--teal)' : 'var(--grey-500)', lineHeight: 1 }}>
                                    {revealedDownlinePasswords.has(r.id) ? (
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                    ) : (
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.78rem', color: 'var(--grey-500)', fontStyle: 'italic' }}>Not set by admin</span>
                              )}
                            </div>
                          </div>
                          {/* Edit Password */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              onClick={() => { setDownlinePasswordAgent({ id: r.id, full_name: r.full_name, username: r.username }); setDownlineNewPassword(''); }}
                              style={{ fontSize: '0.7rem', color: 'var(--teal)', background: 'none', border: '1px solid rgba(0,196,188,0.25)', borderRadius: 4, cursor: 'pointer', padding: '3px 8px' }}
                            >
                              Edit Password
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          ) : null}
        </div>
      </div>
    </div>

      {/* Edit Password Modal -- Sub-Agents & Researchers */}
      {downlinePasswordAgent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 400 }}>
            <div style={{ padding: 'var(--space-6)' }}>
              <h3 className="metal-text" style={{ marginTop: 0, marginBottom: 'var(--space-4)', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Edit Password</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginBottom: 'var(--space-2)' }}>
                Account: <strong style={{ color: '#fff' }}>{downlinePasswordAgent.full_name || downlinePasswordAgent.username}</strong>
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)' }}>
                Username: <strong style={{ color: '#00C4BC', fontFamily: 'monospace' }}>{downlinePasswordAgent.username}</strong>
              </p>
              <form onSubmit={handleDownlinePasswordUpdate}>
                <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                  <label className="form-label">New Password</label>
                  <input
                    type="text"
                    className="form-input"
                    value={downlineNewPassword}
                    onChange={e => setDownlineNewPassword(e.target.value)}
                    placeholder="Minimum 8 Characters"
                    required
                    minLength={8}
                    autoComplete="off"
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-silver" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => { setDownlinePasswordAgent(null); setDownlineNewPassword(''); }} disabled={downlinePasswordSaving}>Cancel</button>
                  <button type="submit" className="btn-neon-cyan" style={{ padding: '4px 12px', fontSize: '0.8rem' }} disabled={downlinePasswordSaving || downlineNewPassword.length < 8}>
                    {downlinePasswordSaving ? 'Saving...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: color || 'var(--white)', marginTop: 4 }}>{value}</div>
    </div>
  );
}
