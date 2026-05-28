'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  agentSlug: string;
  displayName: string;
  primaryColor: string;
  logoUrl?: string | null;
  tagline?: string | null;
}

export default function AgentStorefrontLogin({
  agentSlug,
  displayName,
  primaryColor,
  logoUrl,
  tagline
}: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Authentication Failed');
      }

      // Success, refresh the page to load the catalog
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Network Error');
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--black)',
      padding: 'var(--space-6)'
    }}>
      <div className="card-metal" style={{
        maxWidth: 400,
        width: '100%',
        padding: 'var(--space-8)',
        border: `1px solid ${primaryColor}40`,
        boxShadow: `0 0 30px ${primaryColor}20`
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          {logoUrl ? (
            <img src={logoUrl} alt={displayName} style={{ height: 60, borderRadius: 8, marginBottom: 'var(--space-4)' }} />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: 12, margin: '0 auto var(--space-4)',
              background: `linear-gradient(135deg, ${primaryColor}40, var(--surface-2))`,
              border: `1px solid ${primaryColor}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-brand)', fontWeight: 800, fontSize: '1.5rem',
              color: primaryColor
            }}>
              {displayName[0].toUpperCase()}
            </div>
          )}
          <h2 style={{ color: 'var(--white)', fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>
            {displayName}
          </h2>
          {tagline && (
            <p style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>{tagline}</p>
          )}
        </div>

        {error && (
          <div style={{ background: 'var(--red-bg)', borderLeft: '3px solid var(--red)', padding: 'var(--space-3)', marginBottom: 'var(--space-4)', borderRadius: '0 4px 4px 0' }}>
            <p style={{ color: 'var(--red)', fontSize: '0.8rem', margin: 0, fontWeight: 500 }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label" style={{ color: primaryColor }}>Username</label>
            <input
              type="text"
              className="form-input"
              placeholder="Provided By Your Agent"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ color: primaryColor }}>Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{
              marginTop: 'var(--space-2)',
              background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}90)`,
              color: 'var(--black)',
              boxShadow: `0 4px 16px ${primaryColor}40`
            }}
          >
            {loading ? 'Authenticating...' : 'Enter Storefront'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 'var(--space-4)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--grey-400)' }}>
            Powered By PepNationLab White-Label Infrastructure
          </p>
        </div>
      </div>
    </div>
  );
}
