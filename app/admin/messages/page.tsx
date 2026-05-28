'use client';

import { useState, useEffect } from 'react';
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
  const [threadKey, setThreadKey] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setSelfId(user.id);
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
      setThreadKey(k => k + 1);
    } catch (err: any) {
      toast.error(err.message || 'Failed To Send Invoice');
    } finally {
      setInvoiceSending(false);
    }
  };

  const getInitials = (a: Agent) =>
    (a.full_name || 'A').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 1200 }}>
      {/* Page Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{
          fontSize: '1.5rem', margin: 0,
          fontFamily: 'var(--font-brand)',
          letterSpacing: '0.04em',
          color: '#fff',
        }}>
          Messages
        </h1>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>
          Direct Message Any Agent Or Send Invoices
        </p>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '300px 1fr',
        gap: 0, minHeight: 600,
        background: '#0a0f1a',
        borderRadius: 16, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}>
        {/* Sidebar — Contact List */}
        <div style={{
          borderRight: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column',
          background: 'rgba(255,255,255,0.01)',
        }}>
          {/* Sidebar header */}
          <div style={{ padding: '16px 16px 12px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 12, padding: '0 12px',
              border: '1px solid rgba(255,255,255,0.05)',
              transition: 'border-color 0.2s',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  color: '#fff', fontSize: '0.82rem', padding: '10px 0',
                  width: '100%', fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          {/* Contact list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', margin: '0 auto 10px',
                  border: '2px solid rgba(0,196,188,0.2)', borderTopColor: 'var(--teal)',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem' }}>Loading...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem' }}>No Agents Found</div>
            ) : (
              filtered.map(agent => {
                const isActive = selected?.id === agent.id;
                return (
                  <button
                    key={agent.id}
                    onClick={() => setSelected(agent)}
                    style={{
                      width: '100%', textAlign: 'left',
                      background: isActive ? 'rgba(0,196,188,0.06)' : 'transparent',
                      border: 'none',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 12,
                      transition: 'background 0.15s',
                      borderLeft: isActive ? '3px solid var(--teal)' : '3px solid transparent',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%',
                      background: isActive
                        ? 'linear-gradient(135deg, #00C4BC 0%, #0099FF 100%)'
                        : 'linear-gradient(135deg, #1f2937 0%, #374151 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.72rem', fontWeight: 800, color: '#fff',
                      flexShrink: 0,
                      transition: 'background 0.3s',
                    }}>
                      {getInitials(agent)}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.84rem', fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#fff' : 'rgba(255,255,255,0.75)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {agent.full_name || 'Agent'}
                      </div>
                      <div style={{
                        fontSize: '0.7rem',
                        color: 'rgba(255,255,255,0.3)',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <span>@{agent.username || agent.email.split('@')[0]}</span>
                        <span style={{
                          fontSize: '0.58rem', fontWeight: 700,
                          color: agent.role === 'super_agent' ? '#C084FC' : 'rgba(255,255,255,0.25)',
                          background: agent.role === 'super_agent' ? 'rgba(192,132,252,0.08)' : 'rgba(255,255,255,0.03)',
                          padding: '1px 6px', borderRadius: 4,
                        }}>
                          {agent.role === 'super_agent' ? 'SUPER' : 'AGENT'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Main — Thread Area */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {selected ? (
            <>
              {/* Action bar */}
              <div style={{
                padding: '10px 20px',
                background: 'rgba(255,255,255,0.02)',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              }}>
                <button
                  onClick={() => { setInvoiceAgent(selected); setShowInvoice(true); setInvoiceAmount(''); setInvoiceDesc(''); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'linear-gradient(135deg, rgba(0,196,188,0.1) 0%, rgba(0,153,255,0.1) 100%)',
                    border: '1px solid rgba(0,196,188,0.2)',
                    color: 'var(--teal)', fontSize: '0.78rem', fontWeight: 600,
                    padding: '6px 16px', borderRadius: 10,
                    cursor: 'pointer', transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,196,188,0.15) 0%, rgba(0,153,255,0.15) 100%)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,196,188,0.1) 0%, rgba(0,153,255,0.1) 100%)')}
                >
                  💰 Send Invoice
                </button>
              </div>
              {/* Thread */}
              <div style={{ flex: 1 }}>
                <Messaging
                  key={threadKey}
                  selfId={selfId}
                  counterpartId={selected.id}
                  counterpartName={selected.full_name || selected.username || 'Agent'}
                />
              </div>
            </>
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 16,
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(0,196,188,0.06) 0%, rgba(0,153,255,0.06) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(0,196,188,0.3)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>
                  Select A Conversation
                </div>
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.82rem' }}>
                  Choose an agent from the left to start messaging
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Modal */}
      {showInvoice && invoiceAgent && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => !invoiceSending && setShowInvoice(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 440,
              background: '#111827',
              border: '1px solid rgba(0,196,188,0.15)',
              borderRadius: 20, padding: '28px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              animation: 'dropdownSlide 0.2s ease-out',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'linear-gradient(135deg, #00C4BC 0%, #0099FF 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.2rem',
              }}>
                💰
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fff', fontWeight: 700 }}>Send Invoice</h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                  To: <strong style={{ color: 'var(--teal)' }}>{invoiceAgent.full_name || invoiceAgent.username}</strong>
                </p>
              </div>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setShowInvoice(false)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: 'none',
                  width: 32, height: 32, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSendInvoice}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 600 }}>
                  Amount
                </label>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12, overflow: 'hidden',
                }}>
                  <span style={{ padding: '0 12px', color: 'var(--teal)', fontWeight: 700, fontSize: '1rem' }}>$</span>
                  <input
                    type="number"
                    value={invoiceAmount}
                    onChange={e => setInvoiceAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                    required
                    style={{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      color: '#fff', fontSize: '1.1rem', fontWeight: 700,
                      padding: '12px 12px 12px 0',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 600 }}>
                  Description
                </label>
                <textarea
                  value={invoiceDesc}
                  onChange={e => setInvoiceDesc(e.target.value)}
                  placeholder="E.g. Weekly Product Restock — Week of May 26"
                  required
                  rows={3}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12, padding: 14, resize: 'vertical',
                    color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit',
                    outline: 'none', lineHeight: 1.5,
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowInvoice(false)}
                  disabled={invoiceSending}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.6)', borderRadius: 10,
                    padding: '8px 20px', fontSize: '0.82rem', fontWeight: 600,
                    cursor: 'pointer', transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={invoiceSending || !invoiceAmount || !invoiceDesc}
                  style={{
                    background: 'linear-gradient(135deg, #00C4BC 0%, #0099FF 100%)',
                    border: 'none', color: '#fff', borderRadius: 10,
                    padding: '8px 24px', fontSize: '0.82rem', fontWeight: 700,
                    cursor: invoiceSending ? 'wait' : 'pointer',
                    opacity: (!invoiceAmount || !invoiceDesc) ? 0.4 : 1,
                    transition: 'opacity 0.2s, transform 0.15s',
                    transform: invoiceSending ? 'scale(0.97)' : 'scale(1)',
                  }}
                >
                  {invoiceSending ? 'Sending...' : 'Send Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dropdownSlide { from { opacity: 0; transform: translateY(-8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
}
