'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface AgentProfile {
  id: string;
  slug: string;
  display_name: string;
  tagline: string | null;
  bio: string | null;
  qr_code_url: string | null;
  logo_url: string | null;
}

interface Profile {
  id: string;
  email: string;
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

export default function ResearchersAdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'researchers' | 'agents' | 'admins'>('researchers');

  // Modal State
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [modalMode, setModalMode] = useState<'upgrade' | 'edit' | 'qr' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Form Fields
  const [formRole, setFormRole] = useState<'agent' | 'super_agent' | 'researcher'>('agent');
  const [formTier, setFormTier] = useState<'tier_1' | 'tier_2' | 'tier_3'>('tier_2');
  const [formAccountType, setFormAccountType] = useState<'credit' | 'prepaid'>('prepaid');
  const [formCreditLimit, setFormCreditLimit] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formTagline, setFormTagline] = useState('');
  const [formBio, setFormBio] = useState('');

  useEffect(() => {
    fetchProfiles();
  }, []);

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
    
    // Optimistic UI update
    setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, is_active: nextActive } : p));

    try {
      const res = await fetch('/api/admin/researchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: profile.id, role: profile.role, is_active: nextActive }),
      });
      if (!res.ok) {
        // Rollback on error
        setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, is_active: profile.is_active } : p));
        const json = await res.json();
        alert(json.error || 'Failed To Toggle Account Status');
      }
    } catch (err: any) {
      setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, is_active: profile.is_active } : p));
      alert(err.message || 'Network Error Occurred');
    }
  }

  function openUpgradeModal(profile: Profile) {
    setSelectedProfile(profile);
    setModalMode('upgrade');
    setModalError('');
    setFormRole('agent');
    setFormTier('tier_2');
    setFormAccountType('prepaid');
    setFormCreditLimit('');
    setFormSlug((profile.full_name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, ''));
    setFormDisplayName(profile.full_name || '');
    setFormTagline('');
    setFormBio('');
  }

  function openEditModal(profile: Profile) {
    setSelectedProfile(profile);
    setModalMode('edit');
    setModalError('');
    setFormRole(profile.role === 'super_agent' ? 'super_agent' : 'agent');
    setFormTier(profile.tier || 'tier_2');
    setFormAccountType(profile.account_type || 'prepaid');
    setFormCreditLimit(profile.credit_limit ? String(profile.credit_limit) : '');
    
    // Resolve single or first agent profile
    const ap = Array.isArray(profile.agent_profiles) 
      ? profile.agent_profiles[0] 
      : profile.agent_profiles;

    setFormSlug(ap?.slug || '');
    setFormDisplayName(ap?.display_name || profile.full_name || '');
    setFormTagline(ap?.tagline || '');
    setFormBio(ap?.bio || '');
  }

  function openQrModal(profile: Profile) {
    setSelectedProfile(profile);
    setModalMode('qr');
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfile) return;
    setSubmitting(true);
    setModalError('');

    try {
      const payload = {
        id: selectedProfile.id,
        role: formRole,
        tier: formTier,
        account_type: formAccountType,
        credit_limit: formAccountType === 'credit' ? Number(formCreditLimit) : null,
        slug: formSlug,
        display_name: formDisplayName,
        tagline: formTagline,
        bio: formBio,
      };

      const res = await fetch('/api/admin/researchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        // Refresh local data
        await fetchProfiles();
        setModalMode(null);
        setSelectedProfile(null);
      } else {
        setModalError(json.error || 'Failed To Complete Operation');
      }
    } catch (err: any) {
      setModalError(err.message || 'An Error Occurred During Submission');
    } finally {
      setSubmitting(false);
    }
  }

  // Filtered lists
  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = 
      (p.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.phone || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (activeTab === 'researchers') return p.role === 'researcher';
    if (activeTab === 'agents') return p.role === 'agent' || p.role === 'super_agent';
    if (activeTab === 'admins') return p.role === 'admin';
    return true;
  });

  const resolvedAgentProfile = selectedProfile
    ? (Array.isArray(selectedProfile.agent_profiles) 
        ? selectedProfile.agent_profiles[0] 
        : selectedProfile.agent_profiles)
    : null;

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>
            Researchers & <span style={{ color: 'var(--teal)' }}>Agents</span>
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
            Manage Qualified Research Accounts, Account Toggles, Role Upgrades, And Pricing Tiers
          </p>
        </div>
      </div>

      {/* Tabs & Search */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)'
      }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', background: 'var(--black-2)', padding: 4, borderRadius: 'var(--radius-md)', border: 'var(--border-subtle)' }}>
          {[
            { id: 'researchers', label: 'Researchers', icon: '◎' },
            { id: 'agents', label: 'Agents & Super Agents', icon: '◈' },
            { id: 'admins', label: 'Admins', icon: '⬢' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 'var(--space-2) var(--space-4)',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: activeTab === tab.id ? 'var(--black)' : 'var(--grey-400)',
                background: activeTab === tab.id ? 'var(--teal)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search Name, Email, Or Phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 'var(--space-8)' }}
          />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--grey-500)', fontSize: '0.9rem' }}>🔍</span>
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : error ? (
        <div className="disclaimer-warning" style={{ padding: 'var(--space-6)' }}>
          <p style={{ color: 'var(--red)', fontSize: '0.9rem' }}>{error}</p>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="card-metal" style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.88rem' }}>
            No Matching Profiles Found
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {filteredProfiles.map(profile => {
            const ap = Array.isArray(profile.agent_profiles) 
              ? profile.agent_profiles[0] 
              : profile.agent_profiles;

            return (
              <div key={profile.id} className="card-metal" style={{
                padding: 'var(--space-5)',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 'var(--space-4)',
                opacity: profile.is_active ? 1 : 0.6
              }}>
                {/* Profile info */}
                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: profile.role === 'admin' ? 'var(--red)' : profile.role === 'super_agent' ? '#D69E2E' : 'var(--teal)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    color: 'var(--black)',
                    fontSize: '1rem',
                  }}>
                    {profile.full_name ? profile.full_name[0].toUpperCase() : '?'}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--silver)' }}>
                        {profile.full_name || 'No Name Provided'}
                      </span>
                      <span className="badge" style={{
                        background: profile.role === 'admin' ? 'rgba(229, 62, 62, 0.15)' : profile.role === 'super_agent' ? 'rgba(214, 158, 46, 0.15)' : 'rgba(0, 196, 188, 0.15)',
                        color: profile.role === 'admin' ? 'var(--red)' : profile.role === 'super_agent' ? '#D69E2E' : 'var(--teal)',
                        borderColor: profile.role === 'admin' ? 'var(--red)' : profile.role === 'super_agent' ? '#D69E2E' : 'var(--teal)',
                      }}>
                        {ROLE_LABELS[profile.role] ?? profile.role}
                      </span>
                      {ap?.slug && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)' }}>
                          (@{ap.slug})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginTop: 2 }}>
                      {profile.email} {profile.phone && `• ${profile.phone}`}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--grey-500)', marginTop: 4 }}>
                      Joined {new Date(profile.created_at).toLocaleDateString()} • Disclaimer:{' '}
                      <span style={{ color: profile.disclaimer_v1_accepted ? 'var(--teal)' : 'var(--red)' }}>
                        {profile.disclaimer_v1_accepted ? 'ACCEPTED' : 'PENDING'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status details / Tiers */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-6)' }}>
                  {(profile.role === 'agent' || profile.role === 'super_agent') && (
                    <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase' }}>Pricing Tier</div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--silver)', textTransform: 'capitalize' }}>
                          {profile.tier ? (TIER_LABELS[profile.tier] ?? profile.tier) : 'None'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase' }}>Account Mode</div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--silver)', textTransform: 'capitalize' }}>
                          {profile.account_type === 'credit' ? `Credit (Limit: $${profile.credit_limit || 0})` : 'Prepaid'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    {/* Active/Inactive Toggle */}
                    <button
                      onClick={() => handleToggleActive(profile)}
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        background: profile.is_active ? 'rgba(229, 62, 62, 0.1)' : 'rgba(0, 196, 188, 0.1)',
                        color: profile.is_active ? 'var(--red)' : 'var(--teal)',
                        border: '1px solid currentColor',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                      }}
                    >
                      {profile.is_active ? 'Deactivate' : 'Activate'}
                    </button>

                    {profile.role === 'researcher' ? (
                      <button onClick={() => openUpgradeModal(profile)} className="btn btn-primary" style={{ padding: 'var(--space-2) var(--space-4)', fontSize: '0.78rem' }}>
                        Upgrade To Agent
                      </button>
                    ) : (profile.role === 'agent' || profile.role === 'super_agent') ? (
                      <>
                        <button onClick={() => openEditModal(profile)} className="btn btn-secondary" style={{ padding: 'var(--space-2) var(--space-4)', fontSize: '0.78rem' }}>
                          Configure Profile
                        </button>
                        {ap?.slug && (
                          <button onClick={() => openQrModal(profile)} className="btn btn-secondary" style={{ padding: 'var(--space-2) var(--space-4)', fontSize: '0.78rem', borderColor: 'var(--teal)', color: 'var(--teal)' }}>
                            View QR Code
                          </button>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Modal (Upgrade / Configure Profile) */}
      {(modalMode === 'upgrade' || modalMode === 'edit') && selectedProfile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 'var(--space-4)'
        }}>
          <div className="card-metal" style={{ width: '100%', maxWidth: 540, padding: 'var(--space-6)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>
              {modalMode === 'upgrade' ? 'Upgrade User To Agent' : 'Configure Agent Profile'}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginBottom: 'var(--space-6)' }}>
              {selectedProfile.full_name} ({selectedProfile.email})
            </p>

            {modalError && (
              <div className="disclaimer-warning" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
                <p style={{ color: 'var(--red)', fontSize: '0.82rem' }}>{modalError}</p>
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              {/* Role selection */}
              <div className="form-group">
                <label className="form-label">Account Role Type</label>
                <select
                  className="form-input"
                  value={formRole}
                  onChange={e => setFormRole(e.target.value as any)}
                  required
                >
                  <option value="agent">Agent (Standard)</option>
                  <option value="super_agent">Super Agent (Allows Sub-Agents)</option>
                  {modalMode === 'edit' && <option value="researcher">Researcher (Downgrade)</option>}
                </select>
              </div>

              {formRole !== 'researcher' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    {/* Pricing Tier */}
                    <div className="form-group">
                      <label className="form-label">Pricing Multiplier Tier</label>
                      <select
                        className="form-input"
                        value={formTier}
                        onChange={e => setFormTier(e.target.value as any)}
                        required
                      >
                        <option value="tier_1">Tier 1 — Best Pricing</option>
                        <option value="tier_2">Tier 2 — Standard Pricing</option>
                        <option value="tier_3">Tier 3 — Entry Pricing</option>
                      </select>
                    </div>

                    {/* Account Type */}
                    <div className="form-group">
                      <label className="form-label">Billing Account Mode</label>
                      <select
                        className="form-input"
                        value={formAccountType}
                        onChange={e => setFormAccountType(e.target.value as any)}
                        required
                      >
                        <option value="prepaid">Prepaid (Agent Pays Before Orders Ship)</option>
                        <option value="credit">Credit (Billed Weekly Statement)</option>
                      </select>
                    </div>
                  </div>

                  {/* Credit Limit (Conditional) */}
                  {formAccountType === 'credit' && (
                    <div className="form-group">
                      <label className="form-label">Credit Limit Limit Amount ($)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="E.g. 5000"
                        value={formCreditLimit}
                        onChange={e => setFormCreditLimit(e.target.value)}
                        required
                        min="0"
                      />
                    </div>
                  )}

                  <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: 'var(--space-5) 0' }} />

                  <h4 style={{ fontSize: '0.9rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>
                    Agent Storefront Configuration
                  </h4>

                  {/* Display Name */}
                  <div className="form-group">
                    <label className="form-label">Storefront Display Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="E.g. Pep Nation Orlando"
                      value={formDisplayName}
                      onChange={e => setFormDisplayName(e.target.value)}
                      required
                    />
                  </div>

                  {/* Slug */}
                  <div className="form-group">
                    <label className="form-label">Storefront URL Slug (Lowercase & Hyphens)</label>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ color: 'var(--grey-500)', marginRight: 4, fontSize: '0.85rem' }}>pepnationlab.com/</span>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="E.g. orlando-peps"
                        value={formSlug}
                        onChange={e => setFormSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, ''))}
                        required
                      />
                    </div>
                  </div>

                  {/* Tagline */}
                  <div className="form-group">
                    <label className="form-label">Storefront Tagline Phrase</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="E.g. Elite Research Peptides Delivered Direct"
                      value={formTagline}
                      onChange={e => setFormTagline(e.target.value)}
                    />
                  </div>

                  {/* Bio */}
                  <div className="form-group">
                    <label className="form-label">Agent Storefront Bio</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      placeholder="Write A Brief Description Of The Agent Storefront..."
                      value={formBio}
                      onChange={e => setFormBio(e.target.value)}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                </>
              )}

              {/* Form Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setModalMode(null); setSelectedProfile(null); }}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Processing...' : modalMode === 'upgrade' ? 'Complete Upgrade' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Viewer Modal */}
      {modalMode === 'qr' && selectedProfile && resolvedAgentProfile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 'var(--space-4)'
        }}>
          <div className="card-metal" style={{ width: '100%', maxWidth: 420, padding: 'var(--space-6)', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>
              Storefront QR Code
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginBottom: 'var(--space-6)' }}>
              {resolvedAgentProfile.display_name} (@{resolvedAgentProfile.slug})
            </p>

            {resolvedAgentProfile.qr_code_url ? (
              <div style={{
                background: '#0a1018',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                border: 'var(--border-silver)',
                display: 'inline-block',
                marginBottom: 'var(--space-6)',
                position: 'relative',
                width: 250,
                height: 250
              }}>
                <img
                  src={resolvedAgentProfile.qr_code_url}
                  alt={`${resolvedAgentProfile.display_name} QR Code`}
                  style={{ width: '100%', height: '100%', borderRadius: 'var(--radius-md)' }}
                />
              </div>
            ) : (
              <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: 'var(--space-6)' }}>
                No QR Code Generated Yet
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <a
                href={resolvedAgentProfile.qr_code_url || '#'}
                download={`${resolvedAgentProfile.slug}-qr-code.png`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Open QR Code Image
              </a>
              <a
                href={`/${resolvedAgentProfile.slug}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Visit Storefront Link
              </a>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setModalMode(null); setSelectedProfile(null); }}
                style={{ marginTop: 'var(--space-2)' }}
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
