'use client';

import React, { useState, useEffect } from 'react';

export default function AgentSubAgents({ agentId }: { agentId?: string }) {

  const [subAgents, setSubAgents] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pricing Modal State
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [pricingSuccess, setPricingSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [agentsRes, invoicesRes] = await Promise.all([
        fetch('/api/agent/sub-agents'),
        fetch('/api/agent/super-agent/invoices')
      ]);
      const agentsJson = await agentsRes.json();
      const invoicesJson = await invoicesRes.json();
      
      if (!agentsRes.ok) throw new Error(agentsJson.error || 'Failed to fetch sub-agents');
      if (!invoicesRes.ok) throw new Error(invoicesJson.error || 'Failed to fetch invoices');
      
      setSubAgents(agentsJson.data || []);
      setInvoices(invoicesJson.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPricing = async () => {
    try {
      setLoadingPricing(true);
      const res = await fetch('/api/agent/super-agent/pricing');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch pricing');
      setProducts(json.data || []);
    } catch (err: any) {
      setPricingError(err.message);
    } finally {
      setLoadingPricing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [agentId]);

  const handleGenerateInvoice = async (subAgentId: string) => {
    try {
      // Create a week string for Monday of the current week
      const date = new Date();
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      date.setDate(diff);
      const weekStart = date.toISOString().split('T')[0];

      const res = await fetch('/api/agent/super-agent/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sub_agent_id: subAgentId, week_start: weekStart })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to generate invoice');
      fetchData();
      alert('Invoice generated successfully!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSavePricing = async (productId: string, baselineCost: string) => {
    try {
      setPricingError(null);
      setPricingSuccess(null);
      const cost = parseFloat(baselineCost);
      if (isNaN(cost) || cost < 0) throw new Error('Invalid cost value');

      const res = await fetch('/api/agent/super-agent/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, baseline_cost: cost })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save pricing');
      
      setPricingSuccess('Pricing updated successfully');
      fetchPricing(); // Refresh
      setTimeout(() => setPricingSuccess(null), 3000);
    } catch (err: any) {
      setPricingError(err.message);
    }
  };

  const formatCurrency = (val: number) => `$${(Number(val) || 0).toFixed(2)}`;

  if (loading) return <div style={{ color: 'var(--silver)' }}>Loading sub-agents...</div>;
  if (error) return <div style={{ color: 'var(--red)' }}>Error: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {/* Sub-Agents List */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--white)', fontFamily: 'var(--font-brand)' }}>
              My Sub-Agents
            </h2>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginTop: 4 }}>
              Agents you have promoted. They bill their downline directly, and you collect their balances.
            </p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Agent Name</th>
                <th>Username/Email</th>
                <th>Status</th>
                <th>Storefront</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subAgents.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', opacity: 0.5 }}>No sub-agents found.</td>
                </tr>
              ) : (
                subAgents.map(agent => (
                  <tr key={agent.id}>
                    <td style={{ fontWeight: 'bold' }}>{agent.full_name || 'Anonymous'}</td>
                    <td>{agent.username || agent.email}</td>
                    <td>
                      <span style={{ color: agent.is_active ? 'var(--green)' : 'var(--red)', fontSize: '0.8rem' }}>
                        {agent.is_active ? 'Active' : 'Inactive'}
                      </span>
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
                    <td style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => handleGenerateInvoice(agent.id)}
                      >
                        Generate Weekly Invoice
                      </button>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => {
                          fetchPricing();
                          setShowPricingModal(true);
                        }}
                      >
                        Manage Baseline Pricing
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Invoices */}
      <section>
        <h2 style={{ fontSize: '1.25rem', color: 'var(--white)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)' }}>
          Sub-Agent Invoices
        </h2>
        {invoices.length === 0 ? (
          <div className="card-metal" style={{ padding: 'var(--space-8)', textAlign: 'center', opacity: 0.7 }}>
            <p>No invoices generated yet. Click Generate below an agent to bill them for this week.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sub-Agent</th>
                  <th>Week Start</th>
                  <th>Total Owed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 'bold' }}>{inv.profiles?.full_name || 'Anonymous'}</td>
                    <td>{new Date(inv.week_start).toLocaleDateString()}</td>
                    <td style={{ color: 'var(--teal)', fontWeight: 'bold' }}>{formatCurrency(inv.total_owed)}</td>
                    <td>
                      <span className={`badge ${inv.status === 'paid' ? 'badge-teal' : 'badge-gold'}`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pricing Modal */}
      {showPricingModal && (
        <div onClick={() => setShowPricingModal(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 'var(--space-6)', backdropFilter: 'blur(4px)'
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--grey-900)', border: '1px solid rgba(0,196,188,0.25)',
            borderRadius: 16, padding: 'var(--space-7)', maxWidth: 800, width: '100%',
            maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 0 60px rgba(0,196,188,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-brand)', color: 'var(--white)' }}>Baseline Pricing Rules</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginTop: 4 }}>
                  Set the fixed wholesale cost that your Sub-Agents will pay you for each product.
                </p>
              </div>
              <button onClick={() => setShowPricingModal(false)} className="btn btn-secondary">Close</button>
            </div>

            {pricingError && <div style={{ background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.3)', borderRadius: 8, padding: 'var(--space-3)', marginBottom: 'var(--space-4)', fontSize: '0.85rem', color: 'var(--red)' }}>{pricingError}</div>}
            {pricingSuccess && <div style={{ background: 'rgba(0,196,188,0.1)', border: '1px solid rgba(0,196,188,0.3)', borderRadius: 8, padding: 'var(--space-3)', marginBottom: 'var(--space-4)', fontSize: '0.85rem', color: 'var(--teal)' }}>{pricingSuccess}</div>}

            {loadingPricing ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>Loading products...</div>
            ) : (
              <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Your Cost (Admin)</th>
                    <th>Sub-Agent Cost (Baseline)</th>
                    <th style={{ textAlign: 'right' }}>Save</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(prod => {
                    const yourCost = Number(prod.admin_cost).toFixed(2);
                    return (
                      <tr key={prod.id}>
                        <td style={{ fontWeight: 'bold' }}>{prod.name}</td>
                        <td style={{ color: 'var(--grey-400)' }}>${yourCost}</td>
                        <td>
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ width: 120, padding: '6px 12px' }}
                            defaultValue={prod.baseline_cost || ''}
                            placeholder="Set Cost..."
                            step="0.01"
                            id={`cost-${prod.id}`}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              const val = (document.getElementById(`cost-${prod.id}`) as HTMLInputElement).value;
                              if (val) handleSavePricing(prod.id, val);
                            }}
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
