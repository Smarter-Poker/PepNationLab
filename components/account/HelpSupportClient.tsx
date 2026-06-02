'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, LifeBuoy, MessageSquare } from 'lucide-react';

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
    a: 'Open Order History And Reorders From Your Account To Re-Order A Past Protocol In One Tap. Prices Are Re-Checked Against The Current Catalog At Reorder Time And You Land Straight In Checkout To Review.',
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

export default function HelpSupportClient() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);

  async function contactSupport() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/messenger/support/open', {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed To Open Support.');
      if (json.conversationId) {
        router.push(`/messenger?conversation=${encodeURIComponent(json.conversationId)}`);
      } else {
        router.push('/messenger');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed To Open Support.');
    } finally {
      setBusy(false);
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
            Find Quick Answers Below, Or Start A Chat With Our Support Team.
          </p>
        </div>

        <section className="card-metal" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--teal)', marginTop: 0, fontSize: '1.05rem' }}>
            <MessageSquare size={18} aria-hidden /> Contact Support
          </h2>
          <p style={{ color: 'var(--silver)', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 var(--space-4)' }}>
            Start A Direct Message With Our Support Team. We Will Reply In Your Messenger Inbox.
          </p>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={contactSupport}>
            {busy ? 'Opening...' : 'Start A Support Chat'}
          </button>
        </section>

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

        <p style={{ color: 'var(--silver)', fontSize: '0.82rem', textAlign: 'center', margin: 0 }}>
          Looking For Something Else? Visit{' '}
          <Link href="/account" style={{ color: 'var(--teal)' }}>Your Account Settings</Link>.
        </p>
      </div>
    </div>
  );
}
