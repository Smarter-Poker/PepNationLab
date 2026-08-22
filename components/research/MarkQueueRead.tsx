'use client';

import { useEffect } from 'react';

// Invisible companion to AddToReadingQueueButton: when a signed-in user views
// a compound monograph, mark any unread reading-queue entry for that compound
// as read. This is the only writer of read_at, so without it the "Read"
// section of /research/reading-queue would stay empty forever. Fire-and-forget:
// guests get a silent 401 and nothing renders either way.

export default function MarkQueueRead({ compoundSlug }: { compoundSlug: string }) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/research/reading-queue', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const json = await res.json().catch(() => null);
        const items: { id: string; compound_slug: string | null; read_at: string | null }[] = json?.queue ?? [];
        const match = items.find(i => i.compound_slug === compoundSlug && !i.read_at);
        if (!match || cancelled) return;
        await fetch('/api/research/reading-queue', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: match.id, read_at: new Date().toISOString() }),
        });
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [compoundSlug]);

  return null;
}
