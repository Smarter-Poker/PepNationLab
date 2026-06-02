'use client';

/**
 * R28.1 — Inline FAQ suggestions for the messenger composer.
 *
 * Renders a small chip row above the composer textarea when the user is
 * composing a message to admin/support and the typed draft matches one or
 * more FAQ items. The goal is self-serve deflection: if the buyer is about
 * to ask "where is my tracking number" we surface that exact answer before
 * the message goes out.
 *
 * Behaviour:
 *   - Hidden unless `enabled` is true (parent decides — typically when the
 *     conversation's counterparty role is 'admin')
 *   - Hidden unless the draft is at least 5 characters of real text
 *   - Debounces the draft 200ms before running suggestFaq()
 *   - Renders up to 3 chips; each is a target=_blank deep-link to
 *     `/account/help#faq-<id>` so the user can read the answer without
 *     losing their draft
 *   - Fires a sendBeacon to /api/analytics/faq-click on click so we can
 *     measure deflection rate from the support funnel
 *   - Dismissible via the X button — once dismissed for this draft, stays
 *     hidden until the next time the textarea is fully cleared
 */

import { useEffect, useMemo, useState } from 'react';
import { LifeBuoy, X } from 'lucide-react';
import { suggestFaq, faqDeepLink, FAQ_ITEMS, type FaqItem } from '@/lib/help-faq';

interface Props {
  draft: string;
  enabled: boolean;
}

const MIN_DRAFT_LENGTH = 5;
const MIN_SCORE = 20;
const DEBOUNCE_MS = 200;
const MAX_SUGGESTIONS = 3;

function fireBeacon(faqId: string) {
  try {
    const body = JSON.stringify({ faqId, source: 'composer-support' });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/analytics/faq-click',
        new Blob([body], { type: 'application/json' }),
      );
      return;
    }
    void fetch('/api/analytics/faq-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* telemetry must never block UI */
  }
}

export default function FaqSuggestions({ draft, enabled }: Props) {
  const [debounced, setDebounced] = useState('');
  const [dismissed, setDismissed] = useState(false);

  // Debounce the draft so we don't recompute on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(draft), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [draft]);

  // When the textarea is fully cleared, reset the dismissed flag so the
  // next message attempt starts with a clean slate.
  useEffect(() => {
    if (draft.length === 0) setDismissed(false);
  }, [draft]);

  const matches = useMemo<FaqItem[]>(() => {
    if (!enabled || dismissed) return [];
    if (debounced.trim().length < MIN_DRAFT_LENGTH) return [];
    return suggestFaq(debounced, FAQ_ITEMS, MAX_SUGGESTIONS)
      .filter((m) => m.score >= MIN_SCORE)
      .map((m) => m.item);
  }, [enabled, dismissed, debounced]);

  if (matches.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Suggested Help Articles"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        margin: '0 0 8px',
        padding: '8px 10px',
        borderRadius: 10,
        background: 'rgba(0,196,188,0.06)',
        border: '1px solid rgba(0,196,188,0.22)',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.74rem',
          fontWeight: 700,
          color: 'var(--teal, #00C4BC)',
          letterSpacing: '0.02em',
        }}
      >
        <LifeBuoy size={12} aria-hidden /> Self-Serve Answers:
      </span>
      {matches.map((it) => (
        <a
          key={it.id}
          href={faqDeepLink(it.id)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => fireBeacon(it.id)}
          title={it.q}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '0.74rem',
            fontWeight: 600,
            color: 'var(--teal, #00C4BC)',
            background: 'rgba(0,196,188,0.10)',
            border: '1px solid rgba(0,196,188,0.30)',
            borderRadius: 999,
            padding: '4px 10px',
            textDecoration: 'none',
            lineHeight: 1.2,
          }}
        >
          {it.q.length > 40 ? `${it.q.slice(0, 38)}...` : it.q}
        </a>
      ))}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss Suggestions"
        title="Dismiss Suggestions"
        style={{
          marginLeft: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 0,
          color: 'var(--grey-400, #A8B4C0)',
          cursor: 'pointer',
          padding: 4,
        }}
      >
        <X size={12} aria-hidden />
      </button>
    </div>
  );
}
