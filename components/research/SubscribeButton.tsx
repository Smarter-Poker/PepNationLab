'use client';
import { useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import GuestAuthModal from '@/components/GuestAuthModal';

export default function SubscribeButton({ compoundSlug, compoundName }: { compoundSlug: string; compoundName: string }) {
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const method = subscribed ? 'DELETE' : 'POST';
      const res = await fetch('/api/research/subscriptions', {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ compound_slug: compoundSlug }),
      });
      if (res.status === 401) {
        setShowGuestModal(true);
        return;
      }
      if (res.ok) setSubscribed(!subscribed);
    } finally { setBusy(false); }
  }

  const Label = subscribed ? 'Subscribed' : 'Notify Me';
  const Icon = subscribed ? BellRing : Bell;
  return (
    <>
      <button
        onClick={toggle}
        disabled={busy}
        className={subscribed ? 'btn-primary' : 'btn-secondary'}
        title={subscribed ? `You Are Subscribed To ${compoundName} Updates` : `Get Notified When ${compoundName} Has New Evidence Or A Recall Update`}
        aria-label={subscribed ? `Unsubscribe from ${compoundName} updates` : `Subscribe to ${compoundName} updates`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2, 8px)', opacity: busy ? 0.6 : 1 }}
      >
        <Icon size={16} aria-hidden="true" />
        {Label}
      </button>
      <GuestAuthModal
        open={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        featureLabel="Research Subscriptions"
      />
    </>
  );
}
