'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface SavedCompound {
  id: string;
  compound_slug: string;
  collection_name: string;
  notes: string | null;
  created_at: string;
}

interface ReadingQueueItem {
  id: string;
  compound_slug: string | null;
  reference_id: string | null;
  position: number;
  read_at: string | null;
  created_at: string;
}

export default function CollectionsManager() {
  const [activeTab, setActiveTab] = useState<'collections' | 'history'>('collections');
  const [saved, setSaved] = useState<SavedCompound[]>([]);
  const [history, setHistory] = useState<ReadingQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [savedRes, historyRes] = await Promise.all([
          fetch('/api/research/saved'),
          fetch('/api/research/reading-queue')
        ]);
        
        if (savedRes.ok) {
          const s = await savedRes.json();
          setSaved(s.saved || []);
        }
        if (historyRes.ok) {
          const h = await historyRes.json();
          setHistory(h.queue || []);
        }
      } catch (err) {
        console.error('Error fetching collections', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const removeSaved = async (slug: string, collection: string) => {
    try {
      await fetch('/api/research/saved', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compound_slug: slug, collection_name: collection })
      });
      setSaved(prev => prev.filter(s => !(s.compound_slug === slug && s.collection_name === collection)));
    } catch (err) {
      console.error(err);
    }
  };

  const removeHistory = async (id: string) => {
    try {
      await fetch('/api/research/reading-queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      setHistory(prev => prev.filter(h => h.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const collectionsMap = saved.reduce((acc, curr) => {
    const name = curr.collection_name || 'Default';
    if (!acc[name]) acc[name] = [];
    acc[name].push(curr);
    return acc;
  }, {} as Record<string, SavedCompound[]>);

  const collections = Object.keys(collectionsMap).sort();

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-5)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => setActiveTab('collections')}
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'collections' ? '2px solid var(--teal)' : '2px solid transparent',
            color: activeTab === 'collections' ? 'var(--white)' : 'var(--grey-400)',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          My Collections
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid var(--teal)' : '2px solid transparent',
            color: activeTab === 'history' ? 'var(--white)' : 'var(--grey-400)',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Reading History
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--silver)' }}>Loading...</div>
      ) : activeTab === 'collections' ? (
        collections.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ color: 'var(--grey-400)', fontSize: '0.9rem', fontWeight: 600, marginBottom: 12 }}>
              No Collections Yet
            </div>
            <Link href="/research/search" style={{ display: 'inline-block', fontSize: '0.82rem', color: 'var(--teal)', fontWeight: 600 }}>
              Search Library
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {collections.map(cName => (
              <div key={cName}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: 'var(--space-4)' }}>{cName}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                  {collectionsMap[cName].map(s => (
                    <div key={s.id} className="glass-panel hover-lift" style={{ padding: 'var(--space-4)' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: 4, textTransform: 'capitalize' }}>
                        {s.compound_slug.replace(/-/g, ' ')}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--grey-400)', marginBottom: 12 }}>
                        Added {new Date(s.created_at).toLocaleDateString()}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link href={`/research/${s.compound_slug}`} style={{ flex: 1, textAlign: 'center', padding: '6px 12px', background: 'rgba(0,196,188,0.1)', border: '1px solid rgba(0,196,188,0.2)', borderRadius: 6, color: 'var(--teal)', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none' }}>
                          View Report
                        </Link>
                        <button onClick={() => removeSaved(s.compound_slug, s.collection_name)} style={{ padding: '6px 12px', background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.15)', borderRadius: 6, color: '#FC8181', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        history.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ color: 'var(--grey-400)', fontSize: '0.9rem', fontWeight: 600, marginBottom: 12 }}>
              No Reading History
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
            {history.map(h => (
              <div key={h.id} className="glass-panel hover-lift" style={{ padding: 'var(--space-4)' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: 4, textTransform: 'capitalize' }}>
                  {h.compound_slug ? h.compound_slug.replace(/-/g, ' ') : 'Reference Article'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--grey-400)', marginBottom: 12 }}>
                  Viewed {new Date(h.created_at).toLocaleDateString()}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {h.compound_slug && (
                    <Link href={`/research/${h.compound_slug}`} style={{ flex: 1, textAlign: 'center', padding: '6px 12px', background: 'rgba(0,196,188,0.1)', border: '1px solid rgba(0,196,188,0.2)', borderRadius: 6, color: 'var(--teal)', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none' }}>
                      Re-read
                    </Link>
                  )}
                  <button onClick={() => removeHistory(h.id)} style={{ padding: '6px 12px', background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.15)', borderRadius: 6, color: '#FC8181', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
