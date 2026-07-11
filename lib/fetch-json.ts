import { reportClientError } from '@/lib/report-client-error';

/**
 * Shared client-side fetch wrapper.
 *
 * Motivation: the codebase has ~200 call sites that do `await res.json()`
 * without first checking `res.ok`, so a 4xx/5xx error body gets parsed as if it
 * were success data (rendering blank/garbage state or throwing a raw parse error
 * into an error boundary). Many also have no request timeout, so a stalled
 * connection hangs the promise forever.
 *
 * fetchJson returns a discriminated result so callers cannot skip the check:
 *   const r = await fetchJson<{ data: Thing[] }>('/api/things', { errorContext: 'things.list' });
 *   if (!r.ok) { setError(r.error); return; }
 *   setThings(r.data.data);
 *
 * It (a) applies an AbortSignal timeout, (b) checks res.ok, (c) parses JSON
 * defensively (tolerates empty / non-JSON bodies like 204 or an HTML 500 page),
 * and (d) optionally routes failures to reportClientError for observability.
 */

export type FetchJsonResult<T> =
  | { ok: true; status: number; data: T; error: null }
  | { ok: false; status: number; data: null; error: string };

export interface FetchJsonOptions extends RequestInit {
  /** Abort the request after this many ms (default 15000). */
  timeoutMs?: number;
  /** When set, non-ok and thrown paths are reported via reportClientError. */
  errorContext?: string;
}

export async function fetchJson<T = unknown>(
  input: string,
  opts: FetchJsonOptions = {},
): Promise<FetchJsonResult<T>> {
  const { timeoutMs = 15000, errorContext, signal, ...init } = opts;

  // Combine the caller's signal (if any) with a timeout signal.
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  const finalSignal = signal && anyFn ? anyFn([signal, timeoutSignal]) : (signal ?? timeoutSignal);

  try {
    const res = await fetch(input, { ...init, signal: finalSignal });

    // Defensive parse: read text first so an empty or non-JSON body does not throw.
    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }

    if (!res.ok) {
      const bodyError =
        parsed && typeof parsed === 'object' && 'error' in parsed
          ? String((parsed as { error: unknown }).error)
          : null;
      const msg = bodyError ?? `Request Failed (${res.status})`;
      if (errorContext) {
        reportClientError(errorContext, new Error(msg), { kind: 'http', meta: { status: res.status, url: input } });
      }
      return { ok: false, status: res.status, data: null, error: msg };
    }

    return { ok: true, status: res.status, data: parsed as T, error: null };
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError';
    const msg = timedOut ? 'Request Timed Out' : err instanceof Error ? err.message : 'Network Error';
    if (errorContext) {
      reportClientError(errorContext, err, { kind: timedOut ? 'timeout' : 'network', meta: { url: input } });
    }
    return { ok: false, status: 0, data: null, error: msg };
  }
}
