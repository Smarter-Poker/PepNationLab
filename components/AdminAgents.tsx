'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

export default function AdminAgents() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [editingAgent, setEditingAgent] = useState<any | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
      
      toast.success('Contact info updated successfully');
      setEditingAgent(null);
      fetchAgents();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update contact info');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div style={{ color: 'var(--silver)' }}>Loading agents...</div>;
  if (error) return <div style={{ color: 'var(--red)' }}>Error: {error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--white)', fontFamily: 'var(--font-brand)' }}>
          Manage Agents
        </h1>
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
                            toast.success(agent.is_super_agent ? 'Super Agent status revoked' : 'Promoted to Super Agent');
                            fetchAgents(); // refresh
                          } catch (err: any) {
                            toast.error(err.message || 'Failed to update super agent status');
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
    </div>
  );
}
