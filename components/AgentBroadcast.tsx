'use client';

import { useCallback, useEffect, useState } from 'react';
import { Megaphone, Send, Users, Check } from 'lucide-react';

// Agent researcher-broadcast center: send an announcement to every active
// researcher in the downline, and review send history. Talks to
// /api/agent/broadcasts.

interface Broadcast {
  id: string;
  title: string;
  body: string;
  url: string | null;
  recipient_count: number;
  sent_count: number;
  created_at: string;
}

export default function AgentBroadcast() {
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agent/broadcasts', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      setHistory(Array.isArray(json.data) ? json.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/agent/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, url: url || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json?.error || 'Could Not Send The Broadcast.'); return; }
      setResult(`Sent To ${json.sent} Of ${json.total} Researchers.`);
      setTitle(''); setMessage(''); setUrl('');
      await load();
    } catch {
      setError('Something Went Wrong. Please Try Again.');
    } finally {
      setSending(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.65rem 0.85rem', background: '#0F1923',
    border: '1px solid #1D2D3E', borderRadius: '10px', color: '#FFFFFF', fontSize: '0.95rem',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#A8B4C0', marginBottom: '0.35rem',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#FFFFFF', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Megaphone size={26} color="#00C4BC" /> Broadcast To Researchers
        </h1>
        <p style={{ color: '#A8B4C0', marginTop: '0.4rem', fontSize: '0.95rem' }}>
          Send An Announcement To Every Active Researcher In Your Downline. They Receive It In-App And As A Push Notification.
        </p>
      </div>

      <form onSubmit={send} style={{ padding: '1.5rem', background: '#0F1923', border: '1px solid #1D2D3E', borderRadius: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input type="text" required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New Stock Just Landed" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Message</label>
            <textarea required maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Fresh Inventory Of Your Favorites Is In. Tap To Browse." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label style={labelStyle}>Link (Optional, Must Start With /)</label>
            <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/products" style={inputStyle} />
          </div>
        </div>

        {error && <p style={{ color: '#E53E3E', fontSize: '0.85rem', marginTop: '0.85rem', marginBottom: 0 }}>{error}</p>}
        {result && <p style={{ color: '#48BB78', fontSize: '0.85rem', marginTop: '0.85rem', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Check size={15} /> {result}</p>}

        <div style={{ marginTop: '1.15rem' }}>
          <button type="submit" disabled={sending} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.3rem', background: '#00C4BC', color: '#050A0F', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.65 : 1 }}>
            <Send size={17} /> {sending ? 'Sending...' : 'Send Broadcast'}
          </button>
        </div>
      </form>

      <div>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 0.85rem' }}>Recent Broadcasts</h2>
        {loading ? (
          <p style={{ color: '#A8B4C0' }}>Loading...</p>
        ) : history.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', background: '#0F1923', border: '1px dashed #1D2D3E', borderRadius: '16px', color: '#A8B4C0' }}>
            No Broadcasts Yet. Send Your First Announcement Above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {history.map((b) => (
              <div key={b.id} style={{ padding: '1rem 1.25rem', background: '#0F1923', border: '1px solid #1D2D3E', borderRadius: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{b.title}</span>
                  <span style={{ color: '#A8B4C0', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Users size={13} /> {b.sent_count} / {b.recipient_count}
                  </span>
                </div>
                <p style={{ color: '#A8B4C0', fontSize: '0.88rem', margin: '0.4rem 0 0' }}>{b.body}</p>
                <span style={{ color: '#6b7785', fontSize: '0.75rem' }}>{new Date(b.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
