'use client';

import React, { useState, useEffect } from 'react';

export default function AdminAgents() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
              <th>Email</th>
              <th>Tier</th>
              <th>Type</th>
              <th>Hierarchy</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
              <th>Storefront</th>
              <th>Status</th>
              <th>Super Agent</th>
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', opacity: 0.5 }}>No agents found.</td>
              </tr>
            ) : (
              agents.map(agent => (
                <tr key={agent.id}>
                  <td style={{ fontSize: '0.8rem', color: 'var(--silver)' }}>{agent.id.split('-')[0]}</td>
                  <td style={{ fontWeight: 'bold' }}>{agent.full_name}</td>
                  <td>{agent.email}</td>
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
                          fetchAgents(); // refresh
                        } catch (err: any) {
                          alert(err.message);
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
