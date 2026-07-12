'use client';

import React, { useState, useEffect } from 'react';
import { SubAgentPricingSchema } from '@/lib/schemas/product';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import Link from 'next/link';
import { pickOne } from '@/lib/relations';
import SubAgentCommissionEditor from './SubAgentCommissionEditor';
import AgentAccountDetail from '@/components/AgentAccountDetail';
import {
  exportCSV,
  downloadCSV,
  printableHTML,
  downloadPrintablePDF,
} from '@/lib/export';

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="tooltip-container">
      {children}
      <span className="tooltip-text">{text}</span>
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function AgentSubAgents({ agentId }: { agentId?: string }) {

  const [subAgents, setSubAgents] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showPricingModal, setShowPricingModal] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [pricingSuccess, setPricingSuccess] = useState<string | null>(null);
  const [costInputs, setCostInputs] = useState<Record<string, string>>({});
  const [bulkCostInputs, setBulkCostInputs] = useState<Record<string, string>>({});
  const [bulkThreshInputs, setBulkThreshInputs] = useState<Record<string, string>>({});

  const [resetPwUser, setResetPwUser] = useState<{ id: string; name: string; username: string } | null>(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [resetPwSaving, setResetPwSaving] = useState(false);

  const [editContactUser, setEditContactUser] = useState<{ id: string; name: string; email: string; phone: string } | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editContactSaving, setEditContactSaving] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);
  const [revoking, setRevoking] = useState(false);

  const [togglingTrust, setTogglingTrust] = useState<string | null>(null);

  const [detailAgent, setDetailAgent] = useState<{ id: string; name: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [agentsRes, invoicesRes] = await Promise.all([
        fetch('/api/agent/sub-agents'),
        fetch('/api/agent/super-agent/invoices')
      ]);
      const agentsJson = await agentsRes.json();
      const invoicesJson = await invoicesRes.json();
      
      if (!agentsRes.ok) throw new Error(agentsJson.error || 'Failed To Fetch Sub-Agents');
      if (!invoicesRes.ok) throw new Error(invoicesJson.error || 'Failed To Fetch Invoices');
      
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
      if (!res.ok) throw new Error(json.error || 'Failed To Fetch Pricing');
      const items = json.data || [];
      setProducts(items);
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
      const date = new Date();
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      date.setDate(diff);
      const weekStart = date.toISOString().split('T')[0];

      const res = await fetch('/api/agent/super-agent/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sub_agent_id: subAgentId, week_start: weekStart })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Generate Invoice');
      fetchData();
      toast.success('Weekly Invoice Generated Successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed To Generate Invoice');
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
      if (!res.ok) throw new Error(json.error || 'Failed To Mark Invoice As Paid');
      fetchData();
      toast.success('Invoice Marked As Paid');
    } catch (err: any) {
      toast.error(err.message || 'Failed To Mark Invoice As Paid');
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await fetch('/api/agent/revoke-subagent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subAgentId: revokeTarget.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Revoke Sub-Agent');
      setRevokeTarget(null);
      await fetchData();
      const detached = typeof json?.detached_researcher_count === 'number'
        ? json.detached_researcher_count
        : 0;
      toast.success(
        detached > 0
          ? `Sub-Agent Revoked. ${detached} Tagged Researcher${detached === 1 ? '' : 's'} Detached.`
          : 'Sub-Agent Revoked.'
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed To Revoke Sub-Agent');
    } finally {
      setRevoking(false);
    }
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
      if (!res.ok) throw new Error(data.error || 'Failed To Update Auto-Approve Setting');
      
      toast.success(data.auto_approve_orders ? 'Auto-Approve Enabled' : 'Auto-Approve Disabled');
      
      setSubAgents(prev => prev.map(a => a.id === targetUserId ? { ...a, auto_approve_orders: data.auto_approve_orders } : a));
    } catch (err: any) {
      toast.error(err.message || 'Failed To Update Auto-Approve Setting');
    } finally {
      setTogglingTrust(null);
    }
  };

  const handleDismissPreviousName = async (subAgentId: string) => {
    try {
      const res = await fetch('/api/agent/sub-agents/dismiss-name', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sub_agent_id: subAgentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed To Dismiss Previous Name');
      
      setSubAgents(prev => prev.map(a => {
        if (a.id === subAgentId && a.agent_profiles) {
          const apArray = Array.isArray(a.agent_profiles) ? a.agent_profiles : [a.agent_profiles];
          return {
            ...a,
            agent_profiles: apArray.map((ap: any) => ({ ...ap, previous_display_name_dismissed: true }))
          };
        }
        return a;
      }));
      toast.success('Previous Name Dismissed');
    } catch (err: any) {
      toast.error(err.message || 'Failed To Dismiss Previous Name');
    }
  };

  const handleSavePricing = async (productId: string, baselineCost: string, bulkCostStr: string, bulkThreshStr: string) => {
    try {
      setPricingError(null);
      setPricingSuccess(null);
      // Schema-locked payload: every field is validated together. Previously
      // only baselineCost had a NaN check; a non-numeric bulk cost/threshold
      // became NaN, which JSON.stringify serializes as null -- silently
      // CLEARING the super-agent billing baseline instead of erroring.
      const parsedPricing = SubAgentPricingSchema.safeParse({
        product_id: productId,
        baseline_cost: parseFloat(baselineCost),
        bulk_baseline_cost: bulkCostStr ? parseFloat(bulkCostStr) : null,
        bulk_threshold: bulkThreshStr ? parseInt(bulkThreshStr, 10) : 100,
      });
      if (!parsedPricing.success) {
        throw new Error('Please Enter Valid Numeric Pricing Values.');
      }

      const res = await fetch('/api/agent/super-agent/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedPricing.data)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Save Pricing');
      
      toast.success('Baseline Pricing Updated Successfully');
      fetchPricing();
    } catch (err: any) {
      toast.error(err.message || 'Failed To Save Pricing');
    }
  };

  const formatCurrency = (val: number) => `$${(Number(val) || 0).toFixed(2)}`;

  async function downloadInvoice(invoiceId: string, format: 'pdf' | 'csv') {
    try {
      const res = await fetch(`/api/agent/super-agent/invoices/${invoiceId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Load Invoice');

      const { invoice, lineItems } = json as {
        invoice: {
          id: string;
          week_start: string;
          week_end: string;
          total_cogs: number | string;
          total_owed: number | string;
          status: string;
          super_agent?: { full_name: string | null; email: string | null } | null;
          sub_agent?: { full_name: string | null; email: string | null } | null;
        };
        lineItems: Array<{ product: string; qty: number; unitCost: number; lineTotal: number }>;
      };

      const superName = invoice.super_agent?.full_name || invoice.super_agent?.email || 'Super Agent';
      const subName = invoice.sub_agent?.full_name || invoice.sub_agent?.email || 'Sub-Agent';
      const total = Number(invoice.total_owed || 0).toFixed(2);
      const datePrinted = new Date().toLocaleDateString();
      const fileStub = `invoice_${subName.replace(/[^a-z0-9]+/gi, '_')}_${invoice.week_start}`;

      if (format === 'csv') {
        const csv = exportCSV(
          lineItems.map((it) => ({
            product: it.product,
            qty: it.qty,
            unit_cost: Number(it.unitCost).toFixed(2),
            line_total: Number(it.lineTotal).toFixed(2),
          })),
          [
            { key: 'product', label: 'Product' },
            { key: 'qty', label: 'Quantity' },
            { key: 'unit_cost', label: 'Unit Cost' },
            { key: 'line_total', label: 'Line Total' },
          ]
        );
        downloadCSV(`${fileStub}.csv`, csv);
        return;
      }

      const rowsHtml = `
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th class="num">Quantity</th>
              <th class="num">Unit Cost</th>
              <th class="num">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${lineItems.length === 0
              ? '<tr><td colspan="4" style="text-align:center;color:#a0aec0;">No Line Items For This Week</td></tr>'
              : lineItems.map((it) => `
                <tr>
                  <td>${escapeHtml(it.product)}</td>
                  <td class="num">${it.qty}</td>
                  <td class="num">$${Number(it.unitCost).toFixed(2)}</td>
                  <td class="num">$${Number(it.lineTotal).toFixed(2)}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>`;

      const headerHtml = `
        <div class="brand">
          <div>
            <h1>Pep Nation Lab</h1>
            <h2>Sub-Agent Weekly Invoice</h2>
          </div>
          <div class="meta">
            <div><strong>Invoice ID:</strong> ${invoice.id.slice(0, 8)}</div>
            <div><strong>Week:</strong> ${invoice.week_start} To ${invoice.week_end}</div>
            <div><strong>Status:</strong> ${invoice.status}</div>
            <div><strong>Printed:</strong> ${datePrinted}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:24px;font-size:11px;">
          <div>
            <div style="font-size:9px;color:#A8B4C0;text-transform:uppercase;letter-spacing:0.05em;">From</div>
            <strong>${escapeHtml(superName)}</strong>
          </div>
          <div>
            <div style="font-size:9px;color:#A8B4C0;text-transform:uppercase;letter-spacing:0.05em;">Billed To</div>
            <strong>${escapeHtml(subName)}</strong>
          </div>
        </div>`;

      const footerHtml = `
        <div class="footer" style="display:flex;justify-content:flex-end;">
          <div style="text-align:right;">
            <div style="font-size:10px;color:#A8B4C0;text-transform:uppercase;letter-spacing:0.05em;">Total Owed</div>
            <div class="total">$${total}</div>
          </div>
        </div>
        <p class="disclaimer">
          This Invoice Reflects Non-Cancelled Orders Placed By The Sub-Agent During The
          Listed Week. Pay Through The Pep Nation Lab Platform. Research Use Only.
        </p>`;

      const html = printableHTML({
        title: `Invoice ${invoice.week_start} ${subName}`,
        headerHtml,
        rowsHtml,
        footerHtml,
      });
      downloadPrintablePDF(html, `${fileStub}.html`);
    } catch (err: any) {
      toast.error(err.message || 'Failed To Download Invoice');
    }
  }

  if (loading) return <div style={{ color: 'var(--silver)' }}>Loading Sub-Agents...</div>;
  if (error) return <div style={{ color: 'var(--red)' }}>Error: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      <div className="glass-panel stagger-fade-in" style={{ padding: 'var(--space-6)', borderRadius: '16px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-brand)', color: 'var(--white)', fontWeight: 800, margin: 0 }}>
                My Sub-Agents
              </h2>
              <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginTop: 4 }}>
                Agents You Have Promoted. They Bill Their Downline Directly, And You Collect Their Balances.
              </p>
            </div>
            <button
              className="btn-neon-cyan"
              onClick={() => {
                fetchPricing();
                setShowPricingModal(true);
              }}
            >
              Manage Baseline Pricing
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {subAgents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-6)', opacity: 0.5 }}>No Sub-Agents Found.</div>
            ) : (
              subAgents.map(agent => (
                <div 
                  key={agent.id}
                  className="glass-panel hover-lift"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    padding: 'var(--space-4)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 200px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Agent Name</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--white)' }}>
                      {(() => {
                        const ap = pickOne<{ display_name?: string }>(agent.agent_profiles);
                        return ap?.display_name || agent.full_name || 'Anonymous';
                      })()}
                    </span>
                    {(() => {
                      const ap = pickOne<any>(agent.agent_profiles);
                      if (ap?.previous_display_name && ap?.previous_display_name_dismissed === false) {
                        return (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)', padding: '2px 8px', borderRadius: '12px', width: 'fit-content', marginTop: '2px' }}>
                            <span style={{ fontSize: '0.7rem', color: '#FFA500' }}>Previously: {ap.previous_display_name}</span>
                            <button
                              onClick={() => handleDismissPreviousName(agent.id)}
                              style={{ background: 'none', border: 'none', color: '#FFA500', cursor: 'pointer', padding: 0, fontSize: '0.9rem', lineHeight: 1 }}
                              title="Dismiss"
                            >
                              &times;
                            </button>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Credentials</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#00E5FF' }}>{agent.username || (agent.email?.includes('@internal.auth') || agent.email?.includes('@pepnationlab.com') ? '' : agent.email)}</span>
                      <button
                        onClick={() => setResetPwUser({ id: agent.id, name: agent.full_name || 'Sub-Agent', username: agent.username || agent.email })}
                        style={{ fontSize: '0.7rem', color: 'var(--grey-400)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textAlign: 'left' }}
                      >
                        Edit Password
                      </button>
                      <button
                        onClick={() => {
                          setEditContactUser({ id: agent.id, name: agent.full_name || 'Sub-Agent', email: agent.email || '', phone: agent.phone || '' });
                          setEditEmail(agent.email?.includes('@internal.auth') || agent.email?.includes('@pepnationlab.com') ? '' : (agent.email || ''));
                          setEditPhone(agent.phone || '');
                        }}
                        style={{ fontSize: '0.7rem', color: 'var(--grey-400)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textAlign: 'left' }}
                      >
                        Edit Contact Info
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Status</span>
                    <span style={{ color: agent.is_active ? '#00FF9D' : '#FFAAAA', fontSize: '0.85rem', fontWeight: 600 }}>
                      {agent.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Pending Commission</span>
                    <span style={{ color: 'var(--teal)', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'monospace' }}>
                      {formatCurrency(agent.pending_commission ?? 0)}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--grey-400)' }}>
                      {agent.commission_pct ?? 0}% Rate
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Auto-Approve</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px' }}>
                        <input 
                          type="checkbox" 
                          checked={!!agent.auto_approve_orders}
                          onChange={() => handleToggleTrust(agent.id, !!agent.auto_approve_orders)}
                          disabled={togglingTrust === agent.id}
                          style={{ opacity: 0, width: 0, height: 0 }} 
                        />
                        <span style={{
                          position: 'absolute',
                          cursor: togglingTrust === agent.id ? 'not-allowed' : 'pointer',
                          top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: agent.auto_approve_orders ? 'var(--teal)' : 'var(--grey-500)',
                          transition: '.4s',
                          borderRadius: '16px',
                          opacity: togglingTrust === agent.id ? 0.5 : 1
                        }}>
                          <span style={{
                            position: 'absolute',
                            height: '14px',
                            width: '14px',
                            left: agent.auto_approve_orders ? '19px' : '3px',
                            bottom: '3px',
                            backgroundColor: 'white',
                            transition: '.4s',
                            borderRadius: '50%'
                          }} />
                        </span>
                      </label>
                      {togglingTrust === agent.id && <span style={{ fontSize: '0.7rem', color: 'var(--teal)' }}>Saving...</span>}
                    </div>
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
                      const ap = pickOne<{ slug: string | null }>(agent.agent_profiles);
                      return ap?.slug ? (
                        <Link href={`/${ap.slug}`} style={{ color: '#00E5FF', textDecoration: 'none', fontWeight: 600 }}>
                          /{ap.slug}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--grey-400)', fontSize: '0.85rem' }}>No Storefront</span>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap', flex: '1 1 auto' }}>
                    <button
                      type="button"
                      className="btn-neon-cyan"
                      onClick={() => setDetailAgent({ id: agent.id, name: agent.full_name || agent.username || 'Sub-Agent' })}
                    >
                      Manage
                    </button>
                    <button
                      className="btn-silver"
                      onClick={() => handleGenerateInvoice(agent.id)}
                    >
                      Generate Weekly Invoice
                    </button>
                    <button
                      type="button"
                      className="btn-neon-red"
                      onClick={() => setRevokeTarget({ id: agent.id, name: agent.full_name || agent.username || 'Sub-Agent' })}
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel stagger-fade-in" style={{ padding: 'var(--space-6)', borderRadius: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)', color: 'var(--white)', fontWeight: 800 }}>
            Sub-Agent Invoices
          </h2>
          {invoices.length === 0 ? (
            <div className="glass-panel" style={{ padding: 'var(--space-8)', textAlign: 'center', opacity: 0.7 }}>
              <p>No Invoices Generated Yet. Click Generate Below An Agent To Bill Them For This Week.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {invoices.map(inv => (
                <div 
                  key={inv.id}
                  className="glass-panel hover-lift"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    padding: 'var(--space-4)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 150px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Sub-Agent</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--white)' }}>{inv.profiles?.full_name || 'Anonymous'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Week Start</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--silver)' }}>{new Date(inv.week_start).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#00E5FF', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Total Owed</span>
                    <span style={{ fontSize: '1.1rem', color: '#00E5FF', fontWeight: 800 }}>{formatCurrency(inv.total_owed)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', flex: '1 1 auto' }}>
                    <span className="badge-metal" style={{ marginRight: '8px', color: inv.status === 'paid' ? '#00FF9D' : 'var(--teal)' }}>
                      {inv.status ? inv.status.charAt(0).toUpperCase() + inv.status.slice(1) : ''}
                    </span>
                    <button type="button" onClick={() => downloadInvoice(inv.id, 'pdf')} className="btn-silver" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>Download PDF</button>
                    <button type="button" onClick={() => downloadInvoice(inv.id, 'csv')} className="btn-silver" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>Download CSV</button>
                    {inv.status !== 'paid' && (
                      <button type="button" onClick={() => handleMarkPaid(inv.id)} className="btn-neon-cyan" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>Mark Paid</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
              className="glass-panel"
              style={{
                maxWidth: 850, width: '100%',
                maxHeight: '90vh', overflowY: 'auto',
                padding: 'var(--space-7)', borderRadius: '16px'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--white)', fontWeight: 800 }}>Baseline Pricing (Applies To All Sub-Agents)</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginTop: 4 }}>
                      Set The Fixed Wholesale Cost That Your Sub-Agents Will Pay You For Each Product. These Rules Apply Globally Across All Sub-Agents.
                    </p>
                  </div>
                  <button onClick={() => setShowPricingModal(false)} className="btn-silver">Close</button>
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
                              style={{ width: 120, padding: '6px 12px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }}
                              value={costVal}
                              onChange={e => setCostInputs(prev => ({ ...prev, [prod.id]: e.target.value }))}
                              placeholder="Set Cost..."
                              step="0.01"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              style={{ width: 80, padding: '6px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }}
                              value={bulkThreshVal}
                              onChange={e => setBulkThreshInputs(prev => ({ ...prev, [prod.id]: e.target.value }))}
                              placeholder="100"
                              min="1"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              style={{ width: 100, padding: '6px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }}
                              value={bulkCostVal}
                              onChange={e => setBulkCostInputs(prev => ({ ...prev, [prod.id]: e.target.value }))}
                              placeholder="Optional"
                              step="0.01"
                              min="0"
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn-neon-cyan"
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
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {resetPwUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 400, padding: 'var(--space-6)', borderRadius: '16px' }}>
            <div>
              <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--white)' }}>Reset Sub-Agent Password</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--silver)', marginBottom: 'var(--space-2)' }}>
                Agent: <strong style={{ color: 'var(--white)' }}>{resetPwUser.name}</strong>
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>
                Username: <strong style={{ color: '#00E5FF', fontFamily: 'monospace' }}>{resetPwUser.username}</strong>
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
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>New Password</label>
                  <input
                    type="password"
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }}
                    value={resetPwValue}
                    onChange={e => setResetPwValue(e.target.value)}
                    placeholder="Minimum 8 Characters"
                    required
                    minLength={8}
                    name="subagent_reset_password_no_autofill"
                    autoComplete="new-password"
                    data-lpignore="true"
                  />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-silver" onClick={() => { setResetPwUser(null); setResetPwValue(''); }} disabled={resetPwSaving}>Cancel</button>
                  <button type="submit" className="btn-neon-cyan" disabled={resetPwSaving || resetPwValue.length < 8}>
                    {resetPwSaving ? 'Saving...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {revokeTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 440, padding: 'var(--space-6)', borderRadius: '16px' }}>
            <div>
              <h3 style={{ marginTop: 0, marginBottom: 'var(--space-3)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--white)' }}>
                Revoke Agent Privileges For {revokeTarget.name}?
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--silver)', marginBottom: 'var(--space-3)' }}>
                This Will Demote The Sub-Agent To A Researcher Account. They Will Lose Storefront Access And Pricing Tier But Will Remain In Your Downline For Sales Attribution.
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', marginBottom: 'var(--space-5)' }}>
                This Action Is Logged. You Can Re-Promote Them Later.
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-silver" onClick={() => setRevokeTarget(null)} disabled={revoking}>Cancel</button>
                <button type="button" className="btn-neon-red" onClick={handleRevoke} disabled={revoking}>
                  {revoking ? 'Revoking...' : 'Confirm Revoke'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editContactUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 400, padding: 'var(--space-6)', borderRadius: '16px' }}>
            <div>
              <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--white)' }}>Edit Contact Info</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>
                Agent: <strong style={{ color: 'var(--white)' }}>{editContactUser.name}</strong>
              </p>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!editContactUser) return;
                setEditContactSaving(true);
                try {
                  const res = await fetch('/api/agent/sub-agents/contact', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subAgentId: editContactUser.id, email: editEmail, phone: editPhone }),
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.error);
                  toast.success('Contact Info Updated');
                  setSubAgents(prev => prev.map(a => a.id === editContactUser.id ? { ...a, email: editEmail, phone: editPhone } : a));
                  setEditContactUser(null);
                } catch (err: any) {
                  toast.error(err.message || 'Failed To Update Contact Info');
                } finally {
                  setEditContactSaving(false);
                }
              }}>
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>Email Address</label>
                  <input type="email" style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }} value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="" />
                </div>
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--grey-300)', fontSize: '0.85rem' }}>Phone Number</label>
                  <input type="tel" style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: '6px' }} value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="" />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-silver" onClick={() => setEditContactUser(null)} disabled={editContactSaving}>Cancel</button>
                  <button type="submit" className="btn-neon-cyan" disabled={editContactSaving}>{editContactSaving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {detailAgent && (
        <AgentAccountDetail
          agentId={detailAgent.id}
          agentName={detailAgent.name}
          onClose={() => setDetailAgent(null)}
          onChanged={fetchData}
        />
      )}
    </div>
  );
}
