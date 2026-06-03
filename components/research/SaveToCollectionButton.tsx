'use client';
import { useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';

export default function SaveToCollectionButton({ compoundSlug, compoundName }: { compoundSlug: string; compoundName: string }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const method = saved ? 'DELETE' : 'POST';
      const res = await fetch('/api/research/saved', {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ compound_slug: compoundSlug }),
      });
      if (res.status === 401) {
        window.location.href = `/login?redirect=/research/${compoundSlug}`;
        return;
      }
      if (res.ok) setSaved(!saved);
    } finally { setBusy(false); }
  }

  const Label = saved ? 'Saved' : 'Save';
  const Icon = saved ? BookmarkCheck : Bookmark;
  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={saved ? 'btn-primary' : 'btn-secondary'}
      title={saved ? `${compoundName} Is In Your Saved Collection` : `Save ${compoundName} To Your Collection`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2, 8px)', opacity: busy ? 0.6 : 1 }}
    >
      <Icon size={16} aria-hidden="true" />
      {Label}
    </button>
  );
}
