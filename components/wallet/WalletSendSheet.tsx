'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';

/**
 * Send Funds sheet. Posts to /api/credits/send, which atomically debits the
 * sender's wallet (or bills a credit-line agent's credit line) and credits the
 * recipient's wallet, recording a transaction on both sides.
 *
 * v2: fuzzy-match recipient picker. As the operator types, the sheet hits
 * /api/wallet/search-recipients and surfaces candidates by full name +
 * username/email + role. No placeholder ghost text. Thick brushed-nickel
 * frame matching the rest of the platform's premium modals.
 */

type Recipient = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  role: string | null;
  role_label: string;
};

function recipientDisplayName(r: Recipient): string {
  return (r.full_name && r.full_name.trim())
    || (r.username && r.username.trim())
    || (r.email && r.email.trim())
    || 'Recipient';
}

function recipientHandle(r: Recipient): string {
  if (r.username && r.username.trim()) return `@${r.username.trim()}`;
  if (r.email && r.email.trim()) return r.email.trim();
  return '';
}

export default function WalletSendSheet({
  onClose,
  onSent,
}: {
  onClose: () => void;
  onSent: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Recipient[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selected, setSelected] = useState<Recipient | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Debounced fuzzy search.
  useEffect(() => {
    if (selected) return; // freeze searches while a recipient is locked in
    const q = query.trim();
      // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = window.setTimeout(() => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      fetch(`/api/wallet/search-recipients?q=${encodeURIComponent(q)}`, {
        signal: ctrl.signal,
        cache: 'no-store',
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((j) => {
          const list: Recipient[] = Array.isArray(j?.results) ? j.results : [];
          setResults(list);
          setActiveIndex(0);
          setSearching(false);
        })
        .catch((e) => {
          if (e?.name === 'AbortError') return;
          setSearching(false);
        });
    }, 180);
    return () => window.clearTimeout(handle);
  }, [query, selected]);

  // Esc closes the sheet; ArrowUp/Down + Enter navigate the dropdown.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      } else if (searchOpen && !selected && results.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveIndex((i) => Math.min(results.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIndex((i) => Math.max(0, i - 1));
        } else if (e.key === 'Enter' && document.activeElement === inputRef.current) {
          e.preventDefault();
          const pick = results[activeIndex];
          if (pick) {
            setSelected(pick);
            setSearchOpen(false);
            setQuery('');
          }
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, results, activeIndex, selected, onClose]);

  // Close dropdown if click lands outside the input + dropdown.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!searchOpen) return;
      const t = e.target as Node;
      if (dropdownRef.current?.contains(t)) return;
      if (inputRef.current?.contains(t)) return;
      setSearchOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [searchOpen]);

  const amountNumber = useMemo(() => {
    const v = Math.round((Number(amount) || 0) * 100) / 100;
    return Number.isFinite(v) ? v : 0;
  }, [amount]);

  const canSubmit = !!selected && amountNumber > 0 && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selected) return;
    setBusy(true);
    try {
      const payload = {
        recipientId: selected.id,
        amount: amountNumber,
        note: note.trim() || undefined,
      };
      const res = await fetch('/api/credits/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed To Send Funds.');
      toast.success(`Sent $${amountNumber.toFixed(2)} To ${json?.recipient?.name || recipientDisplayName(selected)}.`);
      onSent();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed To Send Funds.');
    } finally {
      setBusy(false);
    }
  }

  // Brushed-nickel tokens - thicker bezel for a premium feel.
  const NICKEL_OUTER = 'linear-gradient(145deg, #c8c2b8 0%, #8a847c 32%, #5c5852 50%, #8a847c 68%, #c8c2b8 100%)';
  const NICKEL_BORDER = 'rgba(192,184,168,0.55)';

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Send Funds"
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(5,10,15,0.78)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 460,
          // Outer brushed-nickel bezel - 3px thick.
          padding: 3,
          borderRadius: 16,
          background: NICKEL_OUTER,
          boxShadow:
            '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.35)',
        }}
      >
        {/* Inner highlight rim - 2px */}
        <div
          style={{
            padding: 2,
            borderRadius: 14,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.03) 50%, rgba(0,0,0,0.55) 100%)',
          }}
        >
          {/* Inner surface - the actual modal content */}
          <div
            style={{
              padding: 'var(--space-5)',
              borderRadius: 12,
              background: 'linear-gradient(180deg, #131b24 0%, #0a0f14 100%)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -2px 6px rgba(0,0,0,0.55)',
              color: 'var(--white)',
            }}
          >
            <h2 style={{ marginTop: 0, color: 'var(--white)', fontSize: '1.18rem', fontFamily: 'var(--font-brand)' }}>
              Send Funds
            </h2>
            <p style={{ color: 'var(--silver)', fontSize: '0.86rem', lineHeight: 1.5, marginTop: 0 }}>
              Funds Are Deducted From Your Wallet (Or Billed To Your Credit Line) And Added To The Recipient's Wallet.
            </p>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>

              {/* Recipient picker */}
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label" htmlFor="send-recipient" style={{ marginBottom: 6 }}>
                  Recipient
                </label>

                {selected ? (
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10,
                      background: 'rgba(0,196,188,0.08)',
                      border: '1px solid rgba(0,196,188,0.40)',
                      minHeight: 44,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(0,196,188,0.55) 0%, rgba(0,196,188,0.15) 100%)',
                        color: '#031815', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: '0.82rem', letterSpacing: '0.02em', flexShrink: 0,
                      }}
                    >
                      {recipientDisplayName(selected).slice(0, 2).toUpperCase()}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ color: 'var(--white)', fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {recipientDisplayName(selected)}
                        </strong>
                        <span
                          style={{
                            padding: '1px 7px', borderRadius: 999,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.10)',
                            color: 'var(--silver)',
                            fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.04em',
                            textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0,
                          }}
                        >
                          {selected.role_label}
                        </span>
                      </span>
                      {recipientHandle(selected) && (
                        <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--grey-500)' }}>
                          {recipientHandle(selected)}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(null);
                        setQuery('');
                        setSearchOpen(true);
                        setTimeout(() => inputRef.current?.focus(), 0);
                      }}
                      aria-label="Change Recipient"
                      style={{
                        background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                        color: 'var(--silver)', borderRadius: 8, padding: '6px 10px',
                        fontSize: '0.74rem', cursor: 'pointer', flexShrink: 0,
                      }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <input
                    ref={inputRef}
                    id="send-recipient"
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
                    onFocus={() => setSearchOpen(true)}
                    autoComplete="off"
                    spellCheck={false}
                    aria-autocomplete="list"
                    aria-expanded={searchOpen && results.length > 0}
                    style={{
                      width: '100%',
                      padding: '12px 12px',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(192,184,168,0.30)',
                      color: 'var(--white)',
                      fontSize: '0.95rem',
                      outline: 'none',
                      minHeight: 44,
                      boxSizing: 'border-box',
                    }}
                  />
                )}

                {!selected && searchOpen && query.trim().length >= 2 && (
                  <div
                    ref={dropdownRef}
                    role="listbox"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: 6,
                      borderRadius: 10,
                      background: '#0f1923',
                      border: `1px solid ${NICKEL_BORDER}`,
                      boxShadow: '0 12px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
                      maxHeight: 280,
                      overflowY: 'auto',
                      zIndex: 10,
                    }}
                  >
                    {searching ? (
                      <div style={{ padding: 14, color: 'var(--grey-500)', fontSize: '0.84rem' }}>Searching…</div>
                    ) : results.length === 0 ? (
                      <div style={{ padding: 14, color: 'var(--grey-500)', fontSize: '0.84rem' }}>
                        No Matches. Try Another Name, Username, Or Email.
                      </div>
                    ) : (
                      <ul style={{ listStyle: 'none', margin: 0, padding: 4 }}>
                        {(results || []).map((r, i) => {
                          const active = i === activeIndex;
                          return (
                            <li key={r.id}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={active}
                                onMouseEnter={() => setActiveIndex(i)}
                                onClick={() => {
                                  setSelected(r);
                                  setSearchOpen(false);
                                  setQuery('');
                                }}
                                style={{
                                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                  padding: '10px 12px', borderRadius: 8,
                                  background: active ? 'rgba(0,196,188,0.10)' : 'transparent',
                                  border: 'none', textAlign: 'left', cursor: 'pointer',
                                  color: 'var(--white)',
                                }}
                              >
                                <span
                                  aria-hidden
                                  style={{
                                    width: 32, height: 32, borderRadius: '50%',
                                    background: 'linear-gradient(135deg, rgba(192,184,168,0.45) 0%, rgba(192,184,168,0.12) 100%)',
                                    color: '#050A0F', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 800, fontSize: '0.78rem', flexShrink: 0,
                                  }}
                                >
                                  {recipientDisplayName(r).slice(0, 2).toUpperCase()}
                                </span>
                                <span style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <strong style={{ fontSize: '0.9rem', color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {recipientDisplayName(r)}
                                    </strong>
                                    <span
                                      style={{
                                        padding: '1px 6px', borderRadius: 999,
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.10)',
                                        color: 'var(--silver)',
                                        fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.04em',
                                        textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0,
                                      }}
                                    >
                                      {r.role_label}
                                    </span>
                                  </span>
                                  {recipientHandle(r) && (
                                    <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--grey-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {recipientHandle(r)}
                                    </span>
                                  )}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div className="form-group">
                <label className="form-label" htmlFor="send-amount">Amount (USD)</label>
                <input
                  id="send-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(192,184,168,0.30)',
                    color: 'var(--white)', fontSize: '0.95rem', outline: 'none',
                    minHeight: 44, boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Note (optional) */}
              <div className="form-group">
                <label className="form-label" htmlFor="send-note">Note (Optional)</label>
                <input
                  id="send-note"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  style={{
                    width: '100%', padding: '12px 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(192,184,168,0.30)',
                    color: 'var(--white)', fontSize: '0.95rem', outline: 'none',
                    minHeight: 44, boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
                  {busy ? 'Sending…' : 'Send Funds'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
