'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export default function AdminAgents() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State — Edit Contact
  const [editingAgent, setEditingAgent] = useState<any | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Modal State — Create Agent
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: '',
    username: '',
    password: '',
    tier: 'tier_3',
    account_type: 'prepaid',
    credit_limit: '',
    prepaid_balance: '',
    slug: '',
    display_name: '',
    tagline: '',
    bio: '',
    account_role: 'agent',
    parent_agent_id: '',
  });
  const [isCreating, setIsCreating] = useState(false);

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
          .eq('username', clean)
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
    setIsCreating(true);
    try {
      const res = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          username: createForm.username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
          slug: createForm.slug.toLowerCase().replace(/[^a-z0-9-]/g, ''),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed To Create Agent');
      toast.success(`${createForm.account_role === 'researcher' ? 'Researcher' : 'Agent'} "${createForm.full_name}" Created Successfully`);
      setShowCreateModal(false);
      setCreateForm({
        full_name: '',
        username: '',
        password: '',
        tier: 'tier_3',
        account_type: 'prepaid',
        credit_limit: '',
        prepaid_balance: '',
        slug: '',
        display_name: '',
        tagline: '',
        bio: '',
        account_role: 'agent',
        parent_agent_id: '',
      });
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

  const openEditModal = (agent: any) => {
    setEditingAgent(agent);
    setEditEmail(agent.email?.includes('@pepnationlab.com') ? '' : (agent.email || ''));
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
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          + Create New Agent
        </button>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Agent ID</th>
              <th>Name</th>
              <th>Contact Info</th>
              <th>Tier</th>
              <th>Type</th>
              <th>Hierarchy</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
              <th>Storefront</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', opacity: 0.5 }}>No agents found.</td>
              </tr>
            ) : (
              agents.map(agent => {
                const isDefaultEmail = agent.email?.includes('@pepnationlab.com');
                return (
                  <tr key={agent.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--silver)' }}>{agent.id.split('-')[0]}</td>
                    <td style={{ fontWeight: 'bold' }}>{agent.full_name}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                        {isDefaultEmail ? (
                          <button onClick={() => openEditModal(agent)} className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: '0.7rem' }}>
                            + Add Email
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.85rem' }}>{agent.email}</span>
                        )}
                        
                        {agent.phone ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--silver)' }}>{agent.phone}</span>
                        ) : (
                          <button onClick={() => openEditModal(agent)} className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: '0.7rem', opacity: 0.7 }}>
                            + Add Phone
                          </button>
                        )}
                        
                        {(!isDefaultEmail || agent.phone) && (
                          <button onClick={() => openEditModal(agent)} style={{ fontSize: '0.7rem', color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', marginTop: 2 }}>
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: '0.75rem',
                        background: 'rgba(0,196,188,0.1)',
                        color: 'var(--teal)'
                      }}>
                        {agent.tier?.toUpperCase() || 'TIER_3'}
                      </span>
                    </td>
                    <td>{agent.account_type === 'prepaid' ? 'Prepaid' : 'Credit'}</td>
                    <td>
                      {agent.is_super_agent ? (
                        <span style={{ color: 'var(--teal)', fontWeight: 'bold', fontSize: '0.8rem' }}>SUPER AGENT</span>
                      ) : agent.parent_agent_id ? (
                        <span style={{ color: 'var(--silver)', fontSize: '0.8rem' }}>Sub-Agent</span>
                      ) : (
                        <span style={{ color: 'var(--grey-400)', fontSize: '0.8rem' }}>Standard</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: Number(agent.prepaid_balance) < 0 ? 'var(--red)' : 'var(--green)' }}>
                      {formatCurrency(agent.prepaid_balance)}
                    </td>
                    <td>
                      {agent.agent_profiles?.[0]?.slug ? (
                        <a href={`/${agent.agent_profiles[0].slug}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', textDecoration: 'none' }}>
                          /{agent.agent_profiles[0].slug}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--grey-400)', fontSize: '0.8rem' }}>No storefront</span>
                      )}
                    </td>
                    <td>
                      <span style={{ color: agent.is_active ? 'var(--green)' : 'var(--red)', fontSize: '0.8rem' }}>
                        {agent.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
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
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        disabled={agent.parent_agent_id !== null}
                      >
                        {agent.is_super_agent ? 'Revoke Super' : 'Make Super'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Contact Modal */}
      {editingAgent && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card-metal" style={{ width: '100%', maxWidth: 400, padding: 'var(--space-6)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)', color: 'var(--white)' }}>
              Edit Contact Info
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>
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
                  placeholder={editingAgent.email?.includes('@pepnationlab.com') ? 'Enter real email...' : editingAgent.email}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                <label className="form-label">Phone Number</label>
                <input 
                  type="tel" 
                  className="form-input" 
                  value={editPhone} 
                  onChange={e => setEditPhone(e.target.value)} 
                  placeholder="e.g. 555-0123"
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingAgent(null)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Agent Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--space-4)',
        }}>
          <div className="card-metal" style={{
            width: '100%',
            maxWidth: 520,
            padding: 'var(--space-6)',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-2)', color: 'var(--white)' }}>
              Create New Agent
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--silver)', marginBottom: 'var(--space-5)' }}>
              This will create a new agent account with auth credentials and a storefront.
            </p>
            <form onSubmit={handleCreateAgent}>
              {/* Full Name */}
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={createForm.full_name}
                  onChange={e => handleCreateFormChange('full_name', e.target.value)}
                  placeholder="e.g. John Smith"
                  required
                  style={{ width: '100%' }}
                />
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
                  style={{ width: '100%', textTransform: 'capitalize' }}
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

              {/* Tier & Billing Mode — side by side (agents only) */}
              {createForm.account_role !== 'researcher' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
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

              {/* Tagline */}
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Tagline</label>
                <input
                  type="text"
                  className="form-input"
                  value={createForm.tagline}
                  onChange={e => handleCreateFormChange('tagline', e.target.value)}
                  placeholder="Optional tagline"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Bio */}
              <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Bio</label>
                <textarea
                  className="form-input"
                  value={createForm.bio}
                  onChange={e => handleCreateFormChange('bio', e.target.value)}
                  placeholder="Optional agent bio"
                  rows={3}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
              </>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
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
                  className="btn btn-primary"
                  disabled={isCreating || usernameStatus === 'taken' || (createForm.account_role !== 'researcher' && slugStatus === 'taken')}
                >
                  {isCreating ? 'Creating...' : createForm.account_role === 'researcher' ? 'Create Researcher' : 'Create Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
