'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { sanitizeUsername } from '@/lib/usernames';

interface Props {
  token: string;
  email: string;
  suggestedFullName: string;
  intendedRole: string;
}

export default function InviteRedeemClient({ token, email, suggestedFullName, intendedRole }: Props) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fullName, setFullName] = useState(suggestedFullName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const cleanedUsername = sanitizeUsername(username);
    if (cleanedUsername.length < 3) {
      setError('Username Must Be At Least 3 Characters.');
      return;
    }
    if (password.length < 8) {
      setError('Password Must Be At Least 8 Characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords Do Not Match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/agent-invitations/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          username: cleanedUsername,
          full_name: fullName.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Failed To Accept Invitation.');
        setSubmitting(false);
        return;
      }

      // Sign in with the freshly minted account so the dashboard is reachable
      // without a manual login round-trip.
      const supabase = createClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInErr) {
        router.push('/login?msg=invite_redeemed');
        return;
      }

      // Single-session enforcement — best-effort, never block login
      supabase.auth.signOut({ scope: 'others' }).catch(() => {});

      // Wait until Supabase confirms the session is readable locally (max 3s).
      // On mobile incognito the cookie write is async — navigating too soon
      // means the server request arrives before the cookie exists.
      for (let i = 0; i < 15; i++) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) break;
        await new Promise(r => setTimeout(r, 200));
      }

      // Hard navigation ensures that the browser sends the new session cookie to the server
      window.location.href = '/dashboard';
    } catch {
      setError('Failed To Accept Invitation.');
      setSubmitting(false);
    }
  }

  const roleLabel = intendedRole === 'super_agent' ? 'Super Agent' : 'Agent';

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div>
        <label style={{ fontSize: '0.78rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
          Email
        </label>
        <div
          style={{
            padding: 'var(--space-3)',
            background: 'var(--surface-1)',
            border: 'var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.9rem',
            color: 'var(--silver)',
            textTransform: 'none' as const,
          }}
        >
          {email}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', marginTop: 4 }}>
          Role: <span style={{ color: 'var(--teal)' }}>{roleLabel}</span>
        </div>
      </div>

      <div>
        <label htmlFor="full-name" style={{ fontSize: '0.78rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
          Full Name
        </label>
        <input
          id="full-name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          maxLength={200}
          className="input"
          autoComplete="name"
        />
      </div>

      <div>
        <label htmlFor="username" style={{ fontSize: '0.78rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
          Choose Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
          required
          minLength={3}
          maxLength={30}
          className="input"
          autoComplete="username"
          style={{ textTransform: 'none' as const }}
          placeholder="agent_handle"
        />
        <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', marginTop: 4 }}>
          Lowercase Letters, Numbers, And Underscores Only.
        </div>
      </div>

      <div>
        <label htmlFor="password" style={{ fontSize: '0.78rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="input"
          autoComplete="new-password"
          style={{ textTransform: 'none' as const }}
        />
        <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', marginTop: 4 }}>
          At Least 8 Characters.
        </div>
      </div>

      <div>
        <label htmlFor="password-confirm" style={{ fontSize: '0.78rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
          Confirm Password
        </label>
        <input
          id="password-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          className="input"
          autoComplete="new-password"
          style={{ textTransform: 'none' as const }}
        />
      </div>

      {error && (
        <div
          style={{
            padding: 'var(--space-3)',
            background: 'rgba(229,62,62,0.1)',
            border: '1px solid rgba(229,62,62,0.35)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--red)',
            fontSize: '0.82rem',
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="btn btn-primary"
        style={{ width: '100%', fontSize: '0.92rem' }}
      >
        {submitting ? 'Setting Up Account...' : 'Accept Invitation'}
      </button>
    </form>
  );
}
