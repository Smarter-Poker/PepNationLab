'use client';
import { useState } from 'react';
import { ListPlus, ListChecks } from 'lucide-react';
import GuestAuthModal from '@/components/GuestAuthModal';

export default function AddToReadingQueueButton({ compoundSlug, compoundName }: { compoundSlug: string; compoundName: string }) {
  const [queued, setQueued] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);

  async function add() {
    if (queued || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/research/reading-queue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ compound_slug: compoundSlug }),
      });
      if (res.status === 401) {
        setShowGuestModal(true);
        return;
      }
      if (res.ok) setQueued(true);
    } finally { setBusy(false); }
  }

  const Label = queued ? 'In Reading Queue' : 'Add To Reading Queue';
  const Icon = queued ? ListChecks : ListPlus;
  return (
    <>
      <button
        onClick={add}
        disabled={queued || busy}
        className={queued ? 'btn-primary' : 'btn-secondary'}
        title={queued ? `${compoundName} Is In Your Reading Queue` : `Queue ${compoundName} For Reading`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2, 8px)', opacity: busy ? 0.6 : 1 }}
      >
        <Icon size={16} aria-hidden="true" />
        {Label}
      </button>
      <GuestAuthModal
        open={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        featureLabel="Reading Queue"
      />
    </>
  );
}
