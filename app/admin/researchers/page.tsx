'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { X } from 'lucide-react';
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
  username: string | null;
  full_name: string | null;
  phone: string | null;
  parent_agent_id?: string | null;
  referring_agent_id?: string | null;
  referring_agent_name?: string | null;
  referring_agent_slug?: string | null;
  referring_agent_role?: string | null;
  role: 'researcher' | 'agent' | 'super_agent' | 'admin';
  is_super_agent?: boolean;
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

  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [modalMode, setModalMode] = useState<'upgrade' | 'edit' | 'qr' | 'balance' | 'create_agent' | 'assign' | null>(null);
  // Researcher-ownership filter (Researchers tab only): 'house' shows only
  // researchers still owned by the admin / house store, 'assigned' shows only
  // those handed to a real agent, 'all' shows everyone.
  const [ownerFilter, setOwnerFilter] = useState<'house' | 'assigned' | 'all'>(
    (searchParams.get('owner') as 'house' | 'assigned' | 'all') ?? 'house'
  );
  // Assign-to-agent modal state.
  const [assignAgentId, setAssignAgentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  const [formRole, setFormRole] = useState<'agent' | 'super_agent' | 'researcher'>('agent');
  const [formTier, setFormTier] = useState<'tier_1' | 'tier_2' | 'tier_3'>('tier_2');
  const [formAccountType, setFormAccountType] = useState<'credit' | 'prepaid'>('prepaid');
  const [formCreditLimit, setFormCreditLimit] = useState('');
  const [formCustomMarkup, setFormCustomMarkup] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');

  const [balanceDelta, setBalanceDelta] = useState('');
  const [balanceType, setBalanceType] = useState<'add' | 'deduct'>('add');

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
  const [createRole, setCreateRole] = useState<'agent' | 'researcher'>('agent');
  const [newParentAgentId, setNewParentAgentId] = useState('');
  const [usernameDirty, setUsernameDirty] = useState(false);

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
      // best-effort
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
    setFormRole(profile.is_super_agent === true ? 'super_agent' : 'agent');
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
    setUsernameDirty(false);
  }
  function openCreateAgentModal() { openCreateModal('agent'); }

  async function handleCreateResearcher(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setModalError('');
    setModalSuccess('');
    if (!newParentAgentId) {
      setModalError('Please Select The Account Owner For This Researcher');
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
        const loginUser = json.username || newUsername;
        toast.success(
          `Researcher Created. They Log In With Username "${loginUser}" (Not Their Name).`,
          { duration: 12000 },
        );
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

  function openAssignModal(profile: Profile) {
    setSelectedProfile(profile);
    setModalMode('assign');
    setModalError('');
    setModalSuccess('');
    // Pre-select current owner if it is a real agent (not the house).
    setAssignAgentId(isHouseOwned(profile) ? '' : (profile.referring_agent_id ?? ''));
  }

  async function handleAssignSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfile) return;
    if (!assignAgentId) {
      setModalError('Please Select An Agent Or Super Agent');
      return;
    }
    setSubmitting(true);
    setModalError('');
    setModalSuccess('');
    try {
      const res = await fetch('/api/admin/researchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedProfile.id, action: 'assign_researcher', assign_to_agent_id: assignAgentId }),
      });
      const json = await res.json();
      if (res.ok) {
        const label = assignAgentId === '__HOUSE__'
          ? 'The House Account'
          : (agentOptions.find(a => a.id === assignAgentId)?.label ?? 'The Selected Agent');
        toast.success(`${selectedProfile.full_name || 'Researcher'} Assigned To ${label}.`);
        await fetchProfiles();
        closeModal();
      } else {
        setModalError(json.error || 'Failed To Assign Researcher');
      }
    } catch (err: any) {
      setModalError(err.message || 'Network Error');
    } finally {
      setSubmitting(false);
    }
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
          account_role: 'agent',
          full_name: `${newFirstName.trim()} ${newLastName.trim()}`.trim(),
          username: newUsername,
          password: newPassword,
          tier: newTier,
          account_type: newAccountType,
          credit_limit: newAccountType === 'credit' ? Number(newCreditLimit) : null,
          prepaid_balance: newAccountType === 'prepaid' ? Number(newPrepaidBalance) : 0,
          slug: newSlug || newUsername.toLowerCase().replace(/[^a-z0-9\-]/g, ''),
          display_name: newDisplayName || newUsername,
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

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (activeTab !== 'researchers') params.set('tab', activeTab);
    if (roleFilter !== 'all') params.set('role', roleFilter);
    if (activeFilter !== 'all') params.set('active', activeFilter);
    if (tierFilter !== 'all') params.set('tier', tierFilter);
    if (accountTypeFilter !== 'all') params.set('accountType', accountTypeFilter);
    if (outstandingOnly) params.set('outstanding', '1');
    if (ownerFilter !== 'house') params.set('owner', ownerFilter);
    const qs = params.toString();
    router.replace(qs ? `/admin/researchers?${qs}` : '/admin/researchers', { scroll: false });
  }, [searchQuery, activeTab, roleFilter, activeFilter, tierFilter, accountTypeFilter, outstandingOnly, ownerFilter, router]);

  // A researcher is "house-owned" (i.e. still the admin's) when they have no
  // referring agent, or their referring agent is the house store (researchstore)
  // or an admin account. Once reassigned to a real agent, they stop being
  // house-owned and drop out of the admin's default Researchers list.
  function isHouseOwned(p: Profile): boolean {
    if (!p.referring_agent_id) return true;
    if (p.referring_agent_slug === 'researchstore') return true;
    if (p.referring_agent_role === 'admin') return true;
    return false;
  }

  // Agents + super agents available as assignment targets.
  const agentOptions = useMemo(() => {
    return profiles
      .filter(p => (p.role === 'agent' || p.role === 'super_agent') && p.is_active !== false)
      .map(p => {
        const ap = Array.isArray(p.agent_profiles) ? p.agent_profiles[0] : p.agent_profiles;
        return {
          id: p.id,
          label: `${p.full_name || p.username || p.email}${p.is_super_agent ? ' (Super Agent)' : ''}${ap?.slug ? ` - @${ap.slug}` : ''}`,
          slug: ap?.slug ?? null,
        };
      })
      // Never list the house store itself as a normal assignment target; it is
      // offered separately as the "Return To House" option.
      .filter(a => a.slug !== 'researchstore')
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [profiles]);

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
      // Researcher ownership filter: hide agent-assigned researchers from the
      // admin's default "house" view; they reappear under "Assigned"/"All".
      if (activeTab === 'researchers') {
        if (ownerFilter === 'house' && !isHouseOwned(p)) return false;
        if (ownerFilter === 'assigned' && isHouseOwned(p)) return false;
      }
      if (activeTab === 'agents') {
        if (p.role !== 'agent' && p.role !== 'super_agent') return false;
        if (!q) {
          if (viewingDownlineFor) {
            if (p.parent_agent_id !== viewingDownlineFor.id) return false;
          } else {
            if (p.parent_agent_id != null) return false;
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
  }, [profiles, searchQuery, activeTab, roleFilter, activeFilter, tierFilter, accountTypeFilter, outstandingOnly, unpaidAgentIds, viewingDownlineFor, ownerFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedProfiles = filteredProfiles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
    if (activeTab !== 'agents') setViewingDownlineFor(null);
  }, [searchQuery, activeTab, roleFilter, activeFilter, tierFilter, accountTypeFilter, outstandingOnly, ownerFilter]);

  function resetResearcherFilters() {
    setSearchQuery('');
    setRoleFilter('all');
    setActiveFilter('all');
    setTierFilter('all');
    setAccountTypeFilter('all');
    setOutstandingOnly(false);
    setOwnerFilter('house');
  }

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
            onClick={openCreateAgentModal}
            className="btn-neon-cyan"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Agent
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 'var(--space-6)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(['researchers', 'agents', 'admins'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => { setActiveTab(tab); setPage(1); }}
            style={{
              padding: 'var(--space-3) var(--space-5)',
              fontSize: '0.85rem',
              fontWeight: activeTab === tab ? 700 : 500,
              color: activeTab === tab ? 'var(--teal)' : 'var(--grey-400)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--teal)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
              marginBottom: -1,
              textTransform: 'capitalize',
            }}
          >
            {tab === 'researchers' ? 'Researchers' : tab === 'agents' ? 'Agents' : 'Admins'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search By Name, Username, Email, Or Phone"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
          style={{ maxWidth: 300, flex: '1 1 200px' }}
        />
        {activeTab !== 'admins' && (
          <select className="form-input" value={activeFilter} onChange={e => { setActiveFilter(e.target.value); setPage(1); }} style={{ maxWidth: 160 }}>
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="deactivated">Deactivated</option>
          </select>
        )}
        {activeTab === 'researchers' && (
          <select className="form-input" value={ownerFilter} onChange={e => { setOwnerFilter(e.target.value as 'house' | 'assigned' | 'all'); setPage(1); }} style={{ maxWidth: 210 }} title="Filter Researchers By Owner">
            <option value="house">House / Unassigned</option>
            <option value="assigned">Assigned To Agents</option>
            <option value="all">All Researchers</option>
          </select>
        )}
        {activeTab === 'agents' && (
          <>
            <select className="form-input" value={tierFilter} onChange={e => { setTierFilter(e.target.value); setPage(1); }} style={{ maxWidth: 160 }}>
              <option value="all">All Tiers</option>
              <option value="tier_1">Tier 1</option>
              <option value="tier_2">Tier 2</option>
              <option value="tier_3">Tier 3</option>
            </select>
            <select className="form-input" value={accountTypeFilter} onChange={e => { setAccountTypeFilter(e.target.value); setPage(1); }} style={{ maxWidth: 180 }}>
              <option value="all">All Account Types</option>
              <option value="credit">Credit</option>
              <option value="prepaid">Prepaid</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--silver)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={outstandingOnly} onChange={e => { setOutstandingOnly(e.target.checked); setPage(1); }} style={inputStyle} />
              Outstanding Only
            </label>
          </>
        )}
        {(searchQuery || roleFilter !== 'all' || activeFilter !== 'all' || tierFilter !== 'all' || accountTypeFilter !== 'all' || outstandingOnly || (activeTab === 'researchers' && ownerFilter !== 'house')) && (
          <button type="button" onClick={resetResearcherFilters}
            style={{ fontSize: '0.78rem', color: 'var(--grey-400)', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>
            Clear Filters
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--grey-500)' }}>
          {filteredProfiles.length} Result{filteredProfiles.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Downline Breadcrumb */}
      {viewingDownlineFor && activeTab === 'agents' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'rgba(0,196,188,0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,196,188,0.18)' }}>
          <button type="button" onClick={() => setViewingDownlineFor(null)}
            style={{ fontSize: '0.78rem', color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            All Agents
          </button>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--grey-500)" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          <span style={{ fontWeight: 700, color: 'var(--teal)', fontSize: '1.05rem' }}>{viewingDownlineFor.full_name || viewingDownlineFor.username}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)' }}>Sub-Agents</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-16)' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : error ? (
        <div className="disclaimer-warning" style={{ padding: 'var(--space-5)' }}>
          <p style={{ color: 'var(--red)' }}>{error}</p>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--grey-400)', fontSize: '0.9rem' }}>
          No Profiles Match Your Current Filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {paginatedProfiles.map((profile, idx) => {
            const ap = Array.isArray(profile.agent_profiles) ? profile.agent_profiles[0] : profile.agent_profiles;
            const isAgent = profile.role === 'agent' || profile.role === 'super_agent';
            const isUnpaid = unpaidAgentIds.has(profile.id);
            return (
              <div key={profile.id} className="glass-panel hover-lift stagger-fade-in" style={{ animationDelay: `${idx * 0.03}s` }}>
                <div className="" style={{ padding: 'var(--space-4) var(--space-5)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, var(--teal) 0%, #007A75 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: '1.1rem', flexShrink: 0 }}>
                      {(profile.full_name || profile.email || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 2 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--white)' }}>
                          {profile.full_name || profile.email}
                        </span>
                        {ap?.slug && <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)' }}>(@{ap.slug})</span>}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginTop: 2 }}>
                        {profile.username ? `@${profile.username}` : (profile.email ?? '').split('@')[0]}
                        {profile.phone && ` • ${profile.phone}`}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--grey-500)', marginTop: 4 }}>
                        Joined {new Date(profile.created_at).toLocaleDateString()} • Disclaimer:{' '}
                        <span style={{ color: profile.disclaimer_v1_accepted ? 'var(--teal)' : 'var(--red)' }}>
                          {profile.disclaimer_v1_accepted ? 'Accepted' : 'Pending'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', marginTop: 4, color: profile.last_sign_in_at ? 'var(--silver)' : 'var(--grey-500)', fontStyle: profile.last_sign_in_at ? 'normal' : 'italic' }}>
                        Last Logged In:{' '}
                        <span style={{ fontWeight: 600 }}>
                          {profile.last_sign_in_at ? new Date(profile.last_sign_in_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never Logged In'}
                        </span>
                      </div>
                      {profile.role === 'researcher' && (
                        <div style={{ fontSize: '0.74rem', marginTop: 4, color: 'var(--grey-500)' }}>
                          Owner:{' '}
                          <span style={{ fontWeight: 600, color: isHouseOwned(profile) ? 'var(--grey-400)' : 'var(--teal)' }}>
                            {isHouseOwned(profile) ? 'House (Admin)' : (profile.referring_agent_name || 'Assigned Agent')}
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: profile.role === 'admin' ? 'rgba(229,62,62,0.15)' : profile.role === 'super_agent' || profile.is_super_agent ? 'rgba(0,196,188,0.15)' : 'rgba(192,184,168,0.1)', color: profile.role === 'admin' ? 'var(--red)' : profile.role === 'super_agent' || profile.is_super_agent ? 'var(--teal)' : 'var(--silver)', border: `1px solid ${profile.role === 'admin' ? 'rgba(229,62,62,0.3)' : profile.role === 'super_agent' || profile.is_super_agent ? 'rgba(0,196,188,0.3)' : 'rgba(192,184,168,0.2)'}` }}>
                        {profile.is_super_agent ? 'Super Agent' : ROLE_LABELS[profile.role] ?? profile.role}
                      </span>
                      {profile.tier && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(0,196,188,0.1)', color: 'var(--teal)', border: '1px solid rgba(0,196,188,0.25)' }}>
                          {TIER_LABELS[profile.tier] ?? profile.tier}
                        </span>
                      )}
                      {!profile.is_active && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(229,62,62,0.12)', color: 'var(--red)', border: '1px solid rgba(229,62,62,0.25)' }}>
                          Deactivated
                        </span>
                      )}
                      {isUnpaid && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(229,62,62,0.12)', color: 'var(--red)', border: '1px solid rgba(229,62,62,0.25)' }}>
                          Outstanding Balance
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                      {isAgent && (
                        <>
                          <ViewAsButton targetUserId={profile.id} targetLabel={profile.full_name ?? profile.email} />
                          <button onClick={() => openEditModal(profile)}
                            style={{ fontSize: '0.75rem', padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(192,184,168,0.3)', background: 'none', color: 'var(--silver)', cursor: 'pointer' }}>
                            Edit
                          </button>
                          <button onClick={() => openQrModal(profile)}
                            style={{ fontSize: '0.75rem', padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(0,196,188,0.3)', background: 'none', color: 'var(--teal)', cursor: 'pointer' }}>
                            QR
                          </button>
                          {profile.is_super_agent && (
                            <button onClick={() => setViewingDownlineFor(profile)}
                              style={{ fontSize: '0.75rem', padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(0,196,188,0.3)', background: 'none', color: 'var(--teal)', cursor: 'pointer' }}>
                              Sub-Agents
                            </button>
                          )}
                        </>
                      )}
                      {profile.role === 'researcher' && (
                        <button onClick={() => openAssignModal(profile)}
                          style={{ fontSize: '0.75rem', padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(0,196,188,0.3)', background: 'none', color: 'var(--teal)', cursor: 'pointer' }}>
                          {isHouseOwned(profile) ? 'Assign' : 'Reassign'}
                        </button>
                      )}
                      {!isAgent && profile.role !== 'admin' && (
                        <button onClick={() => openUpgradeModal(profile)}
                          style={{ fontSize: '0.75rem', padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(192,184,168,0.3)', background: 'none', color: 'var(--silver)', cursor: 'pointer' }}>
                          Upgrade
                        </button>
                      )}
                      <button onClick={() => openBalanceModal(profile)}
                        style={{ fontSize: '0.75rem', padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(192,184,168,0.3)', background: 'none', color: 'var(--silver)', cursor: 'pointer' }}>
                        Balance
                      </button>
                      {profile.role !== 'admin' && (
                        <button onClick={() => handleToggleActive(profile)}
                          style={{ fontSize: '0.75rem', padding: '5px 12px', borderRadius: 6, border: `1px solid ${profile.is_active ? 'rgba(229,62,62,0.3)' : 'rgba(0,196,188,0.3)'}`, background: 'none', color: profile.is_active ? 'var(--red)' : 'var(--teal)', cursor: 'pointer' }}>
                          {profile.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </div>
                  </div>
                  {isAgent && (
                    <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--grey-500)', marginBottom: 2 }}>Account Type</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--silver)' }}>
                          {profile.account_type === 'credit' ? 'Credit' : 'Prepaid'}
                        </div>
                      </div>
                      {profile.account_type === 'prepaid' && (
                        <div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--grey-500)', marginBottom: 2 }}>Prepaid Balance</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: profile.prepaid_balance > 0 ? 'var(--teal)' : 'var(--red)', fontFamily: 'var(--font-brand)' }}>
                            ${Number(profile.prepaid_balance || 0).toFixed(2)}
                          </div>
                        </div>
                      )}
                      {profile.account_type === 'credit' && (
                        <div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--grey-500)', marginBottom: 2 }}>Credit Limit</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--silver)', fontFamily: 'var(--font-brand)' }}>
                            ${Number(profile.credit_limit || 0).toFixed(2)}
                          </div>
                        </div>
                      )}
                      {profile.custom_markup_override != null && (
                        <div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--grey-500)', marginBottom: 2 }}>Custom Markup</div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--teal)' }}>
                            {Math.round(profile.custom_markup_override * 100)}%
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* CREATE AGENT / RESEARCHER MODAL */}
      {modalMode === 'create_agent' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 'var(--space-4)' }}>
          <div className="hover-lift stagger-fade-in" style={{ borderRadius: 24, padding: 'var(--space-6)', background: 'linear-gradient(180deg, #131b24 0%, #0a0f14 100%)', boxShadow: '0 0 0 2px #5d6166, 0 0 0 4px #b9bdc2, 0 0 0 6px #6c7075, inset 0 1px 0 rgba(255,255,255,0.10), 0 30px 90px rgba(0,0,0,0.85), 0 6px 28px rgba(160,168,176,0.14)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="" style={{ padding: 'var(--space-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <h2 style={{ fontSize: '1.2rem' }}>
                {createRole === 'researcher' ? 'Create Researcher Account' : 'Create Agent Account'}
              </h2>
              <button type="button" onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--grey-400)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginBottom: 'var(--space-5)' }}>
              {createRole === 'researcher'
                ? 'Creates A New Researcher Account And Assigns Them To An Agent.'
                : 'Creates A New Agent With A Full Storefront Configuration.'}
            </p>

            {modalError && (
              <div className="disclaimer-warning" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
                <p style={{ color: 'var(--red)', fontSize: '0.82rem' }}>{modalError}</p>
              </div>
            )}

            <form onSubmit={createRole === 'researcher' ? handleCreateResearcher : handleCreateAgent}>
              {/* Role Toggle */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)', background: 'var(--black-2)', padding: 4, borderRadius: 'var(--radius-md)', border: 'var(--border-subtle)' }}>
                {(['agent', 'researcher'] as const).map(r => (
                  <button key={r} type="button" onClick={() => setCreateRole(r)}
                    style={{ flex: 1, padding: '8px 0', fontSize: '0.82rem', fontWeight: 600, color: createRole === r ? '#fff' : 'var(--grey-400)', background: createRole === r ? 'var(--teal)' : 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                    {r === 'agent' ? 'Agent' : 'Researcher'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group" style={{ marginTop: 0 }}>
                  <label className="form-label">First Name</label>
                  <input type="text" className="form-input" placeholder="First Name" value={newFirstName}
                    onChange={e => {
                      setNewFirstName(e.target.value);
                    }} required />
                </div>
                <div className="form-group" style={{ marginTop: 0 }}>
                  <label className="form-label">Last Name</label>
                  <input type="text" className="form-input" placeholder="Last Name" value={newLastName}
                    onChange={e => setNewLastName(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Login Username</label>
                <input type="text" className="form-input" placeholder="E.g. john_doe (Login Handle)" value={newUsername}
                  onChange={e => { setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setUsernameDirty(true); }} required autoComplete="new-password" />
                {newUsernameMsg && (
                  <p style={{ fontSize: '0.72rem', marginTop: 4, color: newUsernameMsg.color }}>
                    {newUsernameMsg.text}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Temporary Password</label>
                <input type="password" className="form-input" placeholder="Set Initial Password" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
              </div>

              {createRole === 'researcher' && (
                <div className="form-group">
                  <label className="form-label">Assign To Agent (Account Owner)</label>
                  <select className="form-input" value={newParentAgentId} onChange={e => setNewParentAgentId(e.target.value)} required>
                    <option value="">Select Agent...</option>
                    {profiles.filter(p => p.role === 'agent' || p.role === 'super_agent').map(a => (
                      <option key={a.id} value={a.id}>{a.full_name || a.email}</option>
                    ))}
                  </select>
                </div>
              )}

              {createRole === 'agent' && (
              <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                <div className="form-group" style={{ marginTop: 0 }}>
                  <label className="form-label">Pricing Tier</label>
                  <select className="form-input" value={newTier} onChange={e => setNewTier(e.target.value as any)} required>
                    <option value="tier_1">Tier 1 - Best Pricing</option>
                    <option value="tier_2">Tier 2 - Standard Pricing</option>
                    <option value="tier_3">Tier 3 - Entry Pricing</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginTop: 0 }}>
                  <label className="form-label">Billing Account Mode</label>
                  <select className="form-input" value={newAccountType} onChange={e => setNewAccountType(e.target.value as any)} required>
                    <option value="prepaid">Prepaid</option>
                    <option value="credit">Credit (Weekly Statement)</option>
                  </select>
                </div>
              </div>
              {newAccountType === 'credit' ? (
                <div className="form-group">
                  <label className="form-label">Credit Limit ($)</label>
                  <input type="number" className="form-input" placeholder="E.g. 5000" value={newCreditLimit}
                    onChange={e => setNewCreditLimit(e.target.value)} required min="0" />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Initial Prepaid Balance ($)</label>
                  <input type="number" className="form-input" placeholder="E.g. 1000" value={newPrepaidBalance}
                    onChange={e => setNewPrepaidBalance(e.target.value)} min="0" />
                </div>
              )}

              <div style={{ marginBottom: 'var(--space-6)' }}></div>

              <h4 style={{ fontSize: '0.88rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>Storefront Setup</h4>
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Display Name (Optional)</label>
                <input type="text" className="form-input" placeholder={`Defaults to Username (${newUsername || '...'})`} value={newDisplayName}
                  onChange={e => setNewDisplayName(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Storefront Slug (URL) (Optional)</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: 'var(--grey-500)', marginRight: 4, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>pepnationlab.com/</span>
                  <input type="text" className="form-input" placeholder={`Defaults to Username (${newUsername.toLowerCase().replace(/[^a-z0-9\-]/g, '') || '...'})`} value={newSlug}
                    onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, ''))} />
                </div>
              </div>

              </>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '0.85rem', color: 'var(--silver)', marginBottom: 'var(--space-6)' }}>
                <input type="checkbox" checked style={inputStyle} disabled />
                <span style={{ color: 'var(--grey-400)' }}>
                  {createRole === 'researcher'
                    ? 'Researcher Will Log In With Their Username - You Set It Above'
                    : 'Agent Will Log In With Their Username - You Set It Above'}
                </span>
              </label>

              <div style={{ position: 'sticky', bottom: 0, display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingTop: 'var(--space-4)', paddingBottom: 'var(--space-2)', marginTop: 'var(--space-2)', background: 'var(--surface-1, #0F1923)', }}>
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
                        ? 'Checking Username...'
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 'var(--space-4)' }}>
          <div className="hover-lift stagger-fade-in" style={{ borderRadius: 24, padding: 'var(--space-6)', background: 'linear-gradient(180deg, #131b24 0%, #0a0f14 100%)', boxShadow: '0 0 0 2px #5d6166, 0 0 0 4px #b9bdc2, 0 0 0 6px #6c7075, inset 0 1px 0 rgba(255,255,255,0.10), 0 30px 90px rgba(0,0,0,0.85), 0 6px 28px rgba(160,168,176,0.14)', width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="" style={{ padding: 'var(--space-2)' }}>
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
                        <option value="tier_1">Tier 1 - Best Pricing</option>
                        <option value="tier_2">Tier 2 - Standard Pricing</option>
                        <option value="tier_3">Tier 3 - Entry Pricing</option>
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
                  <div style={{ marginBottom: 'var(--space-6)' }}></div>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>Agent Storefront Configuration</h4>
                  <div className="form-group">
                    <label className="form-label">Display Name</label>
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
                  {submitting ? 'Saving...' : modalMode === 'upgrade' ? 'Upgrade To Agent' : 'Save Changes'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* BALANCE MODAL */}
      {modalMode === 'balance' && selectedProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 'var(--space-4)' }}>
          <div className="hover-lift stagger-fade-in" style={{ borderRadius: 24, padding: 'var(--space-6)', background: 'linear-gradient(180deg, #131b24 0%, #0a0f14 100%)', boxShadow: '0 0 0 2px #5d6166, 0 0 0 4px #b9bdc2, 0 0 0 6px #6c7075, inset 0 1px 0 rgba(255,255,255,0.10), 0 30px 90px rgba(0,0,0,0.85), 0 6px 28px rgba(160,168,176,0.14)', width: '100%', maxWidth: 420 }}>
            <div className="" style={{ padding: 'var(--space-2)' }}>
              <h2 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-2)' }}>Adjust Prepaid Balance</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginBottom: 'var(--space-5)' }}>
                {selectedProfile.full_name} - Current Balance: <strong style={{ color: 'var(--teal)' }}>${Number(selectedProfile.prepaid_balance || 0).toFixed(2)}</strong>
              </p>
              {modalError && (
                <div className="disclaimer-warning" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
                  <p style={{ color: 'var(--red)', fontSize: '0.82rem' }}>{modalError}</p>
                </div>
              )}
              {modalSuccess && (
                <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: 'rgba(0,196,188,0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,196,188,0.25)' }}>
                  <p style={{ color: 'var(--teal)', fontSize: '0.82rem' }}>{modalSuccess}</p>
                </div>
              )}
              <form onSubmit={handleBalanceSubmit}>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                  {(['add', 'deduct'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setBalanceType(t)}
                      style={{ flex: 1, padding: 'var(--space-3)', fontSize: '0.85rem', fontWeight: 600, color: balanceType === t ? '#fff' : 'var(--grey-400)', background: balanceType === t ? (t === 'add' ? 'var(--teal)' : 'var(--red)') : 'var(--black-2)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                      {t === 'add' ? 'Add Funds' : 'Deduct Funds'}
                    </button>
                  ))}
                </div>
                <div className="form-group">
                  <label className="form-label">Amount ($)</label>
                  <input type="number" className="form-input" placeholder="Enter Amount" value={balanceDelta}
                    onChange={e => setBalanceDelta(e.target.value)} required min="0.01" step="0.01" autoFocus />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
                  <button type="button" className="btn-silver" onClick={closeModal} disabled={submitting}>Cancel</button>
                  <button type="submit" className={balanceType === 'add' ? 'btn-neon-cyan' : 'btn-danger'} disabled={submitting}>
                    {submitting ? 'Updating...' : balanceType === 'add' ? 'Add Funds' : 'Deduct Funds'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* QR CODE MODAL */}
      {modalMode === 'qr' && selectedProfile && (() => {
        const ap = Array.isArray(selectedProfile.agent_profiles) ? selectedProfile.agent_profiles[0] : selectedProfile.agent_profiles;
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 'var(--space-4)' }}>
            <div className="hover-lift stagger-fade-in" style={{ borderRadius: 24, padding: 'var(--space-6)', background: 'linear-gradient(180deg, #131b24 0%, #0a0f14 100%)', boxShadow: '0 0 0 2px #5d6166, 0 0 0 4px #b9bdc2, 0 0 0 6px #6c7075, inset 0 1px 0 rgba(255,255,255,0.10), 0 30px 90px rgba(0,0,0,0.85)', width: '100%', maxWidth: 400, textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-2)' }}>Agent QR Code</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginBottom: 'var(--space-5)' }}>
                {ap?.display_name || selectedProfile.full_name}
              </p>
              {ap?.qr_code_url ? (
                <Image src={ap.qr_code_url} alt="QR Code" width={200} height={200} style={{ borderRadius: 12, margin: '0 auto var(--space-4)' }} />
              ) : (
                <p style={{ color: 'var(--grey-400)', marginBottom: 'var(--space-4)' }}>No QR Code Generated Yet</p>
              )}
              {ap?.slug && (
                <p style={{ fontSize: '0.8rem', color: 'var(--grey-500)' }}>pepnationlab.com/{ap.slug}</p>
              )}
              <button type="button" className="btn-silver" onClick={closeModal} style={{ marginTop: 'var(--space-5)' }}>Close</button>
            </div>
          </div>
        );
      })()}

      {/* ASSIGN RESEARCHER MODAL */}
      {modalMode === 'assign' && selectedProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 'var(--space-4)' }}>
          <div className="hover-lift stagger-fade-in" style={{ borderRadius: 24, padding: 'var(--space-6)', background: 'linear-gradient(180deg, #131b24 0%, #0a0f14 100%)', boxShadow: '0 0 0 2px #5d6166, 0 0 0 4px #b9bdc2, 0 0 0 6px #6c7075, inset 0 1px 0 rgba(255,255,255,0.10), 0 30px 90px rgba(0,0,0,0.85), 0 6px 28px rgba(160,168,176,0.14)', width: '100%', maxWidth: 460 }}>
            <div style={{ padding: 'var(--space-2)' }}>
              <h2 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-2)' }}>Assign Researcher To An Agent</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginBottom: 'var(--space-5)' }}>
                {selectedProfile.full_name || selectedProfile.username}
                {' - '}Currently Owned By{' '}
                <strong style={{ color: isHouseOwned(selectedProfile) ? 'var(--silver)' : 'var(--teal)' }}>
                  {isHouseOwned(selectedProfile) ? 'House (Admin)' : (selectedProfile.referring_agent_name || 'An Agent')}
                </strong>
              </p>
              {modalError && (
                <div className="disclaimer-warning" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
                  <p style={{ color: 'var(--red)', fontSize: '0.82rem' }}>{modalError}</p>
                </div>
              )}
              <form onSubmit={handleAssignSubmit}>
                <div className="form-group">
                  <label className="form-label">Assign To Agent Or Super Agent</label>
                  <select className="form-input" value={assignAgentId} onChange={e => setAssignAgentId(e.target.value)} required autoFocus>
                    <option value="">Select An Agent...</option>
                    {agentOptions.map(a => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                    {!isHouseOwned(selectedProfile) && (
                      <option value="__HOUSE__">Return To House (Admin)</option>
                    )}
                  </select>
                  <p style={{ fontSize: '0.72rem', color: 'var(--grey-500)', marginTop: 6 }}>
                    Once Assigned, This Researcher Moves To That Agent&apos;s Account And No Longer Appears Under Your House List.
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
                  <button type="button" className="btn-silver" onClick={closeModal} disabled={submitting}>Cancel</button>
                  <button type="submit" className="btn-neon-cyan" disabled={submitting || !assignAgentId}>
                    {submitting ? 'Assigning...' : 'Assign Researcher'}
                  </button>
                </div>
              </form>
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
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-16)' }}><div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /></div>}>
      <ResearchersAdminPageInner />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Suspense>
  );
}
