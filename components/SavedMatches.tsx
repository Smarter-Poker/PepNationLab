'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function SavedMatches({ userId }: { userId: string }) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('user_saved_matches')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      setMatches(data || []);
      setLoading(false);
    }
    load();
  }, [userId]);

  if (loading) {
    return <div style={{ color: 'var(--silver, #A8B4C0)', padding: 'var(--space-4, 16px)' }}>Loading saved matches...</div>;
  }

  if (matches.length === 0) {
    return (
      <div style={{ color: 'var(--silver, #A8B4C0)', padding: 'var(--space-6, 32px)', textAlign: 'center', background: 'var(--grey-400, #162230)', borderRadius: 'var(--radius-lg, 12px)' }}>
        <p>You haven't saved any research matches yet.</p>
        <Link href="/research/match" style={{ color: 'var(--teal, #00C4BC)', textDecoration: 'none', fontWeight: 600, marginTop: 'var(--space-2, 8px)', display: 'inline-block' }}>
          Try the Match Me Engine
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
      {matches.map(m => (
        <div key={m.id} style={{ 
          background: 'var(--grey-400, #162230)', 
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid rgba(168,180,192,0.1)',
          padding: 'var(--space-4, 16px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3, 12px)' }}>
            <div>
              <div style={{ color: 'var(--white, #FFFFFF)', fontWeight: 600, fontSize: '1.1rem' }}>
                Saved Match
              </div>
              <div style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.85rem' }}>
                {new Date(m.created_at).toLocaleDateString()}
              </div>
            </div>
            <Link 
              href={`/research/match?goal=${encodeURIComponent(m.match_input.goal || '')}&riskTolerance=${m.match_input.riskTolerance}&preference=${m.match_input.preference}`}
              style={{
                background: 'rgba(0,196,188,0.1)',
                color: 'var(--teal, #00C4BC)',
                padding: 'var(--space-2, 8px) var(--space-3, 12px)',
                borderRadius: 'var(--radius-md, 8px)',
                textDecoration: 'none',
                fontSize: '0.85rem',
                fontWeight: 700
              }}
            >
              Re-run Match
            </Link>
          </div>
          
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: 'var(--space-3, 12px)', borderRadius: 'var(--radius-md, 8px)', marginBottom: 'var(--space-3, 12px)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', marginBottom: '4px' }}>Input Parameters</div>
            <div style={{ color: 'var(--white, #FFFFFF)', fontSize: '0.95rem' }}>Goal: {m.match_input.goal || 'General'}</div>
            <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', marginTop: 'var(--space-2, 8px)', fontSize: '0.8rem', color: 'var(--teal, #00C4BC)' }}>
              <span>Risk: {m.match_input.riskTolerance}</span>
              <span>Format: {m.match_input.preference}</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', marginBottom: '8px' }}>Top Matches</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2, 8px)' }}>
              {m.results.slice(0, 3).map((r: any) => (
                <Link key={r.slug} href={`/research/${r.slug}`} style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--white, #FFFFFF)',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  fontSize: '0.85rem',
                  textDecoration: 'none'
                }}>
                  {r.displayName} <span style={{ color: 'var(--silver, #A8B4C0)' }}>({r.score})</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
