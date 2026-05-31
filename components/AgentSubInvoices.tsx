'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface SubAgentInvoice {
  id: string;
  super_agent_id: string;
  sub_agent_id: string;
  week_start: string;
  week_end: string;
  total_cogs: number;
  total_shipping: number;
  total_owed: number;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
}

export default function AgentSubInvoices({ isSuperAgent }: { isSuperAgent: boolean }) {
  const [invoices, setInvoices] = useState<SubAgentInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoices();
  }, []);

  async function fetchInvoices() {
    try {
      const res = await fetch('/api/agent/super-agent/invoices');
      if (!res.ok) throw new Error('Failed to load invoices');
      const data = await res.json();
      setInvoices(data.data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function markPaid(invoiceId: string) {
    if (!confirm('Are you sure you want to mark this invoice as paid?')) return;
    
    try {
      const res = await fetch('/api/agent/super-agent/invoices/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to mark paid');
      }
      
      toast.success('Invoice marked as paid');
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: 'paid' } : inv));
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  if (loading) {
    return (
      <div className="metal-frame" style={{ textAlign: 'center' }}>
        <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
          <div className="spinner" style={{ margin: '0 auto', marginBottom: 'var(--space-4)' }} />
          <p style={{ color: 'var(--silver-light)' }}>Loading invoices...</p>
        </div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="metal-frame" style={{ textAlign: 'center' }}>
        <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
          <p style={{ color: 'var(--silver-light)' }}>No invoices found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="metal-frame">
      <div className="metal-content">
        <h2 className="metal-text" style={{ fontSize: '1.25rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-4)' }}>
          {isSuperAgent ? 'Sub-Agent Invoices' : 'My Invoices (Owed To Super Agent)'}
        </h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ textAlign: 'left', padding: 'var(--space-3)', color: 'var(--silver)' }}>Billing Period</th>
              {isSuperAgent && (
                <th style={{ textAlign: 'left', padding: 'var(--space-3)', color: 'var(--silver)' }}>Sub-Agent</th>
              )}
              <th style={{ textAlign: 'right', padding: 'var(--space-3)', color: 'var(--silver)' }}>COGS</th>
              <th style={{ textAlign: 'right', padding: 'var(--space-3)', color: 'var(--silver)' }}>Shipping</th>
              <th style={{ textAlign: 'right', padding: 'var(--space-3)', color: 'var(--teal)' }}>Total Owed</th>
              <th style={{ textAlign: 'center', padding: 'var(--space-3)', color: 'var(--silver)' }}>Status</th>
              {isSuperAgent && (
                <th style={{ textAlign: 'right', padding: 'var(--space-3)', color: 'var(--silver)' }}>Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: 'var(--space-3)', color: 'var(--white)' }}>
                  {inv.week_start} to {inv.week_end}
                </td>
                {isSuperAgent && (
                  <td style={{ padding: 'var(--space-3)', color: 'var(--silver)' }}>
                    {inv.profiles?.full_name || 'Unknown'} <br />
                    <span style={{ fontSize: '0.8em', opacity: 0.7 }}>{inv.profiles?.email}</span>
                  </td>
                )}
                <td style={{ padding: 'var(--space-3)', color: 'var(--white)', textAlign: 'right' }}>
                  ${Number(inv.total_cogs || 0).toFixed(2)}
                </td>
                <td style={{ padding: 'var(--space-3)', color: 'var(--white)', textAlign: 'right' }}>
                  ${Number(inv.total_shipping || 0).toFixed(2)}
                </td>
                <td style={{ padding: 'var(--space-3)', color: 'var(--teal)', textAlign: 'right', fontWeight: 'bold' }}>
                  ${Number(inv.total_owed || 0).toFixed(2)}
                </td>
                <td style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    fontWeight: 'bold',
                    backgroundColor: inv.status === 'paid' ? 'rgba(46, 213, 115, 0.2)' : 'rgba(255, 71, 87, 0.2)',
                    color: inv.status === 'paid' ? '#2ed573' : '#ff4757'
                  }}>
                    {inv.status}
                  </span>
                </td>
                {isSuperAgent && (
                  <td style={{ padding: 'var(--space-3)', textAlign: 'right' }}>
                    {inv.status === 'open' && (
                      <button 
                        className="btn-glass"
                        onClick={() => markPaid(inv.id)}
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        Mark Paid
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {!isSuperAgent && (
        <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-4)', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)' }}>
          <h4 style={{ color: 'var(--white)', marginBottom: 'var(--space-2)' }}>How to pay</h4>
          <p style={{ color: 'var(--silver)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Please remit payment directly to your Super Agent using their preferred payment methods. Your Super Agent will mark your invoice as paid once funds are received.
          </p>
        </div>
      )}
      </div>
    </div>
  );
}
