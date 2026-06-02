'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { freshDefaultLadder, isDefaultLadder } from '@/lib/gamification';

/**
 * AgentAccountDetail — full management drawer for a single downline FULL agent.
 *
 * Opened from AgentDownline ("My Agent Accounts") when a Super Agent clicks an
 * agent name. Lets the Super Agent:
 *   - Edit First/Last Name + Storefront Display Name
 *   - Switch Payment Model (Prepaid / Credit Line) and set the Credit Limit
 *   - Choose the Markup Structure: Fixed Markup or Gamification Scale
 *     (FULL AGENTS ONLY — super-agents use the Tier 1/2/3 multiplier)
 *   - Activate / Deactivate the account (also toggles the storefront)
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
    // R32: backend already returns role on /api/agent/agents/[id]; expose it
    // here so the drawer can gate role-specific UI (e.g. super_agents do not
    // see Markup Structure — they use Tier 1/2/3 multipliers).
    role: string | null;
    // R33: super_agents store role='agent' with is_super_agent=true. The R32
    // gate `role === 'agent'` alone couldn't distinguish them from regular
    // agents, so super_agents were still seeing the Markup ladder. Carry the
    // flag from the API response so the UI gate can exclude them.
    is_super_agent?: boolean;
    username: string | null;
    email: string | null;
    phone: string | null;
    account_type: 'credit' | 'prepaid' | string | null;
    credit_limit: number | null;
    prepaid_balance: number;
    commission_pct: number | null;
    commission_max_pct: number | null;
    velocity_cap: number | null;
    commission_ladder_config?: any[];
    commission_active_since: string | null;
    is_active: boolean;
    is_sub_agent?: boolean;
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
  }>;
};

const fmtMoney = (v: number | null | undefined) => `$${(Number(v) || 0).toFixed(2)}`;
const fmtMoney0 = (v: number | null | undefined) => `$${Math.round(Number(v) || 0).toLocaleString()}`;
const fmtPct = (n: number) => `${Number.isInteger(n) ? n : Number(n.toFixed(1))}%`;
const fmtDate = (s: string | null | undefined) => {
  if (!s) return '—';
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

// Hard ceiling on the gamification Max Cap (platform rule).
const MAX_CAP_LIMIT = 40;

// The 5-level gamification commission ladder. Mirrors the house default steps in
// fn_house_default_commission_steps(): Level 1 is the Base (under $2,500 monthly
// retail); each higher level adds its bonus once the agent crosses the threshold.
// Effective rate = min(Base + Bonus, Max Cap).
const COMMISSION_LEVELS: { level: number; name: string; min: number; max: number | null; bonus: number }[] = [
  { level: 1, name: 'Rookie',      min: 0,     max: 2499,  bonus: 0 },
  { level: 2, name: 'Established', min: 2500,  max: 7499,  bonus: 3 },
  { level: 3, name: 'Pro',         min: 7500,  max: 19999, bonus: 7 },
  { level: 4, name: 'Elite',       min: 20000, max: 49999, bonus: 12 },
  { level: 5, name: 'Apex',        min: 50000, max: null,  bonus: 20 },
];

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 6, color: 'var(--grey-300)', fontSize: '0.8rem', fontWeight: 600,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  background: 'var(--bg-metal-dark)',
  border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: 6,
};

export default function AgentAccountDetail({
  agentId,
  agentName,
  onClose,
  onChanged,
}: {
  agentId: string;
  agentName: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  // R32: store first + last separately. On save we join them back into a
  // single full_name to keep the API/DB contract unchanged.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [accountType, setAccountType] = useState<'credit' | 'prepaid'>('prepaid');
  const [creditLimit, setCreditLimit] = useState('');
  const [commissionPct, setCommissionPct] = useState('');
  // Commission structure: 'fixed' = flat rate; 'gamified' = base climbs with
  // volume up to a max cap via the house milestone ladder.
  const [commissionMode, setCommissionMode] = useState<'fixed' | 'gamified'>('fixed');
  // Gamification scale: 'default' = the read-only house ladder (20% → 40%);
  // 'custom' = a fully adjustable 5-level ladder. The button the user opens IS
  // the selection. customSteps always holds the active ladder (Commission % per
  // level); for 'default' it equals the canonical default ladder.
  const [scaleType, setScaleType] = useState<'default' | 'custom'>('default');
  const [customSteps, setCustomSteps] = useState(freshDefaultLadder());
  // Opens the full-screen Gamification Scale explainer.
  const [showGamificationInfo, setShowGamificationInfo] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'Overview' | 'Sub Agents'>('Overview');

  // Give-credit form
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [crediting, setCrediting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent/agents/${agentId}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Load Agent.');
      const d = json as Detail;
      setDetail(d);
      // R32: parse single-string full_name into First + Last for the UI.
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
      setCommissionPct(d.agent.commission_pct != null ? String(d.agent.commission_pct) : '');
      // Derive the commission structure from the saved cap vs base. A cap above
      // the base means the milestone ladder is active (gamified); otherwise the
      // agent is on a flat rate (fixed).
      const basePct = d.agent.commission_pct == null ? 0 : Number(d.agent.commission_pct);
      const capPct = d.agent.commission_max_pct;
      setCommissionMode(capPct != null && Number(capPct) > basePct ? 'gamified' : 'fixed');

      const hasCustomSteps = Array.isArray(d.agent.commission_ladder_config) && d.agent.commission_ladder_config.length > 0;
      if (hasCustomSteps) {
        // Stored ladder holds bonus-over-base; rebuild the absolute Commission %
        // per level (= stored bonus + base) that the table displays.
        const defaultNames = ['Rookie', 'Established', 'Pro', 'Elite', 'Apex'];
        const mappedSteps = d.agent.commission_ladder_config!.map((s, idx) => ({
          level: idx + 1,
          name: defaultNames[idx] || `Level ${idx + 1}`,
          min_volume: Number(s.min_volume) || 0,
          bonus_pct: (Number(s.bonus_pct) || 0) + basePct,
        }));
        while (mappedSteps.length < 5) {
          const idx = mappedSteps.length;
          mappedSteps.push({ level: idx + 1, name: defaultNames[idx] || `Level ${idx + 1}`, min_volume: 0, bonus_pct: 0 });
        }
        const finalSteps = mappedSteps.slice(0, 5);
        setCustomSteps(finalSteps);
        // A saved ladder identical to the house default shows as Default
        // (read-only); anything else is a Custom scale.
        setScaleType(isDefaultLadder(finalSteps) ? 'default' : 'custom');
      } else {
        // No saved ladder → start on the read-only house Default scale.
        setScaleType('default');
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
    // Platform rule: no gamification level may exceed 40%.
    if (commissionMode === 'gamified') {
      const over = customSteps.find(s => Number(s.bonus_pct) > MAX_CAP_LIMIT);
      if (over) {
        toast.error('Gamification Levels Cannot Exceed 40%.');
        return;
      }
    }
    setSaving(true);
    try {
      // Base markup = the entry (Rookie) level for a gamified ladder, or the flat
      // rate for fixed markup.
      const baseVal: number = commissionMode === 'gamified'
        ? (Number(customSteps[0].bonus_pct) || 0)
        : (commissionPct === '' ? 0 : Number(commissionPct));
      const payload: Record<string, any> = {
        full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        email,
        phone,
        account_type: accountType,
        commission_pct: baseVal,
        is_active: isActive,
        display_name: isSubAgent ? undefined : (displayName || undefined),
        slug: isSubAgent ? undefined : (slug || undefined),
      };
      if (commissionMode === 'fixed') {
        // Fixed percentage: cap == base forces a flat effective rate; no ladder.
        payload.commission_max_pct = baseVal;
        payload.velocity_cap = null;
        payload.custom_commission_scale = null;
      } else {
        // Gamification scale (Default or Custom): persist the concrete 5-level
        // ladder as bonus-over-base so the order-time engine and UI always agree.
        payload.commission_max_pct = Number(customSteps[customSteps.length - 1].bonus_pct);
        payload.velocity_cap = null;
        payload.custom_commission_scale = customSteps.map(s => ({
          min_volume: Number(s.min_volume) || 0,
          bonus_pct: Math.max(0, Number(s.bonus_pct) - baseVal),
        }));
      }
      if (accountType === 'credit') payload.credit_limit = creditLimit === '' ? 0 : creditLimit;

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

  async function giveCredit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(creditAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter A Credit Amount Greater Than $0.');
      return;
    }
    setCrediting(true);
    try {
      const res = await fetch(`/api/agent/agents/${agentId}/credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, note: creditNote }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Issue Credit.');
      toast.success(`Credited ${fmtMoney(json.amount)}. New Balance ${fmtMoney(json.newBalance)}.`);
      setCreditAmount('');
      setCreditNote('');
      await load();
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed To Issue Credit.');
    } finally {
      setCrediting(false);
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
        zIndex: 1200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: 'var(--space-4)', overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="metal-frame"
        style={{ width: '100%', maxWidth: 760, margin: 'var(--space-6) 0' }}
      >
        <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
            <div>
              <h2 className="metal-text" style={{ fontSize: '1.4rem', fontFamily: 'var(--font-brand)', margin: 0 }}>
                {detail?.agent.full_name || agentName}
              </h2>
              {/* Username and storefront removed to prevent redundant name display */}
            </div>
            <button type="button" className="btn-silver" onClick={onClose}>Close</button>
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
                    color: activeTab === 'Overview' ? '#00E5FF' : 'var(--grey-400)',
                    borderBottom: activeTab === 'Overview' ? '2px solid #00E5FF' : '2px solid transparent',
                    textTransform: 'uppercase', letterSpacing: '0.05em'
                  }}
                >
                  Overview
                </button>
                {!isSubAgent && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('Sub Agents')}
                    style={{
                      background: 'none', border: 'none', padding: '0 0 8px 0', cursor: 'pointer',
                      fontSize: '1rem', fontWeight: 700,
                      color: activeTab === 'Sub Agents' ? '#00E5FF' : 'var(--grey-400)',
                      borderBottom: activeTab === 'Sub Agents' ? '2px solid #00E5FF' : '2px solid transparent',
                      textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}
                  >
                    Sub Agents ({detail.sub_agents?.length || 0})
                  </button>
                )}
              </div>

              {activeTab === 'Overview' && (
                <>
                  {/* Snapshot stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-3)' }}>
                <Stat label="Status" value={isActive ? 'Active' : 'Inactive'} color={isActive ? '#00FF9D' : '#FFAAAA'} />
                <Stat label="Last Logged In" value={fmtLastSignIn(detail.agent.last_sign_in_at)} color={detail.agent.last_sign_in_at ? 'var(--silver)' : 'var(--grey-500)'} />
                <Stat label="Wallet Balance" value={detail.agent.account_type === 'credit' ? fmtMoney(detail.agent.credit_limit) : fmtMoney(detail.agent.prepaid_balance)} color="var(--teal)" />
                <Stat label="Lifetime Sales" value={fmtMoney(detail.sales.grossTotal)} />
                <Stat label="Last 30 Days" value={fmtMoney(detail.sales.last30Total)} />
                <Stat label="Orders" value={String(detail.sales.nonCancelledCount)} />
              </div>



              {/* Edit form */}
              <div className="metal-embossed-panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <h3 className="metal-text" style={{ fontSize: '1rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {isSubAgent ? 'Edit Sub-Agent' : 'Edit Agent'}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                  <div>
                    {/* R32: real First + Last name inputs (no more single
                         "First and Last Name" field that crammed both into one box) */}
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
                        <input style={inputStyle} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Store Display Name" />
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
                    <div>
                      <label style={labelStyle}>Credit Limit ($)</label>
                      <input style={inputStyle} type="number" min="0" step="0.01" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="0.00" />
                    </div>
                  )}

                  {/* R32: Markup Structure is for full agents only. Super-
                      agents earn off the platform Tier 1/2/3 multiplier and have
                      no need for a fixed/gamified markup ladder. */}
                  {detail?.agent?.role === 'agent'
                    && detail?.agent?.is_super_agent !== true
                    && detail?.agent?.is_sub_agent !== true && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Markup Structure</label>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                      <label style={{ flex: 1, ...inputStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderColor: commissionMode === 'fixed' ? 'var(--teal)' : 'rgba(0,0,0,0.8)' }}>
                        <input type="radio" checked={commissionMode === 'fixed'} onChange={() => setCommissionMode('fixed')} /> Fixed Markup
                      </label>
                      <label style={{ flex: 1, ...inputStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderColor: commissionMode === 'gamified' ? 'var(--teal)' : 'rgba(0,0,0,0.8)' }}>
                        <input type="radio" checked={commissionMode === 'gamified'} onChange={() => setCommissionMode('gamified')} />
                        <span style={{ flex: 1 }}>Gamification Scale</span>
                        <button
                          type="button"
                          aria-label="How The Gamification Scale Works"
                          title="How The Gamification Scale Works"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowGamificationInfo(true); }}
                          style={{
                            flex: '0 0 auto', width: 20, height: 20, borderRadius: '50%',
                            border: '1px solid var(--teal)', background: 'transparent',
                            color: 'var(--teal)', fontSize: '0.72rem', fontWeight: 800,
                            lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontStyle: 'italic', fontFamily: 'Georgia, serif',
                          }}
                        >
                          i
                        </button>
                      </label>
                    </div>

                    {commissionMode === 'fixed' ? (
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>Markup Rate (%)</label>
                        <input type="number" min="0" max="100" step="0.1" style={{ width: '100%', padding: '10px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }} value={commissionPct} onChange={e => setCommissionPct(e.target.value)} placeholder="e.g. 20" />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => { setScaleType('default'); setCustomSteps(freshDefaultLadder()); setShowGamificationInfo(true); }}
                          style={{
                            flex: 1, minWidth: 210, padding: '12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                            background: scaleType === 'default' ? 'var(--teal)' : 'rgba(255,255,255,0.05)',
                            color: scaleType === 'default' ? 'var(--black)' : 'var(--white)',
                            border: `1px solid ${scaleType === 'default' ? 'var(--teal)' : 'rgba(255,255,255,0.15)'}`,
                          }}
                        >
                          See Default Gamification Levels
                        </button>
                        <button
                          type="button"
                          onClick={() => { setScaleType('custom'); setShowGamificationInfo(true); }}
                          style={{
                            flex: 1, minWidth: 210, padding: '12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                            background: scaleType === 'custom' ? 'var(--teal)' : 'rgba(255,255,255,0.05)',
                            color: scaleType === 'custom' ? 'var(--black)' : 'var(--white)',
                            border: `1px solid ${scaleType === 'custom' ? 'var(--teal)' : 'rgba(255,255,255,0.15)'}`,
                          }}
                        >
                          Customize Gamification Levels
                        </button>
                      </div>
                    )}
                    <p style={{ fontSize: '0.75rem', color: 'var(--grey-500)', margin: '8px 0 0', lineHeight: 1.5 }}>
                      Fixed Markup Pays A Flat Rate. The Default Gamification Scale Starts At 20% And Rises To A 40% Maximum As Monthly Sales Grow. Customize To Set Your Own 5 Levels.
                    </p>
                  </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-neon-cyan" disabled={saving} onClick={saveChanges}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>

              {/* Sales history */}
              <div className="metal-embossed-panel">
                <h3 className="metal-text" style={{ fontSize: '1rem', margin: '0 0 var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Sales</h3>
                {detail.sales.recent.length === 0 ? (
                  <div style={{ color: 'var(--grey-400)', fontSize: '0.85rem', padding: 'var(--space-3) 0' }}>No Orders Yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {detail.sales.recent.map((o) => (
                      <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', gap: 8 }}>
                        <span style={{ color: 'var(--silver)', fontFamily: 'monospace' }}>#{o.id.slice(0, 8).toUpperCase()}</span>
                        <span style={{ color: 'var(--grey-400)', flex: 1, textAlign: 'center' }}>{o.buyer_name || '—'}</span>
                        <span style={{ color: 'var(--grey-400)' }}>{fmtDate(o.created_at)}</span>
                        <span style={{ color: o.status === 'cancelled' ? 'var(--grey-500)' : 'var(--teal)', minWidth: 70, textAlign: 'right' }}>{titleCaseStatus(o.status)}</span>
                        <span style={{ color: 'var(--white)', fontWeight: 700, minWidth: 70, textAlign: 'right' }}>{fmtMoney(o.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Wallet ledger */}
              <div className="metal-embossed-panel">
                <h3 className="metal-text" style={{ fontSize: '1rem', margin: '0 0 var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wallet Ledger</h3>
                {detail.ledger.length === 0 ? (
                  <div style={{ color: 'var(--grey-400)', fontSize: '0.85rem', padding: 'var(--space-3) 0' }}>No Wallet Transactions Yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {detail.ledger.map((t) => (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', gap: 8 }}>
                        <span style={{ color: 'var(--silver)', flex: 1 }}>{t.description || titleCaseStatus(t.type)}</span>
                        <span style={{ color: 'var(--grey-400)' }}>{fmtDate(t.created_at)}</span>
                        <span style={{ color: t.amount < 0 ? '#FFAAAA' : '#00FF9D', fontWeight: 700, minWidth: 80, textAlign: 'right' }}>
                          {t.amount < 0 ? '-' : '+'}{fmtMoney(Math.abs(t.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Account Access (Moved to bottom) */}
              <div className="metal-embossed-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--white)' }}>Account Access</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)' }}>
                    Deactivating Blocks Login And Takes The Storefront Offline.
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span style={{ color: isActive ? '#00FF9D' : 'var(--grey-400)', fontWeight: 600, fontSize: '0.9rem' }}>
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
                      backgroundColor: isActive ? '#00FF9D' : 'var(--grey-500)',
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
              </>
              )}

              {activeTab === 'Sub Agents' && (
                <div className="metal-embossed-panel">
                  <h3 className="metal-text" style={{ fontSize: '1rem', margin: '0 0 var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sub Agents</h3>
                  {!detail.sub_agents || detail.sub_agents.length === 0 ? (
                    <div style={{ color: 'var(--grey-400)', fontSize: '0.85rem', padding: 'var(--space-3) 0' }}>No Sub Agents Yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {detail.sub_agents.map((sa) => (
                        <div key={sa.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', gap: 8 }}>
                          <span style={{ color: 'var(--white)', flex: 1, fontWeight: 600 }}>{sa.full_name || sa.username || 'Anonymous'}</span>
                          <span style={{ color: 'var(--silver)' }}>{sa.email || ''}</span>
                          <span style={{ color: 'var(--grey-400)' }}>Joined: {fmtDate(sa.created_at)}</span>
                          <span style={{ color: sa.is_active ? '#00FF9D' : '#FFAAAA', minWidth: 60, textAlign: 'right' }}>{sa.is_active ? 'Active' : 'Inactive'}</span>
                          <span style={{ color: '#00E5FF', fontWeight: 700, minWidth: 60, textAlign: 'right' }}>{sa.commission_pct ?? 0}%</span>
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

    {/* Full-screen Gamification Scale explainer */}
      {showGamificationInfo && (
        <div
          onClick={() => setShowGamificationInfo(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)',
            zIndex: 1400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: 'var(--space-4)', overflowY: 'auto',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="metal-frame"
            style={{ width: '100%', maxWidth: 720, margin: 'var(--space-5) 0', display: 'flex', flexDirection: 'column' }}
          >
            <div className="metal-content" style={{ padding: 'var(--space-6)', overflowY: 'auto' }}>
              <h2 className="metal-text" style={{ marginTop: 0, marginBottom: 'var(--space-2)', fontSize: '1.4rem' }}>
                Gamification Scale
              </h2>
              <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
                {scaleType === 'custom' ? 'Customize The 5 Levels Of Gamification For This Agent.' : 'The Default House Scale — Starts At 20% And Rises To A 40% Maximum. Read Only.'}
              </p>
              
              <div style={{ border: '1px solid rgba(0,196,188,0.35)', borderRadius: 10, overflow: 'hidden', marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 0.8fr 1fr', background: 'rgba(0,196,188,0.12)', padding: '12px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--teal)' }}>
                  <span>Level</span>
                  <span>Monthly Sales</span>
                  <span style={{ textAlign: 'center' }}>Bonus</span>
                  <span style={{ textAlign: 'right' }}>Commission</span>
                </div>
                
                {customSteps.map((step, idx) => {
                  const isEditable = scaleType === 'custom';
                  const min = step.min_volume;
                  const max = idx < 4 ? customSteps[idx+1].min_volume - 0.01 : null;
                  
                  // For the bonus column
                  const baseRate = customSteps[0].bonus_pct;
                  const delta = step.bonus_pct - baseRate;
                  const bonusText = idx === 0 ? 'Base' : `+${delta.toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:2})}%`;
                  
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 0.8fr 1fr', alignItems: 'center',
                        padding: '12px', fontSize: '0.85rem',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      }}
                    >
                      <span style={{ color: 'var(--white)', fontWeight: 600 }}>
                        {step.level}. {step.name}
                      </span>
                      
                      <span style={{ color: 'var(--silver)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isEditable && idx > 0 ? (
                          <>
                            <span style={{ color: 'var(--grey-500)' }}>$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={step.min_volume}
                              onChange={e => {
                                const val = Number(e.target.value);
                                const newSteps = [...customSteps];
                                newSteps[idx].min_volume = val;
                                setCustomSteps(newSteps);
                              }}
                              style={{ width: '80px', padding: '4px 6px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '4px', fontSize: '0.8rem' }}
                            />
                            {max != null ? <span style={{ color: 'var(--grey-500)' }}> - ${max.toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:0})}</span> : <span style={{ color: 'var(--grey-500)' }}>+</span>}
                          </>
                        ) : (
                          <span>
                            ${min.toLocaleString('en-US')} {max != null ? ` - $${max.toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:0})}` : '+'}
                          </span>
                        )}
                      </span>
                      
                      <span style={{ textAlign: 'center', color: idx === 0 ? 'var(--grey-500)' : '#00FF9D', fontWeight: 700 }}>
                        {bonusText}
                      </span>
                      
                      <span style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {isEditable ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              min="0"
                              max="40"
                              step="0.1"
                              value={step.bonus_pct}
                              onChange={e => {
                                const val = Number(e.target.value);
                                const newSteps = [...customSteps];
                                newSteps[idx].bonus_pct = val;
                                setCustomSteps(newSteps);
                              }}
                              style={{ width: '60px', padding: '4px 6px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '4px', fontSize: '0.8rem', textAlign: 'right' }}
                            />
                            <span style={{ color: 'var(--grey-500)' }}>%</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--white)', fontWeight: 800 }}>{step.bonus_pct}%</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-neon-cyan"
                  onClick={() => setShowGamificationInfo(false)}
                >
                  {scaleType === 'custom' ? 'Save Levels' : 'Close'}
                </button>
              </div>
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
