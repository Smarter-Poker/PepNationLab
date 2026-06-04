'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import ViewAsButton from '@/components/ViewAsButton';
import AdminTierOverrideControl from '@/components/AdminTierOverrideControl';
import AgentAccountDetail from '@/components/AgentAccountDetail';
import { freshDefaultLadder, GAMIFICATION_MAX_PCT } from '@/lib/gamification';

export default function AdminAgents() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State — Edit Contact
  const [editingAgent, setEditingAgent] = useState<any | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Modal State — Edit Password
  const [passwordAgent, setPasswordAgent] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Modal State — Edit Account Details
  const [editingFullAgent, setEditingFullAgent] = useState<{ id: string; name: string } | null>(null);

  // Inline Tier Editing
  const [tierEditing, setTierEditing] = useState<Set<string>>(new Set());
  const [tierSaving, setTierSaving] = useState<Set<string>>(new Set());

  // Trust Toggle
  const [togglingTrust, setTogglingTrust] = useState<string | null>(null);

  // Modal State — Create Agent
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    full_name: '',
    username: '',
    password: '',
    tier: 'tier_3',
    account_type: 'prepaid',
    credit_limit: '',
    max_auto_approve_limit: '',
    prepaid_balance: '',
    slug: '',
    display_name: '',
    account_role: 'agent',
    parent_agent_id: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  // Commission Settings (for new agents)
  const [caCommissionMode, setCaCommissionMode] = useState<'fixed' | 'gamified'>('fixed');
  const [caCommissionPct, setCaCommissionPct] = useState('');
  // 'default' = read-only house ladder (20% → 40%); 'custom' = fully adjustable.
  const [caScaleType, setCaScaleType] = useState<'default' | 'custom'>('default');
  const [caCustomSteps, setCaCustomSteps] = useState(freshDefaultLadder());
  const [showGamificationInfo, setShowGamificationInfo] = useState(false);
  const [viewingDownlineFor, setViewingDownlineFor] = useState<any | null>(null);

  // Real-time availability checks
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const usernameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const slugTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/admin/agents');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch agents');
      setAgents(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  // Debounced username availability check
  const checkUsernameAvailability = useCallback((raw: string) => {
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    const clean = raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!clean || clean.length < 2) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    usernameTimerRef.current = setTimeout(async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', clean)
          .maybeSingle();
        setUsernameStatus(data ? 'taken' : 'available');
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);
  }, []);

  // Debounced slug availability check
  const checkSlugAvailability = useCallback((raw: string) => {
    if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    const clean = raw.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!clean || clean.length < 2) {
      setSlugStatus('idle');
      return;
    }
    setSlugStatus('checking');
    slugTimerRef.current = setTimeout(async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('agent_profiles')
          .select('id')
          .eq('slug', clean)
          .maybeSingle();
        setSlugStatus(data ? 'taken' : 'available');
      } catch {
        setSlugStatus('idle');
      }
    }, 500);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
      if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    };
  }, []);

  const handleCreateFormChange = (field: string, value: string) => {
    setCreateForm(prev => ({ ...prev, [field]: value }));
    if (field === 'username') {
      checkUsernameAvailability(value);
    }
    if (field === 'slug') {
      checkSlugAvailability(value);
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    // Platform rule: no gamification level may exceed 40%.
    if (createForm.account_role !== 'researcher' && caCommissionMode === 'gamified'
        && caCustomSteps.some(s => Number(s.bonus_pct) > GAMIFICATION_MAX_PCT)) {
      toast.error('Gamification Levels Cannot Exceed 40%.');
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          firstName: createForm.firstName.trim(),
          lastName: createForm.lastName.trim(),
          username: createForm.username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
          slug: createForm.slug.toLowerCase().replace(/[^a-z0-9-]/g, ''),
          // Commission config for agents/super_agents
          // Fixed -> flat rate (cap == base). Gamified (Default or Custom) ->
          // persist the concrete 5-level ladder; base = Rookie, cap = Apex.
          commission_pct: createForm.account_role === 'researcher' ? undefined : (
            caCommissionMode === 'fixed'
              ? (caCommissionPct === '' ? undefined : caCommissionPct)
              : (Number(caCustomSteps[0].bonus_pct) || 0)
          ),
          commission_max_pct: createForm.account_role === 'researcher' ? undefined : (
            caCommissionMode === 'fixed'
              ? (caCommissionPct === '' ? undefined : caCommissionPct)
              : Number(caCustomSteps[caCustomSteps.length - 1].bonus_pct)
          ),
          velocity_cap: undefined,
          custom_commission_scale: createForm.account_role === 'researcher' ? undefined : (
            caCommissionMode === 'gamified'
              ? caCustomSteps.map(s => ({ min_volume: Number(s.min_volume) || 0, bonus_pct: Math.max(0, Number(s.bonus_pct) - Number(caCustomSteps[0].bonus_pct)) }))
              : undefined
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed To Create Agent');
      toast.success(`${createForm.account_role === 'researcher' ? 'Researcher' : 'Agent'} "${createForm.firstName} ${createForm.lastName}" Created Successfully`);
      setShowCreateModal(false);
      setCreateForm({
        firstName: '',
        lastName: '',
        full_name: '',
        username: '',
        password: '',
        tier: 'tier_3',
        account_type: 'prepaid',
        credit_limit: '',
        max_auto_approve_limit: '',
        prepaid_balance: '',
        slug: '',
        display_name: '',
        account_role: 'agent',
        parent_agent_id: '',
      });
      setCaCommissionMode('fixed');
      setCaCommissionPct('');
      setCaScaleType('default');
      setCaCustomSteps(freshDefaultLadder());
      setUsernameStatus('idle');
      setSlugStatus('idle');
      fetchAgents();
    } catch (err: any) {
      toast.error(err.message || 'Failed To Create Agent');
    } finally {
      setIsCreating(false);
    }
  };

  const formatCurrency = (val: number) => `$${(Number(val) || 0).toFixed(2)}`;

  // Inline tier change — saves immediately on select change
  const handleTierChange = async (agentId: string, newTier: string) => {
    setTierSaving(prev => new Set([...prev, agentId]));
    try {
      const res = await fetch('/api/admin/agents/update-tier', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, tier: newTier }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update tier');
      toast.success(`Tier updated to ${newTier.replace('_', ' ').toUpperCase()}`);
      // Update local state immediately (no full refetch needed)
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, tier: newTier } : a));
    } catch (err: any) {
      toast.error(err.message || 'Failed to update tier');
    } finally {
      setTierSaving(prev => { const n = new Set(prev); n.delete(agentId); return n; });
      setTierEditing(prev => { const n = new Set(prev); n.delete(agentId); return n; });
    }
  };

  // Tier badge colours
  const tierStyle = (tier: string) => ({
    tier_1: { bg: 'rgba(104,211,145,0.15)', color: '#68D391', border: '1px solid rgba(104,211,145,0.35)' },
    tier_2: { bg: 'rgba(99,179,237,0.15)',  color: '#63B3ED', border: '1px solid rgba(99,179,237,0.35)' },
    tier_3: { bg: 'rgba(246,173,85,0.15)',  color: '#00E5FF', border: '1px solid rgba(246,173,85,0.35)' },
  }[tier] ?? { bg: 'rgba(192,184,168,0.1)', color: 'var(--teal)', border: '1px solid rgba(192,184,168,0.3)' });

  const openEditModal = (agent: any) => {
    setEditingAgent(agent);
    setEditEmail(agent.email?.includes('@internal.auth') || agent.email?.includes('@pepnationlab.com') ? '' : (agent.email || ''));
    setEditPhone(agent.phone || '');
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/agents/update-contact', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingAgent.id,
          email: editEmail || editingAgent.email, // fallback if empty
          phone: editPhone
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success('Contact Info Updated Successfully');
      setEditingAgent(null);
      fetchAgents();
    } catch (err: any) {
      toast.error(err.message || 'Failed To Update Contact Info');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditAccountModal = (agent: any) => {
    setEditingFullAgent({ id: agent.id, name: agent.full_name || agent.username || 'Agent' });
  };

  const handleToggleTrust = async (targetUserId: string, currentStatus: boolean) => {
    setTogglingTrust(targetUserId);
    try {
      const res = await fetch('/api/agent/trust', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, auto_approve_orders: !currentStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update auto-approve setting');
      
      toast.success(data.auto_approve_orders ? 'Auto-Approve Enabled' : 'Auto-Approve Disabled');
      
      setAgents(prev => prev.map(a => a.id === targetUserId ? { ...a, auto_approve_orders: data.auto_approve_orders } : a));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTogglingTrust(null);
    }
  };

  // Availability indicator component
  const AvailabilityIndicator = ({ status }: { status: 'idle' | 'checking' | 'available' | 'taken' }) => {
    if (status === 'idle') return null;
    if (status === 'checking') {
      return (
        <span style={{ fontSize: '0.8rem', color: 'var(--silver)', marginTop: 4, display: 'block' }}>
          Checking availability…
        </span>
      );
    }
    if (status === 'available') {
      return (
        <span style={{ fontSize: '0.8rem', color: 'var(--green)', marginTop: 4, display: 'block', fontWeight: 600 }}>
          That Name Is Available
        </span>
      );
    }
    return (
      <span style={{ fontSize: '0.8rem', color: 'var(--red)', marginTop: 4, display: 'block', fontWeight: 600 }}>
        That Name Is Not Available
      </span>
    );
  };

  if (loading) return <div style={{ color: 'var(--silver)' }}>Loading agents...</div>;
  if (error) return <div style={{ color: 'var(--red)' }}>Error: {error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--white)', fontFamily: 'var(--font-brand)' }}>
          Manage Agents
        </h1>
        <button
          className="btn-neon-cyan"
          onClick={() => setShowCreateModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          + Create New Agent
        </button>
      </div>

      {/* Downline Breadcrumb */}
      {viewingDownlineFor && (
        <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)', background: 'rgba(0,196,188,0.05)', border: '1px solid rgba(0,196,188,0.2)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ color: 'var(--silver)' }}>Viewing Downline Agents For:</span>{' '}
            <span style={{ fontWeight: 700, color: 'var(--teal)', fontSize: '1.05rem' }}>{viewingDownlineFor.full_name || viewingDownlineFor.username}</span>
          </div>
          <button onClick={() => setViewingDownlineFor(null)} className="btn-secondary btn-sm" style={{ padding: '6px 12px' }}>
            &larr; Back To Top-Level Agents
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {(() => {
          const filteredAgents = agents.filter(agent => {
            if (viewingDownlineFor) {
              return agent.parent_agent_id === viewingDownlineFor.id;
            }
            return agent.parent_agent_id == null;
          });

          if (filteredAgents.length === 0) {
            return <div style={{ textAlign: 'center', padding: 'var(--space-6)', opacity: 0.5 }}>No matching agents found.</div>;
          }

          return filteredAgents.map(agent => {
            const isDefaultEmail = agent.email?.includes('@internal.auth');
            return (
              <div 
                key={agent.id}
                style={{
                  background: 'var(--bg-metal-dark)',
                  borderTop: '1px solid rgba(0,0,0,0.8)',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  borderLeft: '1px solid rgba(0,0,0,0.5)',
                  borderRight: '1px solid rgba(255,255,255,0.03)',
                  boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.9)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 200px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Agent</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--white)' }}>{agent.full_name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--silver)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                      ID: {agent.id.split('-')[0]}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    {agent.is_super_agent ? (
                      <span className="badge badge-teal" style={{ fontSize: '0.65rem' }}>SUPER AGENT</span>
                    ) : agent.parent_agent_id ? (
                      <span className="badge badge-silver" style={{ fontSize: '0.65rem' }}>Sub-Agent</span>
                    ) : (
                      <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)' }}>Standard</span>
                    )}
                    <span style={{ color: agent.is_active ? 'var(--green)' : 'var(--red)', fontSize: '0.75rem', fontWeight: 600 }}>
                      {agent.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  {agent.is_super_agent && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 8 }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Auto Approve</span>
                      <label style={{ position: 'relative', display: 'inline-block', width: '30px', height: '16px' }}>
                        <input 
                          type="checkbox" 
                          checked={!!agent.auto_approve_orders}
                          onChange={() => handleToggleTrust(agent.id, !!agent.auto_approve_orders)}
                          disabled={togglingTrust === agent.id || agent.account_type === 'credit' || agent.account_type === 'prepaid'}
                          style={{ opacity: 0, width: 0, height: 0 }} 
                        />
                        <span style={{
                          position: 'absolute',
                          cursor: (togglingTrust === agent.id || agent.account_type === 'credit' || agent.account_type === 'prepaid') ? 'not-allowed' : 'pointer',
                          top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: agent.auto_approve_orders ? 'var(--teal)' : 'var(--grey-500)',
                          transition: '.4s',
                          borderRadius: '16px',
                          opacity: (togglingTrust === agent.id || agent.account_type === 'credit' || agent.account_type === 'prepaid') ? 0.5 : 1
                        }}>
                          <span style={{
                            position: 'absolute',
                            height: '10px',
                            width: '10px',
                            left: agent.auto_approve_orders ? '17px' : '3px',
                            bottom: '3px',
                            backgroundColor: 'white',
                            transition: '.4s',
                            borderRadius: '50%'
                          }} />
                        </span>
                      </label>
                      {togglingTrust === agent.id && <span style={{ fontSize: '0.65rem', color: 'var(--teal)' }}>Saving...</span>}
                      {(agent.account_type === 'credit' || agent.account_type === 'prepaid') && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--silver)', fontStyle: 'italic' }} title="Locked by Account Type">
                          (Locked)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Credentials</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--teal)' }}>{agent.username || '—'}</span>
                    <button
                      onClick={() => { setPasswordAgent(agent); setNewPassword(''); }}
                      style={{ fontSize: '0.75rem', color: 'var(--grey-400)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textAlign: 'left' }}
                    >
                      Edit Password
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Contact Info</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                    {isDefaultEmail ? (
                      <button onClick={() => openEditModal(agent)} className="btn-silver" style={{ padding: '2px 6px', fontSize: '0.7rem' }}>
                        + Add Email
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: 'var(--silver)' }}>{agent.email?.includes('@internal.auth') || agent.email?.includes('@pepnationlab.com') ? '' : agent.email}</span>
                    )}
                    
                    {agent.phone ? (
                      <span style={{ fontSize: '0.85rem', color: 'var(--silver)' }}>{agent.phone}</span>
                    ) : (
                      <button onClick={() => openEditModal(agent)} className="btn-silver" style={{ padding: '2px 6px', fontSize: '0.7rem', opacity: 0.7 }}>
                        + Add Phone
                      </button>
                    )}
                    
                    {(!isDefaultEmail || agent.phone) && (
                      <button onClick={() => openEditModal(agent)} style={{ fontSize: '0.75rem', color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', marginTop: 2 }}>
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Tier & Type</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                    {/* Inline tier editor */}
                    {tierEditing.has(agent.id) ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <select
                          autoFocus
                          defaultValue={agent.tier || 'tier_3'}
                          disabled={tierSaving.has(agent.id)}
                          onChange={e => handleTierChange(agent.id, e.target.value)}
                          onBlur={() => setTierEditing(prev => { const n = new Set(prev); n.delete(agent.id); return n; })}
                          style={{
                            background: 'var(--surface-3)', color: 'var(--white)',
                            border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6,
                            padding: '3px 6px', fontSize: '0.75rem', cursor: 'pointer',
                          }}
                        >
                          <option value="tier_1">Tier 1</option>
                          <option value="tier_2">Tier 2</option>
                          <option value="tier_3">Tier 3</option>
                        </select>
                        {tierSaving.has(agent.id) && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--teal)' }}>Saving…</span>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setTierEditing(prev => new Set([...prev, agent.id]))}
                        title="Click to change tier"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}
                      >
                        <span style={{
                          padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700,
                          background: tierStyle(agent.tier || 'tier_3').bg,
                          color: tierStyle(agent.tier || 'tier_3').color,
                          border: tierStyle(agent.tier || 'tier_3').border,
                        }}>
                          {(agent.tier || 'tier_3').replace('_', ' ').toUpperCase()}
                        </span>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--grey-500)", flexShrink: 0 }} aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
                      </button>
                    )}
                    <span style={{ fontSize: '0.8rem', color: 'var(--silver)' }}>
                      {agent.account_type === 'prepaid' ? 'Prepaid' : 'Credit'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    {agent.account_type === 'credit' ? 'Credit Limit' : 'Prepaid Bal.'}
                  </span>
                  {agent.account_type === 'credit' ? (
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--green)' }}>
                      {agent.credit_limit ? formatCurrency(agent.credit_limit) : '$0.00'}
                    </span>
                  ) : (
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: Number(agent.prepaid_balance) < 0 ? 'var(--red)' : 'var(--green)' }}>
                      {formatCurrency(agent.prepaid_balance)}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Last Logged In</span>
                  <span style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: agent.last_sign_in_at ? 'var(--silver)' : 'var(--grey-500)',
                    fontStyle: agent.last_sign_in_at ? 'normal' : 'italic',
                  }}>
                    {agent.last_sign_in_at
                      ? new Date(agent.last_sign_in_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                      : 'Never Logged In'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Storefront</span>
                  {(() => {
                    const ap = Array.isArray(agent.agent_profiles) ? agent.agent_profiles[0] : agent.agent_profiles;
                    return ap?.slug ? (
                      <a href={`/${ap.slug}`} style={{ color: 'var(--teal)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
                        {ap.slug}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--grey-400)', fontSize: '0.85rem' }}>No storefront</span>
                    );
                  })()}
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap', flex: '1 1 150px' }}>
                  {agent.is_super_agent && (
                    <button onClick={() => setViewingDownlineFor(agent)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                      View Downline
                    </button>
                  )}
                  <button onClick={() => openEditAccountModal(agent)} className="btn-silver" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    Edit Details
                  </button>
                  <button 
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/admin/agents/super-upgrade', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ agentId: agent.id, is_super_agent: !agent.is_super_agent })
                        });
                        const json = await res.json();
                        if (!res.ok) throw new Error(json.error);
                        toast.success(agent.is_super_agent ? 'Super Agent Status Revoked' : 'Promoted To Super Agent');
                        fetchAgents(); // refresh
                      } catch (err: any) {
                        toast.error(err.message || 'Failed To Update Super Agent Status');
                      }
                    }}
                    className="btn-silver" style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    disabled={agent.parent_agent_id !== null}
                  >
                    {agent.is_super_agent ? 'Revoke Super' : 'Make Super'}
                  </button>
                  <div style={{ display: 'inline-block' }}>
                    <ViewAsButton
                      targetUserId={agent.id}
                      targetLabel={agent.full_name ?? agent.email}
                    />
                  </div>
                </div>

              </div>
            );
          });
        })()}
      </div>

      {/* Edit Contact Modal */}
      {editingAgent && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 400 }}>
            <div className="" style={{ padding: 'var(--space-6)' }}>
              <h3 className="metal-text" style={{ marginTop: 0, marginBottom: 'var(--space-4)', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Edit Contact Info
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginBottom: 'var(--space-4)' }}>
                Updating the email will change the Agent's login credentials.
              </p>
              <form onSubmit={handleSaveContact}>
                <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                  <label className="form-label">Email Address</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    value={editEmail} 
                    onChange={e => setEditEmail(e.target.value)} 
                    placeholder={editingAgent.email?.includes('@internal.auth') || editingAgent.email?.includes('@pepnationlab.com') ? 'Enter real email...' : editingAgent.email}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                  <label className="form-label">Phone Number</label>
                  <input 
                    type="tel" 
                    className="form-input" 
                    value={editPhone} 
                    onChange={e => setEditPhone(e.target.value)} 
                    placeholder=""
                  />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-silver" onClick={() => setEditingAgent(null)} disabled={isSaving}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-neon-cyan" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Password Modal */}
      {passwordAgent && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 400 }}>
            <div className="" style={{ padding: 'var(--space-6)' }}>
              <h3 className="metal-text" style={{ marginTop: 0, marginBottom: 'var(--space-4)', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Edit Password</h3>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginBottom: 'var(--space-2)' }}>
                Agent: <strong style={{ color: '#fff' }}>{passwordAgent.full_name}</strong>
              </p>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginBottom: 'var(--space-4)' }}>
                Username: <strong style={{ color: '#00E5FF', fontFamily: 'monospace' }}>{passwordAgent.username}</strong>
              </p>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!passwordAgent || !newPassword) return;
                setPasswordSaving(true);
                try {
                  const res = await fetch('/api/admin/agents/update-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: passwordAgent.id, newPassword }),
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.error);
                  toast.success('Password Updated Successfully');
                  setPasswordAgent(null);
                  setNewPassword('');
                } catch (err: any) {
                  toast.error(err.message || 'Failed To Update Password');
                } finally {
                  setPasswordSaving(false);
                }
              }}>
                <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                  <label className="form-label">New Password</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 Characters"
                    required
                    minLength={8}
                    autoComplete="off"
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-silver" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => { setPasswordAgent(null); setNewPassword(''); }} disabled={passwordSaving}>Cancel</button>
                  <button type="submit" className="btn-neon-cyan" style={{ padding: '4px 12px', fontSize: '0.8rem' }} disabled={passwordSaving || newPassword.length < 8}>
                    {passwordSaving ? 'Saving...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Account Settings Drawer */}
      {editingFullAgent && (
        <AgentAccountDetail
          agentId={editingFullAgent.id}
          agentName={editingFullAgent.name}
          onClose={() => setEditingFullAgent(null)}
          onChanged={() => {
            fetchAgents();
          }}
        />
      )}

      {/* Create Agent Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--space-4)',
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: 520,
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <div className="" style={{ padding: 'var(--space-6)' }}>
              <h3 className="metal-text" style={{ marginTop: 0, marginBottom: 'var(--space-2)', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Create New Agent
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginBottom: 'var(--space-5)' }}>
                This will create a new agent account with auth credentials and a storefront.
              </p>
            <form onSubmit={handleCreateAgent}>
              {/* First + Last Name — top-aligned so both labels sit on the same row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', alignItems: 'start' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>First Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={createForm.firstName}
                    onChange={e => handleCreateFormChange('firstName', e.target.value)}
                    placeholder="e.g. John"
                    required
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Last Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={createForm.lastName}
                    onChange={e => handleCreateFormChange('lastName', e.target.value)}
                    placeholder="e.g. Smith"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Account Role */}
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Account Type</label>
                <select
                  className="form-input"
                  value={createForm.account_role}
                  onChange={e => handleCreateFormChange('account_role', e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="agent">Agent</option>
                  <option value="super_agent">Super Agent</option>
                  <option value="researcher">Researcher</option>
                </select>
              </div>

              {/* Parent Agent (for researchers only) */}
              {createForm.account_role === 'researcher' && (
                <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Assign To Agent</label>
                  <select
                    className="form-input"
                    value={createForm.parent_agent_id}
                    onChange={e => handleCreateFormChange('parent_agent_id', e.target.value)}
                    required
                    style={{ width: '100%' }}
                  >
                    <option value="">Select An Agent...</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.full_name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Username */}
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Username</label>
                <input
                  type="text"
                  className="form-input"
                  value={createForm.username}
                  onChange={e => handleCreateFormChange('username', e.target.value)}
                  placeholder="e.g. john_smith"
                  required
                  autoComplete="off"
                  style={{ width: '100%' }}
                />
                <AvailabilityIndicator status={usernameStatus} />
              </div>

              {/* Password */}
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={createForm.password}
                  onChange={e => handleCreateFormChange('password', e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Tier & Billing Mode — top-aligned, side by side (agents + super-agents only) */}
              {createForm.account_role !== 'researcher' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', alignItems: 'start' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Tier</label>
                  <select
                    className="form-input"
                    value={createForm.tier}
                    onChange={e => handleCreateFormChange('tier', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="tier_1">Tier 1</option>
                    <option value="tier_2">Tier 2</option>
                    <option value="tier_3">Tier 3</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Billing Mode</label>
                  <select
                    className="form-input"
                    value={createForm.account_type}
                    onChange={e => handleCreateFormChange('account_type', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="prepaid">Prepaid</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
              </div>
              )}

              {/* Conditional: Balance or Credit Limit (agents only) */}
              {createForm.account_role !== 'researcher' && (
              <>
              {createForm.account_type === 'prepaid' ? (
                <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Starting Balance ($)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={createForm.prepaid_balance}
                    onChange={e => handleCreateFormChange('prepaid_balance', e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    style={{ width: '100%' }}
                  />
                </div>
              ) : (
                <>
                  <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Credit Limit ($)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={createForm.credit_limit}
                      onChange={e => handleCreateFormChange('credit_limit', e.target.value)}
                      placeholder="1000.00"
                      step="0.01"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Max Auto-Approve Limit ($)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={createForm.max_auto_approve_limit}
                      onChange={e => handleCreateFormChange('max_auto_approve_limit', e.target.value)}
                      placeholder="Unlimited"
                      step="0.01"
                      style={{ width: '100%' }}
                    />
                  </div>
                </>
              )}

              {/* Storefront Slug */}
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Storefront URL (Slug)</label>
                <input
                  type="text"
                  className="form-input"
                  value={createForm.slug}
                  onChange={e => handleCreateFormChange('slug', e.target.value)}
                  placeholder="e.g. john-picks"
                  required
                  style={{ width: '100%' }}
                />
                <AvailabilityIndicator status={slugStatus} />
              </div>

              {/* Display Name */}
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Display Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={createForm.display_name}
                  onChange={e => handleCreateFormChange('display_name', e.target.value)}
                  placeholder="Storefront display name"
                  required
                  style={{ width: '100%' }}
                />
              </div>
              </>
              )}

              {/* Commission / Markup Settings — agents only.
                  Super-agents do NOT see this: they earn purely off the Tier 1/2/3
                  multiplier on the master catalog. The fixed/gamified markup
                  ladder is for agents who set their own retail prices. */}
              {createForm.account_role === 'agent' && (
                <div style={{ marginTop: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--grey-300)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>Markup Structure</label>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <label style={{ flex: 1, padding: '10px', background: 'var(--bg-metal-dark)', border: `1px solid ${caCommissionMode === 'fixed' ? 'var(--teal)' : 'rgba(0,0,0,0.8)'}`, color: 'var(--white)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="radio" checked={caCommissionMode === 'fixed'} onChange={() => setCaCommissionMode('fixed')} />
                      Fixed Markup
                    </label>
                    <label style={{ flex: 1, padding: '10px', background: 'var(--bg-metal-dark)', border: `1px solid ${caCommissionMode === 'gamified' ? 'var(--teal)' : 'rgba(0,0,0,0.8)'}`, color: 'var(--white)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="radio" checked={caCommissionMode === 'gamified'} onChange={() => setCaCommissionMode('gamified')} />
                      Gamification Scale
                    </label>
                  </div>

                  {caCommissionMode === 'fixed' ? (
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>Markup Rate (%)</label>
                      <input type="number" min="0" max="100" step="0.1" style={{ width: '100%', padding: '10px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }} value={caCommissionPct} onChange={e => setCaCommissionPct(e.target.value)} placeholder="e.g. 20" />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCaScaleType('default'); setCaCustomSteps(freshDefaultLadder()); setShowGamificationInfo(true); }}
                        style={{
                          flex: 1, minWidth: 200, padding: '12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
                          background: caScaleType === 'default' ? 'var(--teal)' : 'rgba(255,255,255,0.05)',
                          color: caScaleType === 'default' ? 'var(--black)' : 'var(--white)',
                          border: `1px solid ${caScaleType === 'default' ? 'var(--teal)' : 'rgba(255,255,255,0.15)'}`,
                        }}
                      >
                        See Default Gamification Levels
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCaScaleType('custom'); setShowGamificationInfo(true); }}
                        style={{
                          flex: 1, minWidth: 200, padding: '12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
                          background: caScaleType === 'custom' ? 'var(--teal)' : 'rgba(255,255,255,0.05)',
                          color: caScaleType === 'custom' ? 'var(--black)' : 'var(--white)',
                          border: `1px solid ${caScaleType === 'custom' ? 'var(--teal)' : 'rgba(255,255,255,0.15)'}`,
                        }}
                      >
                        Customize Gamification Levels
                      </button>
                    </div>
                  )}
                  <p style={{ fontSize: '0.72rem', color: 'var(--grey-500)', margin: '6px 0 0', lineHeight: 1.4 }}>
                    Fixed Markup Pays A Flat Rate. The Default Gamification Scale Starts At 20% And Rises To A 40% Maximum As Monthly Sales Grow. Customize To Set Your Own 5 Levels.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-silver"
                  onClick={() => {
                    setShowCreateModal(false);
                    setUsernameStatus('idle');
                    setSlugStatus('idle');
                  }}
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-neon-cyan"
                  disabled={isCreating || usernameStatus === 'taken' || (createForm.account_role !== 'researcher' && slugStatus === 'taken')}
                >
                  {isCreating ? 'Creating...' : createForm.account_role === 'researcher' ? 'Create Researcher' : 'Create Agent'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Gamification Scale Info Modal */}
      {showGamificationInfo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 1200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="" style={{ padding: 'var(--space-6)', overflowY: 'auto' }}>
              <h2 className="metal-text" style={{ marginTop: 0, marginBottom: 'var(--space-2)', fontSize: '1.4rem' }}>
                Gamification Scale
              </h2>
              <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
                {caScaleType === 'custom' ? 'Customize The 5 Levels Of Gamification For This Agent.' : 'The Default House Scale — Starts At 20% And Rises To A 40% Maximum. Read Only.'}
              </p>
              
              <div style={{ border: '1px solid rgba(0,196,188,0.35)', borderRadius: 10, overflow: 'hidden', marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 0.8fr 1fr', background: 'rgba(0,196,188,0.12)', padding: '12px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--teal)' }}>
                  <span>Level</span>
                  <span>Monthly Sales</span>
                  <span style={{ textAlign: 'center' }}>Bonus</span>
                  <span style={{ textAlign: 'right' }}>Commission</span>
                </div>
                
                {caCustomSteps.map((step, idx) => {
                  const isEditable = caScaleType === 'custom';
                  const min = step.min_volume;
                  const max = idx < 4 ? caCustomSteps[idx+1].min_volume - 0.01 : null;
                  
                  const baseRate = caCustomSteps[0].bonus_pct;
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
                                const newSteps = [...caCustomSteps];
                                newSteps[idx].min_volume = val;
                                setCaCustomSteps(newSteps);
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
                                const newSteps = [...caCustomSteps];
                                newSteps[idx].bonus_pct = val;
                                setCaCustomSteps(newSteps);
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
                  {caScaleType === 'custom' ? 'Save Levels' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
