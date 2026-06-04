'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import Pagination from '@/components/Pagination';
import ViewAsButton from '@/components/ViewAsButton';
import { useAvailability, availabilityMessage } from '@/lib/useAvailability';

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
  parent_agent_id?: string | null;
  role: 'researcher' | 'agent' | 'super_agent' | 'admin';
  tier: 'tier_1' | 'tier_2' | 'tier_3' | null;
  custom_markup_override: number | null;
  account_type: 'credit' | 'prepaid' | null;
  prepaid_balance: number;
  credit_limit: number | null;
  disclaimer_v1_accepted: boolean;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  first_sign_in_at: string | null;
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
  const [viewingDownlineFor, setViewingDownlineFor] = useState<Profile | null>(null);

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
  const [formCustomMarkup, setFormCustomMarkup] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');

  // Balance adjustment
  const [balanceDelta, setBalanceDelta] = useState('');
  const [balanceType, setBalanceType] = useState<'add' | 'deduct'>('add');

  // Create New Agent fields
  // R31: split first/last across every create-account form.
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newTier, setNewTier] = useState<'tier_1' | 'tier_2' | 'tier_3'>('tier_2');
  const [newAccountType, setNewAccountType] = useState<'credit' | 'prepaid'>('prepaid');
  const [newCreditLimit, setNewCreditLimit] = useState('');
  const [newPrepaidBalance, setNewPrepaidBalance] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  // Which kind of account the create modal is building. Researcher mode hides
  // the agent-only Pricing/Billing/Storefront sections and instead requires the
  // owning agent (parent_agent_id), which the API mandates for researchers.
  const [createRole, setCreateRole] = useState<'agent' | 'researcher'>('agent');
  const [newParentAgentId, setNewParentAgentId] = useState('');

  // Live username availability — fires when the modal is mounted with a typed
  // username. Mirrors the storefront register form + the agent create-researcher
  // modal so the operator sees green/red feedback before they press submit.
  const newUsernameCheck = useAvailability({
    field: 'username',
    value: newUsername,
    minLength: 2,
    disabled: modalMode !== 'create_agent',
  });
  const newUsernameMsg = availabilityMessage(newUsernameCheck);
  const newUsernameBlocked =
    newUsernameCheck.status === 'taken' ||
    newUsernameCheck.status === 'reserved' ||
    newUsernameCheck.status === 'invalid';

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
    setFormCustomMarkup('');
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
    setFormCustomMarkup(profile.custom_markup_override != null ? String(Math.round(profile.custom_markup_override * 100)) : '');
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

  function openCreateModal(role: 'agent' | 'researcher') {
    setCreateRole(role);
    setModalMode('create_agent');
    setModalError('');
    setModalSuccess('');
    setNewFirstName(''); setNewLastName(''); setNewUsername(''); setNewPassword('');
    setNewTier('tier_2'); setNewAccountType('prepaid');
    setNewCreditLimit(''); setNewPrepaidBalance('');
    setNewSlug(''); setNewDisplayName(''); setNewParentAgentId('');
  }
  function openCreateAgentModal() { openCreateModal('agent'); }

  async function handleCreateResearcher(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setModalError('');
    setModalSuccess('');
    if (!newParentAgentId) {
      setModalError('Please Select The Agent This Researcher Belongs To');
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_role: 'researcher',
          full_name: `${newFirstName.trim()} ${newLastName.trim()}`.trim(),
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
          username: newUsername,
          password: newPassword,
          parent_agent_id: newParentAgentId,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Researcher Account Created — Username: ${json.username || newUsername}`);
        await fetchProfiles();
        setActiveTab('researchers');
        closeModal();
      } else {
        setModalError(json.error || 'Failed To Create Researcher');
      }
    } catch (err: any) {
      setModalError(err.message || 'Network Error');
    } finally {
      setSubmitting(false);
    }
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
        custom_markup_override: formCustomMarkup ? Number(formCustomMarkup) / 100 : null,
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
          full_name: `${newFirstName.trim()} ${newLastName.trim()}`.trim(),
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
      if (activeTab === 'agents') {
        if (p.role !== 'agent' && p.role !== 'super_agent') return false;
        // Apply hierarchy filter only if there is no active search query
        if (!q) {
          if (viewingDownlineFor) {
            if (p.parent_agent_id !== viewingDownlineFor.id) return false;
          } else {
            if (p.parent_agent_id != null) return false; // Hide sub-agents from the root view
          }
        }
      }
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

  // Reset to page 1 and clear downline view when filter or search changes
  useEffect(() => {
    setPage(1);
    if (activeTab !== 'agents') setViewingDownlineFor(null);
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
          <h1 className="animated-gradient-text" style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>
            Researchers & Agents
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
            Manage Research Accounts, Role Upgrades, Pricing Tiers, And Prepaid Balances
          </p>
        </div>
        {/* Create Account Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <button
            onClick={() => openCreateModal('researcher')}
            className="btn-silver"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Researcher
          </button>
          <button
            onClick={() => openCreateModal('agent')}
            className="btn-neon-cyan"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create New Agent
          </button>
        </div>
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
            style={{ 
              paddingLeft: 'var(--space-8)', 
              fontSize: '1.25rem', /* 33% larger than default ~0.95rem */
              paddingBottom: '14px', /* moves text up */
              paddingTop: '6px',
              height: '48px'
            }}
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

      {/* Downline Breadcrumb */}
      {viewingDownlineFor && activeTab === 'agents' && (
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
        <div className="glass-panel hover-lift stagger-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="" style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.88rem' }}>No Matching Profiles Found</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {paginatedProfiles.map((profile, index) => {
            const ap = Array.isArray(profile.agent_profiles) ? profile.agent_profiles[0] : profile.agent_profiles;
            return (
              <div key={profile.id} className="glass-panel hover-lift stagger-fade-in" style={{ opacity: profile.is_active ? 1 : 0.6, animationDelay: `${0.1 + Math.min(index, 5) * 0.1}s` }}>
                <div className="" style={{
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
                    <div style={{ fontSize: '0.74rem', marginTop: 4, color: profile.last_sign_in_at ? 'var(--silver)' : 'var(--grey-500)', fontStyle: profile.last_sign_in_at ? 'normal' : 'italic' }}>
                      Last Logged In:{' '}
                      <span style={{ fontWeight: 600 }}>
                        {profile.last_sign_in_at ? new Date(profile.last_sign_in_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never Logged In'}
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

                    {profile.role === 'super_agent' && (
                      <button onClick={() => setViewingDownlineFor(profile)} className="btn-secondary" style={{ padding: 'var(--space-2) var(--space-4)', fontSize: '0.78rem' }}>
                        View Downline
                      </button>
                    )}

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
        <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 'var(--space-4)' }}>
          <div className="glass-panel hover-lift stagger-fade-in" style={{ width: '100%', maxWidth: 580, maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="" style={{ padding: 'var(--space-6)' }}>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>
                {createRole === 'researcher' ? 'Create New Researcher' : 'Create New Agent'}
              </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginBottom: 'var(--space-6)' }}>
              {createRole === 'researcher'
                ? 'Creates A Researcher Account Tied To The Agent You Select Below. No Storefront Or Pricing Tier Required.'
                : 'Creates A Supabase Auth Account + Agent Profile Directly. No Registration Required.'}
            </p>

            {modalError && (
              <div className="disclaimer-warning" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
                <p style={{ color: 'var(--red)', fontSize: '0.82rem' }}>{modalError}</p>
              </div>
            )}

            <form onSubmit={createRole === 'researcher' ? handleCreateResearcher : handleCreateAgent}>
              <h4 style={{ fontSize: '0.88rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>Account Credentials</h4>
              {/* R31: first/last on top row, username + password below. The
                  globals.css rule `.form-group + .form-group { margin-top: var(--space-5); }`
                  was pushing Last Name ~20px lower than First Name even though
                  they sit side-by-side in the grid. Override marginTop on both
                  so the two fields line up. */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', alignItems: 'start' }}>
                <div className="form-group" style={{ marginTop: 0 }}>
                  <label className="form-label">First Name</label>
                  <input type="text" className="form-input" placeholder="E.g. John" value={newFirstName}
                    onChange={e => {
                      const v = e.target.value;
                      setNewFirstName(v);
                      // Auto-populate the storefront display name + slug from the
                      // first name only — far cleaner than dragging the last name
                      // through .toLowerCase().replace(...) and getting hyphenated
                      // surnames in the URL.
                      const combined = `${v} ${newLastName}`.trim();
                      setNewDisplayName(combined);
                      setNewSlug(v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, ''));
                    }} required />
                </div>
                <div className="form-group" style={{ marginTop: 0 }}>
                  <label className="form-label">Last Name</label>
                  <input type="text" className="form-input" placeholder="E.g. Smith" value={newLastName}
                    onChange={e => {
                      const v = e.target.value;
                      setNewLastName(v);
                      const combined = `${newFirstName} ${v}`.trim();
                      setNewDisplayName(combined);
                    }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="E.g. midway"
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    required
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={newUsernameBlocked || undefined}
                    aria-describedby="admin-cr-username-status"
                    style={{
                      borderColor: newUsernameCheck.status === 'available'
                        ? '#34D399'
                        : newUsernameBlocked
                          ? '#FC8181'
                          : undefined,
                    }}
                  />
                  {newUsernameMsg && (
                    <div
                      id="admin-cr-username-status"
                      role="status"
                      aria-live="polite"
                      style={{
                        marginTop: 6,
                        fontSize: '0.78rem',
                        color: newUsernameMsg.color,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        lineHeight: 1.3,
                      }}
                    >
                      {newUsernameMsg.tone === 'success' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={newUsernameMsg.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {newUsernameMsg.tone === 'error' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={newUsernameMsg.color} strokeWidth="3" strokeLinecap="round" aria-hidden>
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      )}
                      {newUsernameMsg.tone === 'warn' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={newUsernameMsg.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <circle cx="12" cy="17" r="0.5" />
                        </svg>
                      )}
                      {newUsernameMsg.tone === 'info' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={newUsernameMsg.color} strokeWidth="2" strokeLinecap="round" aria-hidden>
                          <circle cx="12" cy="12" r="9" />
                          <line x1="12" y1="7" x2="12" y2="13" />
                          <circle cx="12" cy="17" r="0.5" />
                        </svg>
                      )}
                      <span>{newUsernameMsg.text}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
                <label className="form-label">Temporary Password (Min 8 Characters)</label>
                <input type="text" className="form-input" placeholder="They Can Change This After First Login"
                  value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} />
              </div>

              {createRole === 'researcher' && (
                <>
                  <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: 'var(--space-4) 0' }} />
                  <h4 style={{ fontSize: '0.88rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>Account Owner</h4>
                  <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
                    <label className="form-label">Assign To Agent</label>
                    <select className="form-input" value={newParentAgentId} onChange={e => setNewParentAgentId(e.target.value)} required>
                      <option value="">Select The Agent This Researcher Belongs To</option>
                      {profiles
                        .filter(p => p.role === 'agent' || p.role === 'super_agent')
                        .sort((a, b) => (a.full_name || a.username || '').localeCompare(b.full_name || b.username || ''))
                        .map(a => (
                          <option key={a.id} value={a.id}>
                            {(a.full_name || a.username || 'Agent')}{a.username ? ` (@${a.username})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}

              {createRole === 'agent' && (
              <>
              <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: 'var(--space-4) 0' }} />

              <h4 style={{ fontSize: '0.88rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>Pricing & Billing</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', alignItems: 'start' }}>
                <div className="form-group" style={{ marginTop: 0 }}>
                  <label className="form-label">Pricing Tier</label>
                  <select className="form-input" value={newTier} onChange={e => setNewTier(e.target.value as any)} required>
                    <option value="tier_1">Tier 1 — Best Pricing (50% House)</option>
                    <option value="tier_2">Tier 2 — Standard Pricing (60% House)</option>
                    <option value="tier_3">Tier 3 — Entry Pricing (70% House)</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginTop: 0 }}>
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

              </>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '0.85rem', color: 'var(--silver)', marginBottom: 'var(--space-6)' }}>
                <input type="checkbox" checked style={inputStyle} disabled />
                <span style={{ color: 'var(--grey-400)' }}>
                  {createRole === 'researcher'
                    ? 'Researcher Will Log In With Their Username — You Set It Above'
                    : 'Agent Will Log In With Their Username — You Set It Above'}
                </span>
              </label>

              <div style={{ position: 'sticky', bottom: 0, display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingTop: 'var(--space-4)', paddingBottom: 'var(--space-2)', marginTop: 'var(--space-2)', background: 'var(--surface-1, #0F1923)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button type="button" className="btn-silver" onClick={closeModal} disabled={submitting}>Cancel</button>
                <button
                  type="submit"
                  className="btn-neon-cyan"
                  disabled={submitting || newUsernameBlocked || newUsernameCheck.status === 'checking'}
                >
                  {submitting
                    ? (createRole === 'researcher' ? 'Creating Researcher...' : 'Creating Agent...')
                    : newUsernameBlocked
                      ? 'Pick A Different Username'
                      : newUsernameCheck.status === 'checking'
                        ? 'Checking Username…'
                        : (createRole === 'researcher' ? 'Create Researcher Account' : 'Create Agent Account')}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* UPGRADE / CONFIGURE MODAL */}
      {(modalMode === 'upgrade' || modalMode === 'edit') && selectedProfile && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 'var(--space-4)' }}>
          <div className="glass-panel hover-lift stagger-fade-in" style={{ width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="" style={{ padding: 'var(--space-6)' }}>
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', alignItems: 'start' }}>
                    <div className="form-group" style={{ marginTop: 0 }}>
                      <label className="form-label">Pricing Tier</label>
                      <select className="form-input" value={formTier} onChange={e => setFormTier(e.target.value as any)} required>
                        <option value="tier_1">Tier 1 — Best Pricing</option>
                        <option value="tier_2">Tier 2 — Standard Pricing</option>
                        <option value="tier_3">Tier 3 — Entry Pricing</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginTop: 0 }}>
                      <label className="form-label">Billing Account Mode</label>
                      <select className="form-input" value={formAccountType} onChange={e => setFormAccountType(e.target.value as any)} required>
                        <option value="prepaid">Prepaid (Agent Pays Before Orders Ship)</option>
                        <option value="credit">Credit (Billed Weekly Statement)</option>
                      </select>
                    </div>
                  </div>
                  {formAccountType === 'credit' && (
                    <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                      <label className="form-label">Credit Limit Amount ($)</label>
                      <input type="number" className="form-input" placeholder="E.g. 5000"
                        value={formCreditLimit} onChange={e => setFormCreditLimit(e.target.value)} required min="0" />
                    </div>
                  )}
                  <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                    <label className="form-label">Manual Markup Override % (Optional)</label>
                    <input type="number" className="form-input" placeholder="E.g. 45 for 45%. Overrides Tier selection."
                      value={formCustomMarkup} onChange={e => setFormCustomMarkup(e.target.value)} min="0" max="200" step="1" />
                    <p style={{ fontSize: '0.72rem', color: 'var(--grey-500)', marginTop: 4 }}>
                      Leave blank to use the standard Pricing Tier. If set, this exact percentage will be used for all their product base costs.
                    </p>
                  </div>
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
        <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 'var(--space-4)' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 400 }}>
            <div className="" style={{ padding: 'var(--space-6)' }}>
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
        <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 'var(--space-4)' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 420 }}>
            <div className="" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
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
              <a href={`/${resolvedAgentProfile.slug}`} rel="noreferrer" className="btn-silver" style={{ width: '100%', justifyContent: 'center' }}>
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
