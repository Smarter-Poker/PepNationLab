'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LifeBuoy } from 'lucide-react';
import { toast } from 'sonner';

/**
 * fix-56 #6: floating "Contact Support" button. Visible only on /messenger,
 * hidden for admin users (they're the sink, not the seeker). Click opens
 * (or reuses) the user's support thread with admin and routes to it.
 */
export default function SupportButton() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Mount-time visibility check: only on /messenger paths, hide for admins.
    if (typeof window === 'undefined') return;
    if (!window.location.pathname.startsWith('/messenger')) return;

    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (profile?.role !== 'admin') setShow(true);
      } catch {
        // Silent — button just stays hidden
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onClick = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/messenger/support/open', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed To Open Support');
        return;
      }
      // Navigate to the conversation. Messenger reads ?conversation=<id>
      // (the standard query the existing list supports). If not, the new
      // thread will appear at the top of the user's conversation list.
      router.push(`/messenger?conversation=${encodeURIComponent(json.conversationId)}`);
    } catch {
      toast.error('Network Error');
    } finally {
      setBusy(false);
    }
  }, [busy, router]);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label="Contact Pep Nation Support"
      title="Contact Pep Nation Support"
      style={{
        position: 'fixed',
        right: 'max(16px, env(safe-area-inset-right))',
        bottom: 'calc(max(16px, env(safe-area-inset-bottom)) + 64px)',
        zIndex: 80,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 999,
        background: 'var(--teal, #00C4BC)',
        color: '#000',
        border: 0,
        fontSize: '0.85rem',
        fontWeight: 700,
        boxShadow: '0 4px 16px rgba(0,196,188,0.35)',
        cursor: busy ? 'wait' : 'pointer',
        opacity: busy ? 0.7 : 1,
      }}
    >
      <LifeBuoy size={16} aria-hidden="true" />
      Support
    </button>
  );
}
