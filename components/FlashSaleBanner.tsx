'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Zap } from 'lucide-react';

interface ActiveSale {
  id: string;
  name: string;
  banner_text: string | null;
  discount_pct: number;
  starts_at: string;
  ends_at: string;
}

function fmtRemaining(ms: number): string {
  if (ms <= 0) return 'Ended';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (days > 0) return `${days}d ${h}h ${m}m`;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * fix-56 #2: Flash Sale Banner. Visible storefront-wide when an active
 * flash sale exists. Hides itself on admin / api paths so it doesn't
 * intrude on the admin dashboard.
 *
 * Mount once in app/layout.tsx - pathname check keeps it scoped.
 */
export default function FlashSaleBanner() {
  const [sale, setSale] = useState<ActiveSale | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [pathname, setPathname] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPathname(window.location.pathname);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Skip the fetch on admin/api paths so it never even hits the DB there
    const path = window.location.pathname;
    if (path.startsWith('/admin') || path.startsWith('/api')) return;

    let aborted = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('flash_sales')
          .select('id, name, banner_text, discount_pct, starts_at, ends_at')
          .eq('is_active', true)
          .lte('starts_at', new Date().toISOString())
          .gte('ends_at', new Date().toISOString())
          .order('ends_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (aborted || error || !data) return;
        setSale(data as ActiveSale);
      } catch { /* silent */ }
    })();
    return () => { aborted = true; };
  }, []);

  useEffect(() => {
    if (!sale) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sale]);

  if (!sale) return null;
  if (pathname.startsWith('/admin') || pathname.startsWith('/api')) return null;

  const endsAtMs = new Date(sale.ends_at).getTime();
  const remaining = endsAtMs - now;
  if (remaining <= 0) return null;

  const message = sale.banner_text || `Flash Sale: ${sale.discount_pct}% Off - Ends Soon`;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 90,
        background: 'linear-gradient(90deg, #00C4BC 0%, #00A6A0 100%)',
        color: '#000',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        fontSize: '0.88rem',
        fontWeight: 700,
        boxShadow: '0 2px 12px rgba(0,196,188,0.35)',
        flexWrap: 'wrap',
      }}
    >
      <Zap size={16} aria-hidden="true" />
      <span>{message}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', background: 'rgba(0,0,0,0.15)', padding: '2px 8px', borderRadius: 6 }}>
        {fmtRemaining(remaining)}
      </span>
    </div>
  );
}
