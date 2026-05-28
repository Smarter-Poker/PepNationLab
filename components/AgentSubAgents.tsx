'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { pickOne } from '@/lib/relations';

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
  // Controlled inputs per product — keyed by product id.
  const [costInputs, setCostInputs] = useState<Record<string, string>>({});
  const [bulkCostInputs, setBulkCostInputs] = useState<Record<string, string>>({});
  const [bulkThreshInputs, setBulkThreshInputs] = useState<Record<string, string>>({});

  // Password Reset State
  const [resetPwUser, setResetPwUser] = useState<{ id: string; name: string; username: string } | null>(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [resetPwSaving, setResetPwSaving] = useState(false);

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
      const items = json.data || [];
      setProducts(items);
      // Seed controlled inputs from server values.
      const cost: Record<string, string> = {};
      const bulkCost: Record<string, string> = {};
      const bulkThresh: Record<string, string> = {};
      for (const p of items) {
        cost[p.id] = p.baseline_cost != null ? String(p.baseline_cost) : '';
        bulkCost[p.id] = p.bulk_baseline_cost != null ? String(p.bulk_baseline_cost) : '';
        bulkThresh[p.id] = p.bulk_threshold != null ? String(p.bulk_threshold) : '100';
      }
      setCostInputs(cost);
      setBulkCostInputs(bulkCost);
      setBulkThreshInputs(bulkThresh);
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
      toast.success('Weekly Invoice generated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate invoice');
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    try {
      const res = await fetch('/api/agent/super-agent/invoices/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to mark paid');
      fetchData();
      toast.success('Invoice marked as paid!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark invoice as paid');
    }
  };

  const handleSavePricing = async (productId: string, baselineCost: string, bulkCostStr: string, bulkThreshStr: string) => {
    try {
      setPricingError(null);
      setPricingSuccess(null);
      const cost = parseFloat(baselineCost);
      if (isNaN(cost) || cost < 0) throw new Error('Invalid cost value');
      
      const bulkCost = bulkCostStr ? parseFloat(bulkCostStr) : null;
      const bulkThreshold = bulkThreshStr ? parseInt(bulkThreshStr, 10) : 100;

      const res = await fetch('/api/agent/super-agent/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          product_id: productId, 
          baseline_cost: cost,
          bulk_baseline_cost: bulkCost,
          bulk_threshold: bulkThreshold
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save pricing');
      
      toast.success('Baseline Pricing updated successfully!');
      fetchPricing(); // Refresh
    } catch (err: any) {
      toast.error(err.message || 'Failed to save pricing');
    }
  };

  const formatCurrency = (val: number) => `$${(Number(val) || 0).toFixed(2)}`;

  if (loading) return <div style={{ color: 'var(--silver)' }}>Loading Sub-Agents...</div>;
  if (error) return <div style={{ color: 'var(--red)' }}>Error: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {/* Sub-Agents List */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--white)', fontFamily: 'var(--font-brand)' }}>
              My Sub-Agents
            </h2>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginTop: 4 }}>
              Agents You Have Promoted. They Bill Their Downline Directly, And You Collect Their Balances.
            </p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              fetchPricing();
              setShowPricingModal(true);
            }}
          >
            Manage Baseline Pricing
          </button>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Agent Name</th>
                <th>Credentials</th>
                <th>Status</th>
                <th>Storefront</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subAgents.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', opacity: 0.5 }}>No Sub-Agents Found.</td>
                </tr>
              ) : (
                subAgents.map(agent => (
                  <tr key={agent.id}>
                    <td style={{ fontWeight: 'bold' }}>{agent.full_name || 'Anonymous'}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--teal)' }}>{agent.username || agent.email}</span>
                        <button
                          onClick={() => setResetPwUser({ id: agent.id, name: agent.full_name || 'Sub-Agent', username: agent.username || agent.email })}
                          style={{ fontSize: '0.7rem', color: 'var(--grey-400)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textAlign: 'left' }}
                        >
                          Edit Password
                        </button>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: agent.is_active ? 'var(--green)' : 'var(--red)', fontSize: '0.8rem' }}>
                        {agent.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {(() => {
                        const ap = pickOne<{ slug: string | null }>(agent.agent_profiles);
                        return ap?.slug ? (
                          <a href={`/${ap.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', textDecoration: 'none' }}>
                            /{ap.slug}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--grey-400)', fontSize: '0.8rem' }}>No Storefront</span>

                        );
                      })()}
                    </td>
                    <td style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleGenerateInvoice(agent.id)}
                      >
                        Generate Weekly Invoice
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
            <p>No Invoices Generated Yet. Click Generate Below An Agent To Bill Them For This Week.</p>
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
                      {inv.status !== 'paid' && (
                        <button 
                          onClick={() => handleMarkPaid(inv.id)} 
                          className="btn btn-primary btn-sm" 
                          style={{ marginLeft: 12, padding: '2px 8px', fontSize: '0.75rem' }}
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pricing Modal */}
      <AnimatePresence>
        {showPricingModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPricingModal(false)} 
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, padding: 'var(--space-6)', backdropFilter: 'blur(8px)'
            }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()} 
              className="card-metal"
              style={{
                padding: 'var(--space-7)', maxWidth: 850, width: '100%',
                maxHeight: '90vh', overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
                <div>
                  <h3 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-brand)', color: 'var(--white)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Baseline Pricing (Applies To All Sub-Agents)</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginTop: 4 }}>
                    Set The Fixed Wholesale Cost That Your Sub-Agents Will Pay You For Each Product. These Rules Apply Globally Across All Sub-Agents.
                  </p>
                </div>
                <button onClick={() => setShowPricingModal(false)} className="btn btn-secondary">Close</button>
              </div>

            {loadingPricing ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>Loading Products...</div>
            ) : (
              <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Your Cost (Admin)</th>
                    <th>Sub-Agent Cost (Baseline)</th>
                    <th>Bulk Threshold (Qty)</th>
                    <th>Bulk Sub-Agent Cost</th>
                    <th style={{ textAlign: 'right' }}>Save</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(prod => {
                    const yourCost = Number(prod.admin_cost).toFixed(2);
                    const costVal = costInputs[prod.id] ?? '';
                    const bulkThreshVal = bulkThreshInputs[prod.id] ?? '100';
                    const bulkCostVal = bulkCostInputs[prod.id] ?? '';
                    return (
                      <tr key={prod.id}>
                        <td style={{ fontWeight: 'bold' }}>{prod.name}</td>
                        <td style={{ color: 'var(--grey-400)' }}>${yourCost}</td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: 120, padding: '6px 12px' }}
                            value={costVal}
                            onChange={e => setCostInputs(prev => ({ ...prev, [prod.id]: e.target.value }))}
                            placeholder="Set Cost..."
                            step="0.01"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: 80, padding: '6px' }}
                            value={bulkThreshVal}
                            onChange={e => setBulkThreshInputs(prev => ({ ...prev, [prod.id]: e.target.value }))}
                            placeholder="100"
                            min="1"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: 100, padding: '6px' }}
                            value={bulkCostVal}
                            onChange={e => setBulkCostInputs(prev => ({ ...prev, [prod.id]: e.target.value }))}
                            placeholder="Optional"
                            step="0.01"
                            min="0"
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              if (costVal) handleSavePricing(prod.id, costVal, bulkCostVal, bulkThreshVal);
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      {resetPwUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card-metal" style={{ width: '100%', maxWidth: 400, padding: 'var(--space-6)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)', color: 'var(--white)' }}>Reset Sub-Agent Password</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--silver)', marginBottom: 'var(--space-2)' }}>
              Agent: <strong style={{ color: 'var(--white)' }}>{resetPwUser.name}</strong>
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>
              Username: <strong style={{ color: 'var(--teal)', fontFamily: 'monospace' }}>{resetPwUser.username}</strong>
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!resetPwUser || !resetPwValue) return;
              setResetPwSaving(true);
              try {
                const res = await fetch('/api/agent/update-password', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: resetPwUser.id, newPassword: resetPwValue }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);
                toast.success('Password Updated Successfully');
                setResetPwUser(null);
                setResetPwValue('');
              } catch (err: any) {
                toast.error(err.message || 'Failed To Update Password');
              } finally {
                setResetPwSaving(false);
              }
            }}>
              <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                <label className="form-label">New Password</label>
                <input
                  type="text"
                  className="form-input"
                  value={resetPwValue}
                  onChange={e => setResetPwValue(e.target.value)}
                  placeholder="Minimum 8 Characters"
                  required
                  minLength={8}
                  autoComplete="off"
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setResetPwUser(null); setResetPwValue(''); }} disabled={resetPwSaving}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={resetPwSaving || resetPwValue.length < 8}>
                  {resetPwSaving ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
