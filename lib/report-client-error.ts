// Fire-and-forget client error reporter -> /api/observability/client-error.
//
// Always console-logs (local/dev visibility), then best-effort POSTs to the sink.
// Dedupes within a session and caps total reports to avoid flooding on a runaway
// loop. Never throws -- safe to call from any client catch block or global handler.

const seen = new Set<string>();
let sent = 0;
const MAX_PER_SESSION = 50;

export function reportClientError(
  context: string,
  err: unknown,
  extra?: { kind?: string; meta?: Record<string, unknown> },
): void {
  try {
    const message = (err instanceof Error ? err.message : String(err ?? 'Unknown error')).slice(0, 2000);
    const stack = err instanceof Error ? err.stack?.slice(0, 8000) : undefined;

    // eslint-disable-next-line no-console
    console.error(`[client-error:${context}]`, err);

    if (typeof fetch === 'undefined' || sent >= MAX_PER_SESSION) return;
    const dedupeKey = `${context}::${message}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    sent++;

    const payload = JSON.stringify({
      context,
      kind: extra?.kind ?? 'caught',
      message,
      stack,
      url: typeof location !== 'undefined' ? location.href : undefined,
      meta: extra?.meta,
    });

    // keepalive lets the report survive an in-flight navigation / page unload.
    fetch('/api/observability/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // never let error reporting itself throw
  }
}
