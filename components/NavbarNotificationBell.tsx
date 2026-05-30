'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface NotifSummary {
  unread_count: number;
  recent: Array<{
    id: string;
    title: string;
    body: string | null;
    url: string | null;
    created_at: string;
    kind: 'message' | 'push' | 'order';
  }>;
}

export default function NavbarNotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotifSummary>({ unread_count: 0, recent: [] });
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/account/notifications/feed', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setData({ unread_count: json?.unread_count ?? 0, recent: json?.recent ?? [] });
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        aria-label="Notifications"
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: 'var(--surface-2)',
          border: '1.5px solid var(--teal)',
          boxShadow: '0 0 10px rgba(192, 184, 168, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
          marginRight: 'var(--space-2)',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {data.unread_count > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: 'var(--red, #E53E3E)',
              color: 'var(--white)',
              fontSize: '0.7rem',
              fontWeight: 900,
              borderRadius: '50%',
              minWidth: 18,
              height: 18,
              padding: '0 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {data.unread_count > 99 ? '99+' : data.unread_count}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 52,
            right: 0,
            width: 360,
            maxWidth: '90vw',
            background: 'var(--black-2)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
            zIndex: 999,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--white)', fontWeight: 700 }}>Notifications</span>
            <Link href="/account/notifications" onClick={() => setOpen(false)} style={{ color: 'var(--teal)', fontSize: '0.78rem', textDecoration: 'none' }}>
              Preferences
            </Link>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {loading && data.recent.length === 0 ? (
              <div style={{ padding: 'var(--space-4)', color: 'var(--silver)', textAlign: 'center' }}>Loading…</div>
            ) : data.recent.length === 0 ? (
              <div style={{ padding: 'var(--space-4)', color: 'var(--silver)', textAlign: 'center' }}>No Notifications.</div>
            ) : (
              data.recent.map((n) => (
                <Link
                  key={`${n.kind}-${n.id}`}
                  href={n.url || '/account/notifications'}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'block',
                    padding: 'var(--space-3) var(--space-4)',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    textDecoration: 'none',
                  }}
                >
                  <div style={{ color: 'var(--white)', fontSize: '0.88rem', fontWeight: 600 }}>{n.title}</div>
                  {n.body && (
                    <div style={{ color: 'var(--silver)', fontSize: '0.78rem', marginTop: 2 }}>
                      {n.body.length > 100 ? `${n.body.slice(0, 100)}…` : n.body}
                    </div>
                  )}
                  <div style={{ color: 'var(--grey-400)', fontSize: '0.7rem', marginTop: 4 }}>
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </Link>
              ))
            )}
          </div>
          <div style={{ padding: 'var(--space-2)', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
            <Link
              href="/messenger"
              onClick={() => setOpen(false)}
              style={{ color: 'var(--teal)', fontSize: '0.82rem', textDecoration: 'none', padding: 'var(--space-2)', display: 'inline-block' }}
            >
              Open Messenger
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
