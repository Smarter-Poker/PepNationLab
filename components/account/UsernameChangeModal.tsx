'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { sanitizeUsername, validateUsername } from '@/lib/usernames';
import { useModalA11y } from '@/lib/useModalA11y';

interface Props {
  open: boolean;
  currentUsername: string | null;
  usernameChangedAt: string | null;
  onClose: () => void;
  onChanged: (next: { username: string; username_changed_at: string }) => void;
}

const COOLDOWN_DAYS = 30;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export default function UsernameChangeModal({
  open,
  currentUsername,
  usernameChangedAt,
  onClose,
  onChanged,
}: Props) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue('');
  }, [open]);

  const cooldownInfo = useMemo(() => {
    if (!usernameChangedAt) return { active: false, daysLeft: 0 };
    const last = new Date(usernameChangedAt).getTime();
    if (Number.isNaN(last)) return { active: false, daysLeft: 0 };
    const diff = Date.now() - last;
    if (diff >= COOLDOWN_MS) return { active: false, daysLeft: 0 };
    return {
      active: true,
      daysLeft: Math.ceil((COOLDOWN_MS - diff) / (24 * 60 * 60 * 1000)),
    };
  }, [usernameChangedAt]);

  const cleaned = sanitizeUsername(value);
  const validation = validateUsername(cleaned);

  // A11y: initial focus, Tab trap, Escape-to-close, focus restore
  const dialogRef = useModalA11y<HTMLDivElement>(open, { onClose });

  if (!open) return null;

  const submit = async () => {
    if (cooldownInfo.active) {
      toast.error(`Wait ${cooldownInfo.daysLeft} More Day(s) Before Changing Again.`);
      return;
    }
    if (!validation.valid) {
      toast.error(validation.error ?? 'Invalid Username.');
      return;
    }
    if (cleaned === (currentUsername ?? '').toLowerCase()) {
      toast.error('Username Unchanged.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/agent/profile/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleaned }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed To Change Username.');
      }
      toast.success('Username Updated.');
      onChanged({
        username: json.username,
        username_changed_at: json.username_changed_at,
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed To Change Username.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="username-modal-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
    >
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440, width: '100%', padding: 'var(--space-6)' }}
      >
        <h3 id="username-modal-title" style={{ marginTop: 0, marginBottom: 'var(--space-3)', color: 'var(--white)' }}>
          Change Username
        </h3>

        <p style={{ fontSize: '0.85rem', color: 'var(--silver)', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
          Lowercase Letters, Numbers, And Underscores Only. You Can Only Change This Once Every {COOLDOWN_DAYS} Days.
        </p>

        {cooldownInfo.active && (
          <div
            style={{
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(229,62,62,0.08)',
              border: '1px solid rgba(229,62,62,0.3)',
              color: 'var(--red, #E53E3E)',
              fontSize: '0.85rem',
              marginBottom: 'var(--space-4)',
            }}
          >
            You Can Change Your Username Again In {cooldownInfo.daysLeft} Day(s).
          </div>
        )}

        <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
          <label className="form-label" htmlFor="username-input">New Username</label>
          <input
            id="username-input"
            type="text"
            className="form-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. janedoe"
            autoFocus
            disabled={saving || cooldownInfo.active}
            autoComplete="off"
            inputMode="text"
            spellCheck={false}
          />
          {cleaned && cleaned !== value.toLowerCase() && (
            <p style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--silver)' }}>
              Will Be Stored As: <strong style={{ color: 'var(--teal)', fontFamily: 'monospace' }}>{cleaned}</strong>
            </p>
          )}
          {!validation.valid && value.length > 0 && (
            <p style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--red, #E53E3E)' }}>
              {validation.error}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={saving || cooldownInfo.active || !validation.valid}
          >
            {saving ? 'Saving...' : 'Save Username'}
          </button>
        </div>
      </div>
    </div>
  );
}
