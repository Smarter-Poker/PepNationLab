'use client';

import { useEffect, useRef, useState } from 'react';

export type AvailabilityField = 'slug' | 'username' | 'display_name';

export type AvailabilityStatus =
  | 'idle'        // no value, or below min length — render nothing
  | 'checking'    // debounce window active or fetch in flight
  | 'available'   // server says good to go
  | 'similar'     // server says technically free but visually overlaps an existing name
  | 'taken'       // server says someone else owns this
  | 'invalid'     // format failed — server returned available=false with a format reason
  | 'reserved'    // server says this string is blocked by platform (RESERVED_SLUGS / profanity / brand)
  | 'error';      // network / server failed — UI should fall back to "we'll re-check on submit"

export interface AvailabilityResult {
  status: AvailabilityStatus;
  available: boolean | null;
  normalized: string;
  reason: string | null;
  /** Opaque, short-lived (~90s) token the server hands back when a value is
   *  available. Pass it on the submit POST as `reservationToken` and the
   *  write route will honor it ahead of any later signup trying the same
   *  string. Null when the server didn't issue one (e.g., not-available,
   *  rate-limited, or older server build). */
  reservationToken: string | null;
  /** When a name is technically available but visually overlaps an existing
   *  storefront (Levenshtein ≤ 2 or shared prefix), the server returns the
   *  conflicting name here so the UI can show a soft yellow warning. */
  similarTo: string | null;
  /** Up to 5 pre-checked alternatives the server suggests on a collision.
   *  Always [] when the field is currently available. */
  suggestions: string[];
  /** Force a fresh check (e.g., on blur). */
  refresh: () => void;
}

interface UseAvailabilityOpts {
  field: AvailabilityField;
  value: string;
  /** UUID of the row that owns the current value, so editing your own
   *  storefront's slug doesn't flag you as a collision against yourself. */
  excludeId?: string | null;
  /** Default 400 ms — feels live without hammering the endpoint. */
  debounceMs?: number;
  /** Min length before the hook fires. Default 3 (matches slug). */
  minLength?: number;
  /** Disable the check entirely (e.g., form is submitting). */
  disabled?: boolean;
}

interface AvailabilityServerResponse {
  available?: boolean;
  normalized?: string;
  reason?: string | null;
  reservationToken?: string | null;
  similarTo?: string | null;
  suggestions?: string[];
  reserved?: boolean;
}

/**
 * Hook that returns the live availability status of the supplied field value.
 *
 * Wire it into a form like:
 *
 *   const slugCheck = useAvailability({ field: 'slug', value: slug, excludeId: agentId });
 *   <input value={slug} onChange={...} />
 *   {slugCheck.status === 'taken' && <p>{slugCheck.reason}</p>}
 *   <button disabled={slugCheck.status !== 'available'}>Save</button>
 *
 * For full UX (green message, suggestion chips, URL preview, reservation
 * token plumbing) prefer the <UniqueField/> component from
 * components/UniqueField.tsx — it bundles the hook + the status row + the
 * suggestion chips + the live URL preview into a single drop-in.
 */
export function useAvailability(opts: UseAvailabilityOpts): AvailabilityResult {
  const {
    field,
    value,
    excludeId = null,
    debounceMs = 400,
    minLength = 3,
    disabled = false,
  } = opts;

  const [status, setStatus] = useState<AvailabilityStatus>('idle');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [normalized, setNormalized] = useState<string>('');
  const [reason, setReason] = useState<string | null>(null);
  const [reservationToken, setReservationToken] = useState<string | null>(null);
  const [similarTo, setSimilarTo] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const reqIdRef = useRef(0);
  const refreshTickRef = useRef(0);
  const [refreshTick, setRefreshTick] = useState(0);

  function resetExtras() {
    setReservationToken(null);
    setSimilarTo(null);
    setSuggestions([]);
  }

  useEffect(() => {
    if (disabled) {
      setStatus('idle');
      setAvailable(null);
      setReason(null);
      resetExtras();
      return;
    }
    const trimmed = String(value ?? '').trim();
    if (trimmed.length < minLength) {
      setStatus('idle');
      setAvailable(null);
      setReason(null);
      setNormalized('');
      resetExtras();
      return;
    }

    setStatus('checking');
    const myReq = ++reqIdRef.current;
    const handle = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ field, value: trimmed });
        if (excludeId) qs.set('excludeId', excludeId);
        const res = await fetch(`/api/availability?${qs.toString()}`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (myReq !== reqIdRef.current) return; // stale
        if (!res.ok) {
          setStatus('error');
          setAvailable(null);
          setReason(null);
          resetExtras();
          return;
        }
        const json = (await res.json()) as AvailabilityServerResponse;
        if (myReq !== reqIdRef.current) return;
        const isAvail = json.available === true;
        setAvailable(isAvail);
        setNormalized(json.normalized ?? trimmed);
        setReason(json.reason ?? null);
        setReservationToken(typeof json.reservationToken === 'string' ? json.reservationToken : null);
        setSimilarTo(typeof json.similarTo === 'string' ? json.similarTo : null);
        setSuggestions(Array.isArray(json.suggestions) ? json.suggestions.slice(0, 5) : []);
        if (isAvail) {
          // Available, with optional similar-name soft warning.
          setStatus(typeof json.similarTo === 'string' && json.similarTo ? 'similar' : 'available');
        } else if (json.reserved === true) {
          setStatus('reserved');
        } else if (json.reason && !json.reason.toLowerCase().includes('already')) {
          // Format failure — distinguishable from collision so the UI can
          // explain "letters only" vs. "someone else has this".
          setStatus('invalid');
        } else {
          setStatus('taken');
        }
      } catch {
        if (myReq !== reqIdRef.current) return;
        setStatus('error');
        setAvailable(null);
        setReason(null);
        resetExtras();
      }
    }, debounceMs);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field, value, excludeId, debounceMs, minLength, disabled, refreshTick]);

  return {
    status,
    available,
    normalized,
    reason,
    reservationToken,
    similarTo,
    suggestions,
    refresh: () => {
      refreshTickRef.current += 1;
      setRefreshTick(refreshTickRef.current);
    },
  };
}

/**
 * Render-helper. Given an AvailabilityResult, returns the inline status row
 * the form should display under the input. Returns null when nothing should
 * render (idle).
 *
 * Color tokens (intentionally bright so the cue is unmissable):
 *   - checking — silver
 *   - available — bright mint #34D399 with explicit success copy
 *   - similar — amber #FBBF24 (soft warning, NOT a block)
 *   - taken — red #FC8181
 *   - reserved — red #FC8181 with the platform-reserved reason
 *   - invalid — amber #FFD175 (format failed)
 *   - error — silver (graceful fallback message)
 */
export function availabilityMessage(r: AvailabilityResult): {
  color: string;
  text: string;
  /** Hint for UIs that want to render a different icon — 'success' renders a
   *  check, 'warn' renders a triangle, 'error' renders an X, 'info' renders
   *  a spinner-like dot. */
  tone: 'success' | 'warn' | 'error' | 'info';
} | null {
  switch (r.status) {
    case 'checking':
      return { color: 'var(--silver, #C0B8A8)', text: 'Checking Availability…', tone: 'info' };
    case 'available':
      return { color: '#34D399', text: 'This Name Is Available', tone: 'success' };
    case 'similar':
      return {
        color: '#FBBF24',
        text: r.similarTo
          ? `Available — But Very Close To "${r.similarTo}". Pick A More Distinct Name.`
          : 'Available — But Very Close To An Existing Name.',
        tone: 'warn',
      };
    case 'taken':
      return { color: '#FC8181', text: r.reason || 'Already Taken — Try Another.', tone: 'error' };
    case 'reserved':
      return { color: '#FC8181', text: r.reason || 'That Name Is Reserved By The Platform.', tone: 'error' };
    case 'invalid':
      return { color: '#FFD175', text: r.reason || 'Invalid Format.', tone: 'warn' };
    case 'error':
      return {
        color: 'var(--silver, #C0B8A8)',
        text: 'Could Not Verify Right Now — We Will Re-Check On Submit.',
        tone: 'info',
      };
    case 'idle':
    default:
      return null;
  }
}
