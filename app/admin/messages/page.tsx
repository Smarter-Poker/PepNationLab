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
  last_active_at: string | null;
}

type Tab = 'messages' | 'invoices' | 'analytics';

export default function AdminMessagesPage() {
  const supabase = createClient();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [selfId, setSelfId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState<Tab>('messages');
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // Invoice modal
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceAgent, setInvoiceAgent] = useState<Agent | null>(null);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDesc, setInvoiceDesc] = useState('');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [lineItems, setLineItems] = useState<{ name: string; qty: number; price: number }[]>([]);
  const [invoiceSending, setInvoiceSending] = useState(false);
  const [threadKey, setThreadKey] = useState(0);

  // Broadcast modal
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastRole, setBroadcastRole] = useState('all');
  const [broadcastSending, setBroadcastSending] = useState(false);

  // Credit memo modal
  const [showCreditMemo, setShowCreditMemo] = useState(false);
  const [creditAgent, setCreditAgent] = useState<Agent | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDesc, setCreditDesc] = useState('');
  const [creditSending, setCreditSending] = useState(false);

  // Invoices tab
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoiceFilter, setInvoiceFilter] = useState('all');
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // Analytics
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setSelfId(user.id);
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, email, role, last_active_at')
        .in('role', ['agent', 'super_agent'])
        .order('full_name');
      setAgents(data ?? []);

      // Load archived
      try {
        const res = await fetch('/api/messages/archive');
        const json = await res.json();
        setArchivedIds((json.archived ?? []).map((a: any) => a.counterpart_id));
      } catch { /* ok */ }

      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (tab === 'invoices') loadInvoices();
    if (tab === 'analytics') loadAnalytics();
  }, [tab]);

  async function loadInvoices() {
    setInvoicesLoading(true);
    try {
      const url = invoiceFilter === 'all' ? '/api/invoices' : `/api/invoices?status=${invoiceFilter}`;
      const res = await fetch(url);
      const json = await res.json();
      setInvoices(json.invoices ?? []);
    } catch { /* ok */ }
    setInvoicesLoading(false);
  }

  async function loadAnalytics() {
    setAnalyticsLoading(true);
    try {
      const res = await fetch('/api/messages/analytics');
      const json = await res.json();
      setAnalytics(json);
    } catch { /* ok */ }
    setAnalyticsLoading(false);
  }

  const filtered = agents.filter(a => {
    if (!showArchived && archivedIds.includes(a.id)) return false;
    if (showArchived && !archivedIds.includes(a.id)) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (a.full_name?.toLowerCase().includes(q)) || (a.username?.toLowerCase().includes(q)) || (a.email.toLowerCase().includes(q));
  });

  const isOnline = (a: Agent) => {
    if (!a.last_active_at) return false;
    return Date.now() - new Date(a.last_active_at).getTime() < 5 * 60 * 1000;
  };

  const getInitials = (name: string | null) =>
    (name || 'A').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  async function handleSendInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceAgent) return;
    setInvoiceSending(true);
    try {
      const totalAmount = lineItems.length > 0
        ? lineItems.reduce((sum, li) => sum + li.qty * li.price, 0)
        : Number(invoiceAmount);
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: invoiceAgent.id,
          subject: `Invoice — $${totalAmount.toFixed(2)}`,
          body: invoiceDesc || `Amount Due: $${totalAmount.toFixed(2)}`,
          type: 'invoice',
          invoiceAmount: totalAmount,
          dueDate: invoiceDueDate || null,
          lineItems: lineItems.length > 0 ? lineItems : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Invoice Sent To ${invoiceAgent.full_name || invoiceAgent.username}`);
      setShowInvoice(false); setInvoiceAmount(''); setInvoiceDesc(''); setInvoiceDueDate(''); setLineItems([]); setInvoiceAgent(null);
      setThreadKey(k => k + 1);
    } catch (err: any) { toast.error(err.message); }
    finally { setInvoiceSending(false); }
  }

  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault();
    setBroadcastSending(true);
    try {
      const res = await fetch('/api/messages/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: broadcastSubject, body: broadcastBody, recipientRole: broadcastRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Broadcast Sent To ${json.count} Recipients`);
      setShowBroadcast(false); setBroadcastSubject(''); setBroadcastBody('');
    } catch (err: any) { toast.error(err.message); }
    finally { setBroadcastSending(false); }
  }

  async function handleCreditMemo(e: React.FormEvent) {
    e.preventDefault();
    if (!creditAgent) return;
    setCreditSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: creditAgent.id,
          subject: `Credit Memo — $${Number(creditAmount).toFixed(2)}`,
          body: creditDesc || `Credit issued: $${Number(creditAmount).toFixed(2)}`,
          type: 'credit_memo',
          invoiceAmount: Number(creditAmount),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Credit Memo Sent`);
      setShowCreditMemo(false); setCreditAmount(''); setCreditDesc(''); setCreditAgent(null);
      setThreadKey(k => k + 1);
    } catch (err: any) { toast.error(err.message); }
    finally { setCreditSending(false); }
  }

  async function handleArchiveToggle(agentId: string) {
    const isArchived = archivedIds.includes(agentId);
    try {
      if (isArchived) {
        await fetch('/api/messages/archive', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ counterpartId: agentId }) });
        setArchivedIds(prev => prev.filter(id => id !== agentId));
      } else {
        await fetch('/api/messages/archive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ counterpartId: agentId }) });
        setArchivedIds(prev => [...prev, agentId]);
        if (selected?.id === agentId) setSelected(null);
      }
    } catch { /* ok */ }
  }

  async function handleInvoiceStatus(messageId: string, status: string) {
    try {
      const res = await fetch('/api/invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, status }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Invoice Marked ${status}`);
      loadInvoices();
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleSendReminder(invoiceId: string) {
    try {
      const res = await fetch('/api/invoices/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceMessageId: invoiceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Reminder Sent');
      loadInvoices();
    } catch (err: any) { toast.error(err.message); }
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'messages', label: 'Messages', icon: '💬' },
    { key: 'invoices', label: 'Invoices', icon: '💰' },
    { key: 'analytics', label: 'Analytics', icon: '📊' },
  ];

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 1300 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', margin: 0, fontFamily: 'var(--font-brand)', letterSpacing: '0.04em', color: '#fff' }}>Messages</h1>
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', margin: '4px 0 0' }}>Manage Communications, Invoices & Analytics</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowBroadcast(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, rgba(192,132,252,0.1), rgba(99,179,237,0.1))', border: '1px solid rgba(192,132,252,0.2)', color: '#C084FC', fontSize: '0.78rem', fontWeight: 600, padding: '8px 16px', borderRadius: 10, cursor: 'pointer' }}>
            📢 Broadcast
          </button>
          <button onClick={() => { setShowCreditMemo(true); setCreditAgent(selected); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(72,187,120,0.08)', border: '1px solid rgba(72,187,120,0.2)', color: '#48BB78', fontSize: '0.78rem', fontWeight: 600, padding: '8px 16px', borderRadius: 10, cursor: 'pointer' }}>
            💳 Credit Memo
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--space-4)' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '8px 18px', borderRadius: 10, cursor: 'pointer',
              fontSize: '0.82rem', fontWeight: tab === t.key ? 700 : 500,
              background: tab === t.key ? 'rgba(192,184,168,0.08)' : 'rgba(255,255,255,0.03)',
              color: tab === t.key ? 'var(--teal)' : 'rgba(255,255,255,0.4)',
              border: tab === t.key ? '1px solid rgba(192,184,168,0.15)' : '1px solid rgba(255,255,255,0.05)',
              transition: 'all 0.15s',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Messages Tab */}
      {tab === 'messages' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0, minHeight: 580, background: '#0a0f1a', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
          {/* Sidebar */}
          <div style={{ borderRight: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.01)' }}>
            <div style={{ padding: '12px 14px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '0 10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input type="text" placeholder="Search..." value={filter} onChange={e => setFilter(e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '0.78rem', padding: '8px 0', width: '100%', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setShowArchived(false)} style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.68rem', fontWeight: !showArchived ? 700 : 500, background: !showArchived ? 'rgba(192,184,168,0.08)' : 'transparent', color: !showArchived ? 'var(--teal)' : 'rgba(255,255,255,0.3)' }}>Active</button>
                <button onClick={() => setShowArchived(true)} style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.68rem', fontWeight: showArchived ? 700 : 500, background: showArchived ? 'rgba(255,255,255,0.06)' : 'transparent', color: showArchived ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)' }}>Archived</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: 32, textAlign: 'center' }}><div style={{ width: 22, height: 22, borderRadius: '50%', margin: '0 auto', border: '2px solid rgba(192,184,168,0.2)', borderTopColor: 'var(--teal)', animation: 'spin 0.8s linear infinite' }} /></div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.78rem' }}>{showArchived ? 'No Archived Chats' : 'No Agents'}</div>
              ) : filtered.map(a => {
                const active = selected?.id === a.id;
                const online = isOnline(a);
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center' }}>
                    <button onClick={() => setSelected(a)} style={{ flex: 1, textAlign: 'left', background: active ? 'rgba(192,184,168,0.06)' : 'transparent', border: 'none', borderLeft: active ? '3px solid var(--teal)' : '3px solid transparent', padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.15s' }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: active ? 'linear-gradient(135deg, #00C4BC, #0099FF)' : 'linear-gradient(135deg, #1f2937, #374151)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 800, color: '#fff' }}>{getInitials(a.full_name)}</div>
                        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: online ? '#4ADE80' : '#4B5563', border: '2px solid #0a0f1a' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: active ? 700 : 500, color: active ? '#fff' : 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.full_name || 'Agent'}</div>
                        <div style={{ fontSize: '0.65rem', color: online ? '#4ADE80' : 'rgba(255,255,255,0.25)' }}>{online ? 'Online' : 'Offline'}</div>
                      </div>
                    </button>
                    <button onClick={() => handleArchiveToggle(a.id)} title={archivedIds.includes(a.id) ? 'Unarchive' : 'Archive'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>
                      {archivedIds.includes(a.id) ? '↩' : '📦'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Thread */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {selected ? (
              <>
                <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setInvoiceAgent(selected); setShowInvoice(true); setInvoiceAmount(''); setInvoiceDesc(''); setInvoiceDueDate(''); setLineItems([]); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'linear-gradient(135deg, rgba(192,184,168,0.08), rgba(0,153,255,0.08))', border: '1px solid rgba(192,184,168,0.15)', color: 'var(--teal)', fontSize: '0.75rem', fontWeight: 600, padding: '5px 14px', borderRadius: 8, cursor: 'pointer' }}>
                    💰 Invoice
                  </button>
                  <button onClick={() => { setCreditAgent(selected); setShowCreditMemo(true); setCreditAmount(''); setCreditDesc(''); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(72,187,120,0.06)', border: '1px solid rgba(72,187,120,0.15)', color: '#48BB78', fontSize: '0.75rem', fontWeight: 600, padding: '5px 14px', borderRadius: 8, cursor: 'pointer' }}>
                    💳 Credit
                  </button>
                </div>
                <div style={{ flex: 1 }}><Messaging key={threadKey} selfId={selfId} counterpartId={selected.id} counterpartName={selected.full_name || selected.username || 'Agent'} /></div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
                <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(192,184,168,0.05), rgba(0,153,255,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(192,184,168,0.25)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.92rem', fontWeight: 600 }}>Select A Conversation</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoices Tab */}
      {tab === 'invoices' && (
        <div style={{ background: '#0a0f1a', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {['all', 'pending', 'paid', 'overdue', 'cancelled'].map(s => (
              <button key={s} onClick={() => { setInvoiceFilter(s); setTimeout(loadInvoices, 50); }}
                style={{ padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: invoiceFilter === s ? 700 : 500, background: invoiceFilter === s ? 'rgba(192,184,168,0.08)' : 'transparent', color: invoiceFilter === s ? 'var(--teal)' : 'rgba(255,255,255,0.35)', textTransform: 'capitalize' }}>
                {s}
              </button>
            ))}
          </div>
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {invoicesLoading ? (
              <div style={{ padding: 32, textAlign: 'center' }}><div style={{ width: 24, height: 24, borderRadius: '50%', margin: '0 auto', border: '2px solid rgba(192,184,168,0.2)', borderTopColor: 'var(--teal)', animation: 'spin 0.8s linear infinite' }} /></div>
            ) : invoices.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>No Invoices Found</div>
            ) : invoices.map(inv => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: inv.type === 'credit_memo' ? 'linear-gradient(135deg, #48BB78, #38A169)' : 'linear-gradient(135deg, #00C4BC, #0099FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                  {inv.type === 'credit_memo' ? '💳' : inv.type === 'payment_reminder' ? '⚠️' : '💰'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{inv.subject}</div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>To: {inv.receiver_profile?.full_name || inv.receiver_profile?.username || 'Agent'} · {new Date(inv.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: inv.type === 'credit_memo' ? '#48BB78' : 'var(--teal)' }}>
                    {inv.type === 'credit_memo' ? '-' : ''}${Math.abs(Number(inv.invoice_amount || 0)).toFixed(2)}
                  </div>
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase',
                    background: inv.invoice_status === 'paid' ? 'rgba(72,187,120,0.1)' : inv.invoice_status === 'overdue' ? 'rgba(229,62,62,0.1)' : inv.invoice_status === 'cancelled' ? 'rgba(255,255,255,0.05)' : 'rgba(237,137,54,0.1)',
                    color: inv.invoice_status === 'paid' ? '#48BB78' : inv.invoice_status === 'overdue' ? '#FC8181' : inv.invoice_status === 'cancelled' ? 'rgba(255,255,255,0.3)' : '#ED8936',
                  }}>{inv.invoice_status || 'pending'}</span>
                </div>
                {/* Actions */}
                {inv.type === 'invoice' && inv.invoice_status !== 'paid' && inv.invoice_status !== 'cancelled' && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => handleInvoiceStatus(inv.id, 'paid')} style={{ background: 'rgba(72,187,120,0.08)', border: '1px solid rgba(72,187,120,0.2)', color: '#48BB78', fontSize: '0.68rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>✓ Paid</button>
                    <button onClick={() => handleSendReminder(inv.id)} style={{ background: 'rgba(237,137,54,0.08)', border: '1px solid rgba(237,137,54,0.2)', color: '#ED8936', fontSize: '0.68rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>⚠ Remind</button>
                    <button onClick={() => handleInvoiceStatus(inv.id, 'cancelled')} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)', fontSize: '0.68rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>✗ Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {tab === 'analytics' && (
        <div style={{ background: '#0a0f1a', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', padding: 24 }}>
          {analyticsLoading || !analytics ? (
            <div style={{ textAlign: 'center', padding: 32 }}><div style={{ width: 28, height: 28, borderRadius: '50%', margin: '0 auto', border: '2.5px solid rgba(192,184,168,0.2)', borderTopColor: 'var(--teal)', animation: 'spin 0.8s linear infinite' }} /></div>
          ) : (
            <>
              {/* Stats cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'Messages (7d)', value: analytics.totalMessages, color: 'var(--teal)', icon: '💬' },
                  { label: 'Pending Invoices', value: `$${analytics.totalPending.toFixed(2)}`, color: '#ED8936', icon: '⏳' },
                  { label: 'Paid Invoices', value: `$${analytics.totalPaid.toFixed(2)}`, color: '#48BB78', icon: '✅' },
                  { label: 'Overdue', value: analytics.overdueInvoices, color: '#FC8181', icon: '⚠️' },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 18, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: '1.6rem', marginBottom: 4 }}>{s.icon}</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#fff', fontSize: '0.88rem', margin: '0 0 14px', fontWeight: 700 }}>Message Volume (Last 7 Days)</h4>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
                  {analytics.messagesByDay?.map((d: any, i: number) => {
                    const max = Math.max(...analytics.messagesByDay.map((x: any) => x.count), 1);
                    const h = Math.max((d.count / max) * 100, 4);
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{d.count}</span>
                        <div style={{ width: '100%', height: h, background: 'linear-gradient(180deg, var(--teal), #0099FF)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }} />
                        <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)' }}>{d.date.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top agents */}
              {analytics.topAgents?.length > 0 && (
                <div>
                  <h4 style={{ color: '#fff', fontSize: '0.88rem', margin: '0 0 10px', fontWeight: 700 }}>Most Active Agents</h4>
                  {analytics.topAgents.map((a: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', width: 20 }}>#{i + 1}</span>
                      <span style={{ fontSize: '0.82rem', color: '#fff', flex: 1 }}>{a.name}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--teal)', fontWeight: 700 }}>{a.count} msgs</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoice && invoiceAgent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => !invoiceSending && setShowInvoice(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#111827', border: '1px solid rgba(192,184,168,0.15)', borderRadius: 18, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{ fontSize: '1.4rem' }}>💰</span>
              <div><h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>Send Invoice</h3><p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>To: <strong style={{ color: 'var(--teal)' }}>{invoiceAgent.full_name || invoiceAgent.username}</strong></p></div>
              <div style={{ flex: 1 }} />
              <button onClick={() => setShowInvoice(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>✕</button>
            </div>
            <form onSubmit={handleSendInvoice}>
              {/* Line items */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Line Items</label>
                  <button type="button" onClick={() => setLineItems([...lineItems, { name: '', qty: 1, price: 0 }])}
                    style={{ background: 'rgba(192,184,168,0.06)', border: '1px solid rgba(192,184,168,0.15)', color: 'var(--teal)', fontSize: '0.68rem', fontWeight: 600, padding: '3px 10px', borderRadius: 6, cursor: 'pointer' }}>+ Add Item</button>
                </div>
                {lineItems.map((li, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input placeholder="Item" value={li.name} onChange={e => { const n = [...lineItems]; n[idx].name = e.target.value; setLineItems(n); }}
                      style={{ flex: 2, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit' }} />
                    <input type="number" placeholder="Qty" value={li.qty || ''} onChange={e => { const n = [...lineItems]; n[idx].qty = Number(e.target.value); setLineItems(n); }} min="1"
                      style={{ flex: 0.5, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 6px', color: '#fff', fontSize: '0.82rem', outline: 'none', textAlign: 'center', fontFamily: 'inherit' }} />
                    <input type="number" placeholder="Price" value={li.price || ''} onChange={e => { const n = [...lineItems]; n[idx].price = Number(e.target.value); setLineItems(n); }} step="0.01" min="0"
                      style={{ flex: 0.7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 6px', color: '#fff', fontSize: '0.82rem', outline: 'none', textAlign: 'center', fontFamily: 'inherit' }} />
                    <button type="button" onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', color: '#FC8181', cursor: 'pointer', padding: '0 4px', fontSize: '0.9rem' }}>✕</button>
                  </div>
                ))}
                {lineItems.length > 0 && (
                  <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--teal)', fontWeight: 700, marginTop: 4 }}>
                    Total: ${lineItems.reduce((s, li) => s + li.qty * li.price, 0).toFixed(2)}
                  </div>
                )}
              </div>
              {lineItems.length === 0 && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 5, fontWeight: 600 }}>Amount</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
                    <span style={{ padding: '0 10px', color: 'var(--teal)', fontWeight: 700 }}>$</span>
                    <input type="number" value={invoiceAmount} onChange={e => setInvoiceAmount(e.target.value)} placeholder="0.00" step="0.01" min="0.01" required={lineItems.length === 0}
                      style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '1rem', fontWeight: 700, padding: '10px 10px 10px 0', fontFamily: 'inherit' }} />
                  </div>
                </div>
              )}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 5, fontWeight: 600 }}>Due Date (Optional)</label>
                <input type="date" value={invoiceDueDate} onChange={e => setInvoiceDueDate(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit' }} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 5, fontWeight: 600 }}>Description</label>
                <textarea value={invoiceDesc} onChange={e => setInvoiceDesc(e.target.value)} placeholder="Description..." rows={2}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12, color: '#fff', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.4 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowInvoice(false)} disabled={invoiceSending}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', borderRadius: 10, padding: '8px 18px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={invoiceSending || (lineItems.length === 0 && !invoiceAmount)}
                  style={{ background: 'linear-gradient(135deg, #00C4BC, #0099FF)', border: 'none', color: '#fff', borderRadius: 10, padding: '8px 22px', fontSize: '0.82rem', fontWeight: 700, cursor: invoiceSending ? 'wait' : 'pointer', opacity: invoiceSending ? 0.7 : 1 }}>
                  {invoiceSending ? 'Sending...' : 'Send Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      {showBroadcast && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => !broadcastSending && setShowBroadcast(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: '#111827', border: '1px solid rgba(192,132,252,0.15)', borderRadius: 18, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{ fontSize: '1.4rem' }}>📢</span>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>Broadcast Message</h3>
              <div style={{ flex: 1 }} />
              <button onClick={() => setShowBroadcast(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>✕</button>
            </div>
            <form onSubmit={handleBroadcast}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 5, fontWeight: 600 }}>Recipients</label>
                <select value={broadcastRole} onChange={e => setBroadcastRole(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit' }}>
                  <option value="all">All Agents + Researchers</option>
                  <option value="agent">Agents Only</option>
                  <option value="super_agent">Super Agents Only</option>
                  <option value="researcher">Researchers Only</option>
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 5, fontWeight: 600 }}>Subject</label>
                <input type="text" value={broadcastSubject} onChange={e => setBroadcastSubject(e.target.value)} placeholder="Announcement Subject" required
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit' }} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 5, fontWeight: 600 }}>Message</label>
                <textarea value={broadcastBody} onChange={e => setBroadcastBody(e.target.value)} placeholder="Write your announcement..." required rows={4}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12, color: '#fff', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.4 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowBroadcast(false)} disabled={broadcastSending}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', borderRadius: 10, padding: '8px 18px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={broadcastSending || !broadcastSubject || !broadcastBody}
                  style={{ background: 'linear-gradient(135deg, #C084FC, #63B3ED)', border: 'none', color: '#fff', borderRadius: 10, padding: '8px 22px', fontSize: '0.82rem', fontWeight: 700, cursor: broadcastSending ? 'wait' : 'pointer', opacity: broadcastSending ? 0.7 : 1 }}>
                  {broadcastSending ? 'Sending...' : '📢 Send Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit Memo Modal */}
      {showCreditMemo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => !creditSending && setShowCreditMemo(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: '#111827', border: '1px solid rgba(72,187,120,0.15)', borderRadius: 18, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{ fontSize: '1.4rem' }}>💳</span>
              <div><h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>Issue Credit Memo</h3><p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>To: <strong style={{ color: '#48BB78' }}>{creditAgent?.full_name || 'Select Agent'}</strong></p></div>
              <div style={{ flex: 1 }} />
              <button onClick={() => setShowCreditMemo(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>✕</button>
            </div>
            {!creditAgent ? (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 5, fontWeight: 600 }}>Select Agent</label>
                <select onChange={e => { const a = agents.find(x => x.id === e.target.value); setCreditAgent(a || null); }}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit' }}>
                  <option value="">Choose...</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.full_name || a.username || a.email}</option>)}
                </select>
              </div>
            ) : (
              <form onSubmit={handleCreditMemo}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 5, fontWeight: 600 }}>Credit Amount</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
                    <span style={{ padding: '0 10px', color: '#48BB78', fontWeight: 700 }}>-$</span>
                    <input type="number" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} placeholder="0.00" step="0.01" min="0.01" required
                      style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '1rem', fontWeight: 700, padding: '10px 10px 10px 0', fontFamily: 'inherit' }} />
                  </div>
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 5, fontWeight: 600 }}>Reason</label>
                  <textarea value={creditDesc} onChange={e => setCreditDesc(e.target.value)} placeholder="Reason for credit..." required rows={2}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12, color: '#fff', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowCreditMemo(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', borderRadius: 10, padding: '8px 18px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={creditSending || !creditAmount}
                    style={{ background: 'linear-gradient(135deg, #48BB78, #38A169)', border: 'none', color: '#fff', borderRadius: 10, padding: '8px 22px', fontSize: '0.82rem', fontWeight: 700, cursor: creditSending ? 'wait' : 'pointer', opacity: creditSending ? 0.7 : 1 }}>
                    {creditSending ? 'Sending...' : '💳 Issue Credit'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
