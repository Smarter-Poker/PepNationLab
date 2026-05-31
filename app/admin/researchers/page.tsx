'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import Pagination from '@/components/Pagination';
import ViewAsButton from '@/components/ViewAsButton';

const PAGE_SIZE = 25;

interface AgentProfile {
  id: string;
  slug: string;
  display_name: string;
  qr_code_url: string | null;
  logo_url: string | null;
}

interface Profile {
  id: string;
  email: string;
  username: string | null;   // username-based login identity
  full_name: string | null;
  phone: string | null;
  role: 'researcher' | 'agent' | 'super_agent' | 'admin';
  tier: 'tier_1' | 'tier_2' | 'tier_3' | null;
  account_type: 'credit' | 'prepaid' | null;
  prepaid_balance: number;
  credit_limit: number | null;
  disclaimer_v1_accepted: boolean;
  is_active: boolean;
  created_at: string;
  agent_profiles: AgentProfile[] | AgentProfile | null;
}

const ROLE_LABELS: Record<string, string> = {
  researcher: 'Researcher',
  agent: 'Agent',
  super_agent: 'Super Agent',
  admin: 'Admin',
};

const TIER_LABELS: Record<string, string> = {
  tier_1: 'Tier 1',
  tier_2: 'Tier 2',
  tier_3: 'Tier 3',
};

function ResearchersAdminPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [unpaidAgentIds, setUnpaidAgentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [activeTab, setActiveTab] = useState<'researchers' | 'agents' | 'admins'>(
    (searchParams.get('tab') as 'researchers' | 'agents' | 'admins') ?? 'researchers'
  );
  const [roleFilter, setRoleFilter] = useState<string>(searchParams.get('role') ?? 'all');
  const [activeFilter, setActiveFilter] = useState<string>(searchParams.get('active') ?? 'all');
  const [tierFilter, setTierFilter] = useState<string>(searchParams.get('tier') ?? 'all');
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>(searchParams.get('accountType') ?? 'all');
  const [outstandingOnly, setOutstandingOnly] = useState<boolean>(searchParams.get('outstanding') === '1');
  const [page, setPage] = useState(1);

  // Modal State
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [modalMode, setModalMode] = useState<'upgrade' | 'edit' | 'qr' | 'balance' | 'create_agent' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Edit/Upgrade Form Fields
  const [formRole, setFormRole] = useState<'agent' | 'super_agent' | 'researcher'>('agent');
  const [formTier, setFormTier] = useState<'tier_1' | 'tier_2' | 'tier_3'>('tier_2');
  const [formAccountType, setFormAccountType] = useState<'credit' | 'prepaid'>('prepaid');
  const [formCreditLimit, setFormCreditLimit] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');

  // Balance adjustment
  const [balanceDelta, setBalanceDelta] = useState('');
  const [balanceType, setBalanceType] = useState<'add' | 'deduct'>('add');

  // Create New Agent fields
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newTier, setNewTier] = useState<'tier_1' | 'tier_2' | 'tier_3'>('tier_2');
  const [newAccountType, setNewAccountType] = useState<'credit' | 'prepaid'>('prepaid');
  const [newCreditLimit, setNewCreditLimit] = useState('');
  const [newPrepaidBalance, setNewPrepaidBalance] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');

  useEffect(() => {
    fetchProfiles();
    fetchUnpaidAgents();
  }, []);

  async function fetchUnpaidAgents() {
    try {
      const res = await fetch('/api/admin/statements?status=pending_payment');
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) {
        const ids = new Set<string>();
        for (const s of json.data) if (s.agent_id) ids.add(s.agent_id);
        setUnpaidAgentIds(ids);
      }
    } catch {
      // best-effort — Outstanding filter falls back to empty set
    }
  }

  async function fetchProfiles() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/researchers');
      const json = await res.json();
      if (res.ok) {
        setProfiles(json.data || []);
      } else {
        setError(json.error || 'Failed To Load Profiles');
      }
    } catch (err: any) {
      setError(err.message || 'An Error Occurred While Loading Profiles');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(profile: Profile) {
    const nextActive = !profile.is_active;
    setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, is_active: nextActive } : p));
    try {
      // Use action:'toggle_active' so the API only updates is_active,
      // without requiring slug/display_name (which would break for agents).
      const res = await fetch('/api/admin/researchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: profile.id, action: 'toggle_active', is_active: nextActive }),
      });
      if (!res.ok) {
        setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, is_active: profile.is_active } : p));
        const json = await res.json();
        toast.error(json.error || 'Failed To Toggle Account Status');
      }
    } catch (err: any) {
      setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, is_active: profile.is_active } : p));
      toast.error(err.message || 'Network Error Occurred');
    }
  }

  function openUpgradeModal(profile: Profile) {
    setSelectedProfile(profile);
    setModalMode('upgrade');
    setModalError('');
    setModalSuccess('');
    setFormRole('agent');
    setFormTier('tier_2');
    setFormAccountType('prepaid');
    setFormCreditLimit('');
    setFormSlug((profile.full_name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, ''));
    setFormDisplayName(profile.full_name || '');
  }

  function openEditModal(profile: Profile) {
    setSelectedProfile(profile);
    setModalMode('edit');
    setModalError('');
    setModalSuccess('');
    setFormRole(profile.role === 'super_agent' ? 'super_agent' : 'agent');
    setFormTier(profile.tier || 'tier_2');
    setFormAccountType(profile.account_type || 'prepaid');
    setFormCreditLimit(profile.credit_limit ? String(profile.credit_limit) : '');
    const ap = Array.isArray(profile.agent_profiles) ? profile.agent_profiles[0] : profile.agent_profiles;
    setFormSlug(ap?.slug || '');
    setFormDisplayName(ap?.display_name || profile.full_name || '');
  }

  function openBalanceModal(profile: Profile) {
    setSelectedProfile(profile);
    setModalMode('balance');
    setModalError('');
    setModalSuccess('');
    setBalanceDelta('');
    setBalanceType('add');
  }

  function openCreateAgentModal() {
    setModalMode('create_agent');
    setModalError('');
    setModalSuccess('');
    setNewName(''); setNewUsername(''); setNewPassword('');
    setNewTier('tier_2'); setNewAccountType('prepaid');
    setNewCreditLimit(''); setNewPrepaidBalance('');
    setNewSlug(''); setNewDisplayName('');
  }

  function openQrModal(profile: Profile) {
    setSelectedProfile(profile);
    setModalMode('qr');
  }

  function closeModal() {
    setModalMode(null);
    setSelectedProfile(null);
    setModalError('');
    setModalSuccess('');
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfile) return;
    setSubmitting(true);
    setModalError('');
    setModalSuccess('');
    try {
      const payload = {
        id: selectedProfile.id,
        role: formRole,
        tier: formTier,
        account_type: formAccountType,
        credit_limit: formAccountType === 'credit' ? Number(formCreditLimit) : null,
        slug: formSlug,
        display_name: formDisplayName,
      };
      const res = await fetch('/api/admin/researchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        await fetchProfiles();
        closeModal();
      } else {
        setModalError(json.error || 'Failed To Complete Operation');
      }
    } catch (err: any) {
      setModalError(err.message || 'An Error Occurred During Submission');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBalanceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfile) return;
    setSubmitting(true);
    setModalError('');
    setModalSuccess('');
    const amount = parseFloat(balanceDelta);
    if (isNaN(amount) || amount <= 0) {
      setModalError('Please Enter A Valid Positive Amount');
      setSubmitting(false);
      return;
    }
    const delta = balanceType === 'add' ? amount : -amount;
    try {
      const res = await fetch('/api/admin/researchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedProfile.id, action: 'adjust_balance', balance_delta: delta }),
      });
      const json = await res.json();
      if (res.ok) {
        setModalSuccess(`Balance Updated To $${Number(json.new_balance).toFixed(2)}`);
        setBalanceDelta('');
        await fetchProfiles();
      } else {
        setModalError(json.error || 'Failed To Update Balance');
      }
    } catch (err: any) {
      setModalError(err.message || 'Network Error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateAgent(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setModalError('');
    setModalSuccess('');
    try {
      const res = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: newName,
          username: newUsername,
          password: newPassword,
          tier: newTier,
          account_type: newAccountType,
          credit_limit: newAccountType === 'credit' ? Number(newCreditLimit) : null,
          prepaid_balance: newAccountType === 'prepaid' ? Number(newPrepaidBalance) : 0,
          slug: newSlug,
          display_name: newDisplayName,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        await fetchProfiles();
        setActiveTab('agents');
        closeModal();
      } else {
        setModalError(json.error || 'Failed To Create Agent');
      }
    } catch (err: any) {
      setModalError(err.message || 'Network Error');
    } finally {
      setSubmitting(false);
    }
  }

  // Persist filter state to URL params so refresh + share-URL works.
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (activeTab !== 'researchers') params.set('tab', activeTab);
    if (roleFilter !== 'all') params.set('role', roleFilter);
    if (activeFilter !== 'all') params.set('active', activeFilter);
    if (tierFilter !== 'all') params.set('tier', tierFilter);
    if (accountTypeFilter !== 'all') params.set('accountType', accountTypeFilter);
    if (outstandingOnly) params.set('outstanding', '1');
    const qs = params.toString();
    router.replace(qs ? `/admin/researchers?${qs}` : '/admin/researchers', { scroll: false });
  }, [searchQuery, activeTab, roleFilter, activeFilter, tierFilter, accountTypeFilter, outstandingOnly, router]);

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return profiles.filter(p => {
      const matchesSearch =
        !q ||
        (p.full_name || '').toLowerCase().includes(q) ||
        (p.username || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (activeTab === 'researchers' && p.role !== 'researcher') return false;
      if (activeTab === 'agents' && p.role !== 'agent' && p.role !== 'super_agent') return false;
      if (activeTab === 'admins' && p.role !== 'admin') return false;
      if (roleFilter !== 'all' && p.role !== roleFilter) return false;
      if (activeFilter === 'active' && !p.is_active) return false;
      if (activeFilter === 'deactivated' && p.is_active) return false;
      if (tierFilter !== 'all' && p.tier !== tierFilter) return false;
      if (accountTypeFilter !== 'all' && p.account_type !== accountTypeFilter) return false;
      if (outstandingOnly && !unpaidAgentIds.has(p.id)) return false;
      return true;
    });
  }, [profiles, searchQuery, activeTab, roleFilter, activeFilter, tierFilter, accountTypeFilter, outstandingOnly, unpaidAgentIds]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedProfiles = filteredProfiles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, activeTab, roleFilter, activeFilter, tierFilter, accountTypeFilter, outstandingOnly]);

  function resetResearcherFilters() {
    setSearchQuery('');
    setRoleFilter('all');
    setActiveFilter('all');
    setTierFilter('all');
    setAccountTypeFilter('all');
    setOutstandingOnly(false);
  }

  const resolvedAgentProfile = selectedProfile
    ? (Array.isArray(selectedProfile.agent_profiles) ? selectedProfile.agent_profiles[0] : selectedProfile.agent_profiles)
    : null;

  const inputStyle = { accentColor: 'var(--teal)', width: 18, height: 18 };

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>
            Researchers & Agents
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
            Manage Research Accounts, Role Upgrades, Pricing Tiers, And Prepaid Balances
          </p>
        </div>
        {/* Create New Agent Button */}
        <button
          onClick={openCreateAgentModal}
          className="btn-neon-cyan"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create New Agent
        </button>
      </div>

      {/* Tabs & Search */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', background: 'var(--black-2)', padding: 4, borderRadius: 'var(--radius-md)', border: 'var(--border-subtle)' }}>
          {[
            { id: 'researchers', label: 'Researchers' },
            { id: 'agents', label: 'Agents & Super Agents' },
            { id: 'admins', label: 'Admins' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: activeTab === tab.id ? '#fff' : 'var(--grey-400)',
                background: activeTab === tab.id ? 'var(--teal)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search Name, Username, Email, Or Phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 'var(--space-8)' }}
          />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--grey-500)' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {/* Advanced Filters */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-6)',
          padding: 'var(--space-4)',
          background: 'var(--surface-1)',
          border: 'var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          alignItems: 'flex-end',
        }}
      >
        <div style={{ flex: '1 1 160px', minWidth: 140 }}>
          <label className="form-label" style={{ fontSize: '0.7rem' }}>Role</label>
          <select className="form-input" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="all">All Roles</option>
            <option value="researcher">Researcher</option>
            <option value="agent">Agent</option>
            <option value="super_agent">Super Agent</option>
            <option value="admin">Admin</option>
            <option value="shipping">Shipping</option>
          </select>
        </div>
        <div style={{ flex: '1 1 140px', minWidth: 130 }}>
          <label className="form-label" style={{ fontSize: '0.7rem' }}>Activation</label>
          <select className="form-input" value={activeFilter} onChange={e => setActiveFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="deactivated">Deactivated</option>
          </select>
        </div>
        <div style={{ flex: '1 1 140px', minWidth: 130 }}>
          <label className="form-label" style={{ fontSize: '0.7rem' }}>Tier (Agents)</label>
          <select className="form-input" value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
            <option value="all">All Tiers</option>
            <option value="tier_1">Tier 1</option>
            <option value="tier_2">Tier 2</option>
            <option value="tier_3">Tier 3</option>
          </select>
        </div>
        <div style={{ flex: '1 1 140px', minWidth: 130 }}>
          <label className="form-label" style={{ fontSize: '0.7rem' }}>Account Type</label>
          <select className="form-input" value={accountTypeFilter} onChange={e => setAccountTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="credit">Credit</option>
            <option value="prepaid">Prepaid</option>
          </select>
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.78rem',
            color: 'var(--silver)',
            cursor: 'pointer',
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--surface-2)',
            border: 'var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            whiteSpace: 'nowrap',
          }}
        >
          <input
            type="checkbox"
            checked={outstandingOnly}
            onChange={e => setOutstandingOnly(e.target.checked)}
            style={{ accentColor: 'var(--teal)' }}
          />
          Outstanding Statement Only
        </label>
        <button
          type="button"
          onClick={resetResearcherFilters}
          className="btn-silver btn-sm"
          style={{ fontSize: '0.78rem' }}
        >
          Reset
        </button>
      </div>

      {/* Profile List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : error ? (
        <div className="disclaimer-warning" style={{ padding: 'var(--space-6)' }}>
          <p style={{ color: 'var(--red)', fontSize: '0.9rem' }}>{error}</p>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="metal-frame">
          <div className="metal-content" style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.88rem' }}>No Matching Profiles Found</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {paginatedProfiles.map(profile => {
            const ap = Array.isArray(profile.agent_profiles) ? profile.agent_profiles[0] : profile.agent_profiles;
            return (
              <div key={profile.id} className="metal-frame" style={{ opacity: profile.is_active ? 1 : 0.6 }}>
                <div className="metal-content" style={{
                  padding: 'var(--space-5)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                }}>
                {/* Avatar + Info */}
                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: profile.role === 'admin' ? 'var(--red)' : profile.role === 'super_agent' ? '#D69E2E' : 'var(--teal)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, color: '#fff', fontSize: '1rem',
                  }}>
                    {profile.full_name ? profile.full_name[0].toUpperCase() : '?'}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--silver)' }}>
                        {profile.full_name || 'No Name Provided'}
                      </span>
                      <span className="badge" style={{
                        background: profile.role === 'admin' ? 'rgba(229,62,62,0.15)' : profile.role === 'super_agent' ? 'rgba(214,158,46,0.15)' : 'rgba(192,184,168,0.15)',
                        color: profile.role === 'admin' ? 'var(--red)' : profile.role === 'super_agent' ? '#D69E2E' : 'var(--teal)',
                        borderColor: profile.role === 'admin' ? 'var(--red)' : profile.role === 'super_agent' ? '#D69E2E' : 'var(--teal)',
                      }}>
                        {ROLE_LABELS[profile.role] ?? profile.role}
                      </span>
                      {ap?.slug && <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)' }}>(@{ap.slug})</span>}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginTop: 2 }}>
                      {profile.username ? `@${profile.username}` : profile.email.split('@')[0]}
                      {profile.phone && ` • ${profile.phone}`}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--grey-500)', marginTop: 4 }}>
                      Joined {new Date(profile.created_at).toLocaleDateString()} • Disclaimer:{' '}
                      <span style={{ color: profile.disclaimer_v1_accepted ? 'var(--teal)' : 'var(--red)' }}>
                        {profile.disclaimer_v1_accepted ? 'ACCEPTED' : 'PENDING'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right side: tier info + actions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-6)' }}>
                  {(profile.role === 'agent' || profile.role === 'super_agent') && (
                    <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase' }}>Pricing Tier</div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--silver)' }}>
                          {profile.tier ? (TIER_LABELS[profile.tier] ?? profile.tier) : 'None'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase' }}>Balance / Limit</div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--silver)' }}>
                          {profile.account_type === 'credit'
                            ? `Credit $${(profile.credit_limit ?? 0).toFixed(2)}`
                            : `Prepaid $${(profile.prepaid_balance ?? 0).toFixed(2)}`}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleToggleActive(profile)}
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: '0.78rem', fontWeight: 600,
                        background: profile.is_active ? 'rgba(229,62,62,0.1)' : 'rgba(192,184,168,0.1)',
                        color: profile.is_active ? 'var(--red)' : 'var(--teal)',
                        border: '1px solid currentColor',
                        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      }}
                    >
                      {profile.is_active ? 'Deactivate' : 'Activate'}
                    </button>

                    <ViewAsButton
                      targetUserId={profile.id}
                      targetLabel={profile.full_name ?? profile.email}
                    />

                    {profile.role === 'researcher' ? (
                      <button onClick={() => openUpgradeModal(profile)} className="btn-neon-cyan" style={{ padding: 'var(--space-2) var(--space-4)', fontSize: '0.78rem' }}>
                        Upgrade To Agent
                      </button>
                    ) : (profile.role === 'agent' || profile.role === 'super_agent') ? (
                      <>
                        <button onClick={() => openEditModal(profile)} className="btn-silver" style={{ padding: 'var(--space-2) var(--space-4)', fontSize: '0.78rem' }}>
                          Configure
                        </button>
                        {profile.account_type === 'prepaid' && (
                          <button onClick={() => openBalanceModal(profile)} className="btn-silver" style={{ padding: 'var(--space-2) var(--space-4)', fontSize: '0.78rem', borderColor: '#68D391', color: '#68D391' }}>
                            Adjust Balance
                          </button>
                        )}
                        {ap?.slug && (
                          <button onClick={() => openQrModal(profile)} className="btn-silver" style={{ padding: 'var(--space-2) var(--space-4)', fontSize: '0.78rem', borderColor: 'var(--teal)', color: 'var(--teal)' }}>
                            QR Code
                          </button>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
                </div>
              </div>
            );
          })}
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* CREATE NEW AGENT MODAL */}
      {modalMode === 'create_agent' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 'var(--space-4)' }}>
          <div className="metal-frame" style={{ width: '100%', maxWidth: 580, maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>Create New Agent</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginBottom: 'var(--space-6)' }}>
              Creates A Supabase Auth Account + Agent Profile Directly. No Registration Required.
            </p>

            {modalError && (
              <div className="disclaimer-warning" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
                <p style={{ color: 'var(--red)', fontSize: '0.82rem' }}>{modalError}</p>
              </div>
            )}

            <form onSubmit={handleCreateAgent}>
              <h4 style={{ fontSize: '0.88rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>Account Credentials</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input type="text" className="form-input" placeholder="E.g. John Smith" value={newName}
                    onChange={e => { setNewName(e.target.value); setNewDisplayName(e.target.value); setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')); }} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input type="text" className="form-input" placeholder="E.g. midway" value={newUsername}
                    onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    required autoCapitalize="none" spellCheck={false} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
                <label className="form-label">Temporary Password (Min 8 Characters)</label>
                <input type="text" className="form-input" placeholder="They Can Change This After First Login"
                  value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} />
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: 'var(--space-4) 0' }} />

              <h4 style={{ fontSize: '0.88rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>Pricing & Billing</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Pricing Tier</label>
                  <select className="form-input" value={newTier} onChange={e => setNewTier(e.target.value as any)} required>
                    <option value="tier_1">Tier 1 — Best Pricing</option>
                    <option value="tier_2">Tier 2 — Standard Pricing</option>
                    <option value="tier_3">Tier 3 — Entry Pricing</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Billing Mode</label>
                  <select className="form-input" value={newAccountType} onChange={e => setNewAccountType(e.target.value as any)} required>
                    <option value="prepaid">Prepaid (Pays Before Orders Ship)</option>
                    <option value="credit">Credit (Weekly Statement Billing)</option>
                  </select>
                </div>
              </div>
              {newAccountType === 'credit' && (
                <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                  <label className="form-label">Credit Limit ($)</label>
                  <input type="number" className="form-input" placeholder="E.g. 5000" value={newCreditLimit}
                    onChange={e => setNewCreditLimit(e.target.value)} min="0" required />
                </div>
              )}
              {newAccountType === 'prepaid' && (
                <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                  <label className="form-label">Starting Prepaid Balance ($) — Optional</label>
                  <input type="number" className="form-input" placeholder="0.00" value={newPrepaidBalance}
                    onChange={e => setNewPrepaidBalance(e.target.value)} min="0" step="0.01" />
                </div>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: 'var(--space-4) 0' }} />

              <h4 style={{ fontSize: '0.88rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>Storefront Setup</h4>
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Display Name</label>
                <input type="text" className="form-input" placeholder="E.g. Pep Nation Orlando" value={newDisplayName}
                  onChange={e => setNewDisplayName(e.target.value)} required />
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Storefront Slug (URL)</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: 'var(--grey-500)', marginRight: 4, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>pepnationlab.com/</span>
                  <input type="text" className="form-input" placeholder="E.g. orlando-peps" value={newSlug}
                    onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, ''))} required />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--silver)', marginBottom: 'var(--space-6)' }}>
                <input type="checkbox" checked style={inputStyle} disabled />
                <span style={{ color: 'var(--grey-400)' }}>Agent Will Log In With Their Username — You Set It Above</span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <button type="button" className="btn-silver" onClick={closeModal} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-neon-cyan" disabled={submitting}>
                  {submitting ? 'Creating Agent...' : 'Create Agent Account'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* UPGRADE / CONFIGURE MODAL */}
      {(modalMode === 'upgrade' || modalMode === 'edit') && selectedProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 'var(--space-4)' }}>
          <div className="metal-frame" style={{ width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>
              {modalMode === 'upgrade' ? 'Upgrade User To Agent' : 'Configure Agent Profile'}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginBottom: 'var(--space-6)' }}>
              {selectedProfile.full_name}{selectedProfile.username ? ` (@${selectedProfile.username})` : ''}
            </p>
            {modalError && (
              <div className="disclaimer-warning" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
                <p style={{ color: 'var(--red)', fontSize: '0.82rem' }}>{modalError}</p>
              </div>
            )}
            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label className="form-label">Account Role Type</label>
                <select className="form-input" value={formRole} onChange={e => setFormRole(e.target.value as any)} required>
                  <option value="agent">Agent (Standard)</option>
                  <option value="super_agent">Super Agent (Allows Sub-Agents)</option>
                  {modalMode === 'edit' && <option value="researcher">Researcher (Downgrade)</option>}
                </select>
              </div>
              {formRole !== 'researcher' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div className="form-group">
                      <label className="form-label">Pricing Tier</label>
                      <select className="form-input" value={formTier} onChange={e => setFormTier(e.target.value as any)} required>
                        <option value="tier_1">Tier 1 — Best Pricing</option>
                        <option value="tier_2">Tier 2 — Standard Pricing</option>
                        <option value="tier_3">Tier 3 — Entry Pricing</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Billing Account Mode</label>
                      <select className="form-input" value={formAccountType} onChange={e => setFormAccountType(e.target.value as any)} required>
                        <option value="prepaid">Prepaid (Agent Pays Before Orders Ship)</option>
                        <option value="credit">Credit (Billed Weekly Statement)</option>
                      </select>
                    </div>
                  </div>
                  {formAccountType === 'credit' && (
                    <div className="form-group">
                      <label className="form-label">Credit Limit Amount ($)</label>
                      <input type="number" className="form-input" placeholder="E.g. 5000"
                        value={formCreditLimit} onChange={e => setFormCreditLimit(e.target.value)} required min="0" />
                    </div>
                  )}
                  <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: 'var(--space-5) 0' }} />
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>Agent Storefront Configuration</h4>
                  <div className="form-group">
                    <label className="form-label">Storefront Display Name</label>
                    <input type="text" className="form-input" placeholder="E.g. Pep Nation Orlando"
                      value={formDisplayName} onChange={e => setFormDisplayName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Storefront URL Slug</label>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ color: 'var(--grey-500)', marginRight: 4, fontSize: '0.85rem' }}>pepnationlab.com/</span>
                      <input type="text" className="form-input" placeholder="E.g. orlando-peps" value={formSlug}
                        onChange={e => setFormSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, ''))} required />
                    </div>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                <button type="button" className="btn-silver" onClick={closeModal} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-neon-cyan" disabled={submitting}>
                  {submitting ? 'Processing...' : modalMode === 'upgrade' ? 'Complete Upgrade' : 'Save Changes'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* BALANCE ADJUSTMENT MODAL */}
      {modalMode === 'balance' && selectedProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 'var(--space-4)' }}>
          <div className="metal-frame" style={{ width: '100%', maxWidth: 400 }}>
            <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>Adjust Prepaid Balance</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)' }}>
              {selectedProfile.full_name}{selectedProfile.username ? ` (@${selectedProfile.username})` : ''}
            </p>
            <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'rgba(192,184,168,0.06)', border: '1px solid rgba(192,184,168,0.2)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-5)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', marginBottom: 4 }}>Current Balance</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--teal)', fontFamily: 'var(--font-brand)' }}>
                ${(selectedProfile.prepaid_balance ?? 0).toFixed(2)}
              </div>
            </div>

            {modalError && (
              <div className="disclaimer-warning" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
                <p style={{ color: 'var(--red)', fontSize: '0.82rem' }}>{modalError}</p>
              </div>
            )}
            {modalSuccess && (
              <div style={{ background: 'rgba(104,211,145,0.1)', border: '1px solid rgba(104,211,145,0.3)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <p style={{ color: '#68D391', fontSize: '0.85rem', margin: 0 }}>{modalSuccess}</p>
              </div>
            )}

            <form onSubmit={handleBalanceSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                {(['add', 'deduct'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setBalanceType(type)}
                    style={{
                      padding: 'var(--space-3)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      border: `2px solid ${balanceType === type ? (type === 'add' ? '#68D391' : 'var(--red)') : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 'var(--radius-md)',
                      background: balanceType === type ? (type === 'add' ? 'rgba(104,211,145,0.1)' : 'rgba(229,62,62,0.1)') : 'transparent',
                      color: balanceType === type ? (type === 'add' ? '#68D391' : 'var(--red)') : 'var(--grey-400)',
                      cursor: 'pointer',
                    }}
                  >
                    {type === 'add' ? '+ Add Funds' : '− Deduct Funds'}
                  </button>
                ))}
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                <label className="form-label">Amount ($)</label>
                <input type="number" className="form-input" placeholder="0.00" step="0.01" min="0.01"
                  value={balanceDelta} onChange={e => setBalanceDelta(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <button type="button" className="btn-silver" onClick={closeModal} disabled={submitting}>Close</button>
                <button type="submit" className="btn-neon-cyan" disabled={submitting}
                  style={{ background: balanceType === 'add' ? undefined : 'var(--red)', borderColor: balanceType === 'add' ? undefined : 'var(--red)' }}>
                  {submitting ? 'Updating...' : balanceType === 'add' ? 'Add To Balance' : 'Deduct From Balance'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* QR CODE MODAL */}
      {modalMode === 'qr' && selectedProfile && resolvedAgentProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 'var(--space-4)' }}>
          <div className="metal-frame" style={{ width: '100%', maxWidth: 420 }}>
            <div className="metal-content" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>Storefront QR Code</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginBottom: 'var(--space-6)' }}>
              {resolvedAgentProfile.display_name} (@{resolvedAgentProfile.slug})
            </p>
            {resolvedAgentProfile.qr_code_url ? (
              <div style={{ background: '#0a1018', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: 'var(--border-silver)', display: 'inline-block', marginBottom: 'var(--space-6)', width: 250, height: 250 }}>
                <img src={resolvedAgentProfile.qr_code_url} alt={`${resolvedAgentProfile.display_name} QR`} style={{ width: '100%', height: '100%', borderRadius: 'var(--radius-md)' }} />
              </div>
            ) : (
              <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: 'var(--space-6)' }}>No QR Code Generated Yet</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <a href={resolvedAgentProfile.qr_code_url || '#'} download={`${resolvedAgentProfile.slug}-qr.png`} target="_blank" rel="noreferrer" className="btn-neon-cyan" style={{ width: '100%', justifyContent: 'center' }}>
                Download QR Code
              </a>
              <a href={`/${resolvedAgentProfile.slug}`} target="_blank" rel="noreferrer" className="btn-silver" style={{ width: '100%', justifyContent: 'center' }}>
                Visit Storefront
              </a>
              <button type="button" className="btn-silver" onClick={closeModal}>Close</button>
            </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function ResearchersAdminPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 'var(--space-8)' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>Loading Profiles...</p>
      </div>
    }>
      <ResearchersAdminPageInner />
    </Suspense>
  );
}
