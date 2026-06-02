'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ChevronDown, LifeBuoy, MessageSquare, FileText } from 'lucide-react';

interface Ticket {
  id: string;
  subject: string;
  category: string;
  message: string;
  status: string;
  created_at: string;
}

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'How Do I Pay For An Order?',
    a: 'Orders Are Paid Via Zelle, Venmo, Cash App, Or Apple Pay. After Placing An Order You Will See Your Agent’s Payment Handle And Instructions. No Credit Cards Are Processed On This Platform.',
  },
  {
    q: 'When Will My Order Ship?',
    a: 'Once Your Agent Confirms Your Payment, Your Order Moves Into Fulfillment And Ships. You Can Track Status Any Time Under Orders.',
  },
  {
    q: 'How Do Refills And Reorders Work?',
    a: 'Open Refills & Reorders From Your Account To Re-Order A Past Protocol In One Tap. Prices Are Re-Checked Against The Current Catalog At Reorder Time.',
  },
  {
    q: 'What Is The Research-Only Disclaimer?',
    a: 'All Products Are Sold Strictly For Laboratory And Research Use Only. You Must Acknowledge The Disclaimer To Use The Platform. You Can Review Or Re-Acknowledge It Under Compliance & Disclaimers.',
  },
  {
    q: 'How Do I Earn Store Credit?',
    a: 'Share Your Referral Code From The Referrals Page. Qualifying Referrals Add Store Credit To Your Wallet, Which You Can Apply At Checkout.',
  },
  {
    q: 'How Do I Update My Shipping Address Or Payment Method?',
    a: 'Manage Both From Your Account: Saved Addresses And Default Payment Method. Changes Apply To Your Next Checkout.',
  },
];

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'general',    label: 'General Question' },
  { value: 'order',      label: 'Order Issue' },
  { value: 'payment',    label: 'Payment Issue' },
  { value: 'technical',  label: 'Technical Problem' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'account',    label: 'Account' },
];

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

const fmtDate = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function HelpSupportClient() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  async function loadTickets() {
    try {
      const res = await fetch('/api/account/support', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setTickets(Array.isArray(json.tickets) ? json.tickets : []);
    } catch {
      /* non-fatal */
    } finally {
      setLoadingTickets(false);
    }
  }

  useEffect(() => { loadTickets(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (subject.trim().length < 3) { toast.error('Please Add A Short Subject.'); return; }
    if (message.trim().length < 10) { toast.error('Please Describe Your Issue In A Little More Detail.'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/account/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subject: subject.trim(), category, message: message.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Submit Failed.');
      toast.success('Support Request Submitted. Our Team Will Follow Up.');
      setSubject('');
      setMessage('');
      setCategory('general');
      if (json.ticket) setTickets((prev) => [json.ticket, ...prev]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submit Failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)', padding: 'var(--space-6) var(--space-4)' }}>
      <div className="container" style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div>
          <h1
            className="animated-gradient-text"
            style={{ color: 'var(--white)', fontSize: '1.6rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-2)' }}
          >
            Help & Support
          </h1>
          <p style={{ color: 'var(--silver)', fontSize: '0.92rem', margin: 0 }}>
            Find Quick Answers Below, Or Send Our Team A Message.
          </p>
        </div>

        <section className="card-metal" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--teal)', marginTop: 0, fontSize: '1.05rem' }}>
            <LifeBuoy size={18} aria-hidden /> Frequently Asked Questions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {FAQ.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={i} style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    aria-expanded={open}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-3)',
                      padding: '12px 0',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--white)',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      textAlign: 'left',
                      minHeight: 44,
                    }}
                  >
                    {item.q}
                    <ChevronDown
                      size={18}
                      aria-hidden
                      style={{ color: 'var(--silver)', flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}
                    />
                  </button>
                  {open && (
                    <p style={{ color: 'var(--silver)', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 12px' }}>
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="card-metal" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--teal)', marginTop: 0, fontSize: '1.05rem' }}>
            <MessageSquare size={18} aria-hidden /> Contact Support
          </h2>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="support-subject">Subject</label>
              <input
                id="support-subject"
                type="text"
                className="form-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={160}
                placeholder="Brief Summary Of Your Question"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="support-category">Category</label>
              <select
                id="support-category"
                className="form-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="support-message">How Can We Help?</label>
              <textarea
                id="support-message"
                className="form-input"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={4000}
                placeholder="Describe Your Issue Or Question In Detail."
              />
              <div style={{ marginTop: 4, textAlign: 'right', fontSize: '0.7rem', color: 'var(--silver)' }}>
                {message.length}/4000
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Sending...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </section>

        <section className="card-metal" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--teal)', marginTop: 0, fontSize: '1.05rem' }}>
            <FileText size={18} aria-hidden /> Your Requests
          </h2>
          {loadingTickets ? (
            <p style={{ color: 'var(--silver)', fontSize: '0.88rem', margin: 0 }}>Loading...</p>
          ) : tickets.length === 0 ? (
            <p style={{ color: 'var(--silver)', fontSize: '0.88rem', margin: 0 }}>
              You Have No Support Requests Yet.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {tickets.map((t) => (
                <li
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 10,
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', color: 'var(--white)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.subject}
                    </span>
                    <span style={{ color: 'var(--silver)', fontSize: '0.72rem' }}>{fmtDate(t.created_at)}</span>
                  </span>
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: t.status === 'resolved' ? 'rgba(46,213,115,0.18)' : 'rgba(0,196,188,0.16)',
                      color: t.status === 'resolved' ? '#2ed573' : 'var(--teal)',
                    }}
                  >
                    {STATUS_LABEL[t.status] || 'Open'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p style={{ color: 'var(--silver)', fontSize: '0.82rem', textAlign: 'center', margin: 0 }}>
          Looking For Something Else? Visit{' '}
          <Link href="/account" style={{ color: 'var(--teal)' }}>Your Account Settings</Link>.
        </p>
      </div>
    </div>
  );
}
