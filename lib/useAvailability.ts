'use client';

import { useEffect, useRef, useState } from 'react';

export type AvailabilityField = 'slug' | 'username' | 'display_name';

export type AvailabilityStatus =
  | 'idle'        // no value, or below min length — render nothing
  | 'checking'    // debounce window active or fetch in flight
  | 'available'   // server says good to go
  | 'taken'       // server says someone else owns this
  | 'invalid'     // format failed — server returned available=false with a format reason
  | 'error';      // network / server failed — UI should fall back to "we'll re-check on submit"

export interface AvailabilityResult {
  status: AvailabilityStatus;
  available: boolean | null;
  normalized: string;
  reason: string | null;
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

/**
 * Hook that returns the live availability status of the supplied field value.
 *
 * Wire it into a form like:
 *
 *   const slugCheck = useAvailability({ field: 'slug', value: slug, excludeId: agentId });
 *   <input value={slug} onChange={...} />
 *   {slugCheck.status === 'taken' && <p>{slugCheck.reason}</p>}
 *   <button disabled={slugCheck.status !== 'available'}>Save</button>
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
  const reqIdRef = useRef(0);
  const refreshTickRef = useRef(0);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (disabled) {
      setStatus('idle');
      setAvailable(null);
      setReason(null);
      return;
    }
    const trimmed = String(value ?? '').trim();
    if (trimmed.length < minLength) {
      setStatus('idle');
      setAvailable(null);
      setReason(null);
      setNormalized('');
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
          return;
        }
        const json = (await res.json()) as {
          available?: boolean;
          normalized?: string;
          reason?: string | null;
        };
        if (myReq !== reqIdRef.current) return;
        const isAvail = json.available === true;
        setAvailable(isAvail);
        setNormalized(json.normalized ?? trimmed);
        setReason(json.reason ?? null);
        if (isAvail) {
          setStatus('available');
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
 * Color tokens:
 *   - checking — silver
 *   - available — green (#68D391)
 *   - taken — red (#FC8181)
 *   - invalid — amber (#FFD175)
 *   - error — silver (graceful fallback message)
 */
export function availabilityMessage(r: AvailabilityResult): {
  color: string;
  text: string;
} | null {
  switch (r.status) {
    case 'checking':
      return { color: 'var(--silver, #C0B8A8)', text: 'Checking Availability…' };
    case 'available':
      return { color: '#68D391', text: '✓ Available' };
    case 'taken':
      return { color: '#FC8181', text: r.reason || 'Already Taken — Try Another.' };
    case 'invalid':
      return { color: '#FFD175', text: r.reason || 'Invalid Format.' };
    case 'error':
      return {
        color: 'var(--silver, #C0B8A8)',
        text: 'Could Not Verify Right Now — We Will Re-Check On Submit.',
      };
    case 'idle':
    default:
      return null;
  }
}
