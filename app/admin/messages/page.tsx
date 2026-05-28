'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Messaging from '@/components/Messaging';
import { toast } from 'sonner';

interface Agent {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string;
  role: string;
}

export default function AdminMessagesPage() {
  const supabase = createClient();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [selfId, setSelfId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  // Invoice modal
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceAgent, setInvoiceAgent] = useState<Agent | null>(null);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDesc, setInvoiceDesc] = useState('');
  const [invoiceSending, setInvoiceSending] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setSelfId(user.id);

      // Fetch all agents
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, email, role')
        .in('role', ['agent', 'super_agent'])
        .order('full_name');
      setAgents(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = agents.filter(a => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (a.full_name?.toLowerCase().includes(q)) || (a.username?.toLowerCase().includes(q)) || (a.email.toLowerCase().includes(q));
  });

  const handleSendInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceAgent || !invoiceAmount || !invoiceDesc) return;
    setInvoiceSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: invoiceAgent.id,
          subject: `Invoice — $${Number(invoiceAmount).toFixed(2)}`,
          body: `Amount Due: $${Number(invoiceAmount).toFixed(2)}\n\n${invoiceDesc}\n\nPlease remit payment at your earliest convenience.`,
          type: 'invoice',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Invoice Sent To ${invoiceAgent.full_name || invoiceAgent.username}`);
      setShowInvoice(false);
      setInvoiceAmount('');
      setInvoiceDesc('');
      setInvoiceAgent(null);
      // If this agent is currently selected, refresh the thread
      if (selected?.id === invoiceAgent.id) {
        setSelected({ ...invoiceAgent }); // force re-render
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed To Send Invoice');
    } finally {
      setInvoiceSending(false);
    }
  };

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', margin: 0, fontFamily: 'var(--font-brand)' }}>Messages</h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', margin: '4px 0 0' }}>Send Direct Messages And Invoices To Any Agent</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--space-5)', minHeight: 600 }}>
        {/* Agent List */}
        <div className="card-metal" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Search */}
          <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search Agents..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{ margin: 0, fontSize: '0.82rem' }}
            />
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--grey-400)', fontSize: '0.82rem' }}>Loading Agents...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--grey-400)', fontSize: '0.82rem' }}>No Agents Found</div>
            ) : (
              filtered.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => setSelected(agent)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: selected?.id === agent.id ? 'rgba(0,196,188,0.08)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    borderLeft: selected?.id === agent.id ? '3px solid var(--teal)' : '3px solid transparent',
                    padding: 'var(--space-3) var(--space-4)',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--silver)' }}>
                    {agent.full_name || 'Agent'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>@{agent.username || agent.email.split('@')[0]}</span>
                    <span className="badge badge-silver" style={{ fontSize: '0.6rem' }}>{agent.role === 'super_agent' ? 'Super' : 'Agent'}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Thread + Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {selected ? (
            <>
              {/* Action bar */}
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--silver)' }}>
                  Messaging: <strong style={{ color: 'var(--white)' }}>{selected.full_name || selected.username}</strong>
                </span>
                <div style={{ flex: 1 }} />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => { setInvoiceAgent(selected); setShowInvoice(true); setInvoiceAmount(''); setInvoiceDesc(''); }}
                  style={{ fontSize: '0.78rem' }}
                >
                  💰 Send Invoice
                </button>
              </div>
              <Messaging
                selfId={selfId}
                counterpartId={selected.id}
                counterpartName={selected.full_name || selected.username || 'Agent'}
              />
            </>
          ) : (
            <div className="card-metal" style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 'var(--space-3)',
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--grey-600)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <div style={{ color: 'var(--grey-400)', fontSize: '0.9rem' }}>Select An Agent To Start Messaging</div>
              <div style={{ color: 'var(--grey-500)', fontSize: '0.78rem' }}>You Can Send Direct Messages Or Invoices</div>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Modal */}
      {showInvoice && invoiceAgent && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="card-metal" style={{ width: '100%', maxWidth: 440, padding: 'var(--space-6)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--space-2)', color: 'var(--white)' }}>Send Invoice</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', marginBottom: 'var(--space-5)' }}>
              To: <strong style={{ color: 'var(--teal)' }}>{invoiceAgent.full_name || invoiceAgent.username}</strong>
            </p>
            <form onSubmit={handleSendInvoice}>
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Amount ($)</label>
                <input
                  type="number"
                  className="form-input"
                  value={invoiceAmount}
                  onChange={e => setInvoiceAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  required
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
                <label className="form-label">Description / Details</label>
                <textarea
                  className="form-input"
                  value={invoiceDesc}
                  onChange={e => setInvoiceDesc(e.target.value)}
                  placeholder="E.g. Weekly Product Restock — Week of May 26"
                  required
                  rows={3}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowInvoice(false)} disabled={invoiceSending}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={invoiceSending || !invoiceAmount || !invoiceDesc}>
                  {invoiceSending ? 'Sending...' : '💰 Send Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
