/**
 * Stripe-style request idempotency for admin/agent POSTs that mutate money
 * or state.
 *
 * Flow:
 *   1. Caller reads `Idempotency-Key` (or `X-Idempotency-Key`) header.
 *   2. Calls withIdempotency({ userId, route, key, request, handler }).
 *   3. We INSERT a placeholder row into public.idempotency_keys with the
 *      key as PK + ON CONFLICT DO NOTHING.
 *   4. If the insert succeeded, we run the handler, capture its
 *      (status, body) into the row, and return the response.
 *   5. If the insert collided (a row already exists), we read the row:
 *        - If it belongs to a different user → 409 (key collision)
 *        - If route mismatches → 409
 *        - If request_hash mismatches → 409 (same key, different body)
 *        - If response_status is 0 → 425 Too Early (in-flight elsewhere)
 *        - Else → return cached response (the replay path)
 *
 * 5xx responses are NOT cached - the row is DELETED so the client may
 * retry. 2xx and 4xx ARE cached so a double-clicker gets back the same
 * outcome.
 *
 * If `key` is null/undefined the wrapper is a no-op and just runs the
 * handler - this lets callers opt in only when the client sends a key.
 */

import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

const IDEMPOTENCY_KEY_HEADERS = ['Idempotency-Key', 'idempotency-key', 'X-Idempotency-Key', 'x-idempotency-key'];

export interface IdempotencyOptions {
  /** Authenticated user that owns the key. Required. */
  userId: string;
  /** Route identifier, e.g. '/api/admin/statements'. Required. */
  route: string;
  /**
   * Client-supplied idempotency key. If null/undefined the wrapper is a
   * no-op and the handler runs as if there were no wrapper at all.
   */
  key: string | null | undefined;
  /**
   * The parsed request body (or any JSON-serializable representation of
   * the request intent). Used to detect "same key, different body"
   * replays.
   */
  request: unknown;
  /** The handler that produces the real response. */
  handler: () => Promise<NextResponse>;
}

interface CachedRow {
  key: string;
  user_id: string;
  route: string;
  request_hash: string;
  response_status: number;
  response_body: unknown;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

/** Read the client idempotency key from headers, if any. */
export function readIdempotencyKey(req: Request): string | null {
  for (const h of IDEMPOTENCY_KEY_HEADERS) {
    const v = req.headers.get(h);
    if (v && v.length > 0 && v.length <= 200) return v;
  }
  return null;
}

/** Canonical JSON serialization so reordered object keys don't break the hash. */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}

function hashRequest(req: unknown): string {
  return createHash('sha256').update(canonicalize(req)).digest('hex');
}

async function readBodyJson(resp: NextResponse): Promise<unknown> {
  try {
    const cloned = resp.clone();
    return await cloned.json();
  } catch {
    return null;
  }
}

/**
 * Wrap a handler in the idempotency layer.
 *
 * If `key` is missing the handler is invoked unchanged.
 */
export async function withIdempotency(opts: IdempotencyOptions): Promise<NextResponse> {
  const { userId, route, key, request, handler } = opts;

  if (!key) return handler();

  const requestHash = hashRequest(request);
  const admin = await createServiceClient();

  // Atomically claim the key. On conflict we'll read the existing row
  // and decide whether to replay or reject.
  const { data: inserted, error: insertErr } = await admin
    .from('idempotency_keys')
    .insert({
      key,
      user_id: userId,
      route,
      request_hash: requestHash,
      response_status: 0,
      response_body: {},
    })
    .select('key')
    .maybeSingle();

  // PG 23505 = unique_violation → key is already in use.
  const isConflict = !!insertErr && (insertErr as { code?: string }).code === '23505';

  if (insertErr && !isConflict) {
    // Storage failure - fail open so the action still works (mostly).
    // We log and just run the handler unwrapped.
    console.error('[idempotency] insert failed:', insertErr);
    return handler();
  }

  if (isConflict || !inserted) {
    const { data: existing } = await admin
      .from('idempotency_keys')
      .select('*')
      .eq('key', key)
      .maybeSingle<CachedRow>();

    if (!existing) {
      // Race lost the conflict and now the row is gone (idempotency_sweep?).
      // Do NOT call handler() — that would double-execute a money mutation.
      // Force the client to retry with a fresh key instead.
      console.warn('[idempotency] key row disappeared mid-flight, returning 503', { key, route });
      return NextResponse.json(
        { error: 'Idempotency state lost. Please use a new key and retry.' },
        { status: 503 }
      );
    }

    if (existing.user_id !== userId) {
      return NextResponse.json(
        { error: 'Idempotency Key Collision With Another User.' },
        { status: 409 }
      );
    }
    if (existing.route !== route) {
      return NextResponse.json(
        { error: 'Idempotency Key Was Used On A Different Endpoint.' },
        { status: 409 }
      );
    }
    if (existing.request_hash !== requestHash) {
      return NextResponse.json(
        { error: 'Idempotency Key Was Used With A Different Request Body.' },
        { status: 409 }
      );
    }
    if (existing.response_status === 0) {
      return NextResponse.json(
        { error: 'The Original Request Is Still Processing. Please Retry In A Few Seconds.' },
        { status: 425 }
      );
    }
    return NextResponse.json(existing.response_body, { status: existing.response_status });
  }

  // We own the row - run the handler.
  let response: NextResponse;
  try {
    response = await handler();
  } catch (err) {
    // Handler threw. Don't cache - let the client retry.
    await admin.from('idempotency_keys').delete().eq('key', key);
    throw err;
  }

  const status = response.status;

  if (status >= 500) {
    // Internal error - don't cache; allow retry.
    await admin.from('idempotency_keys').delete().eq('key', key);
    return response;
  }

  const body = await readBodyJson(response);
  const { error: updateErr } = await admin
    .from('idempotency_keys')
    .update({
      response_status: status,
      response_body: body ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq('key', key);

  if (updateErr) {
    // Don't re-throw — response is already computed and will be sent.
    // Log so ops can detect if the cache is consistently failing.
    console.error('[idempotency] failed to cache response — duplicate requests may re-execute:', updateErr);
  }

  return response;
}
