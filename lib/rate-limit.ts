/**
 * Rate limit helper.
 *
 * If Upstash REST env vars are present we issue a single pipelined INCR+EXPIRE
 * round trip and treat that as the source of truth (cluster-wide). Otherwise
 * we fall back to a per-process in-memory ring buffer of timestamps.
 *
 * The in-memory fallback is intentional: PepNationLab today runs a single
 * Vercel region so per-instance limits already give us a useful signal, and
 * keeping a fallback means a broken Upstash deploy can never lock users out.
 *
 * Errors from the Upstash call are swallowed (allow the request, log a
 * warning) - a rate limiter that hard-fails open requests is worse than no
 * rate limiter at all.
 *
 * Callers (added in the same change set):
 *   - app/api/storefront/register/route.ts  (replaces inline RL)
 *   - app/api/auth/resolve/route.ts          (20 / min / ip)
 *   - app/api/disclaimer-log/route.ts        (60 / min / ip)
 *   - app/api/orders/route.ts                (10 / min / user)
 */

export interface RateLimitInput {
  /** Logical bucket name, e.g. "storefront_register". */
  key: string;
  /** Maximum hits allowed in the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /**
   * Optional identifier appended to the key (typically IP address or user id).
   * Use this when you want one bucket per caller, instead of a global bucket.
   */
  identifier?: string | null;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // unix ms when the window resets
}

// ─── In-memory fallback ───────────────────────────────────────────────────────
// Keyed by `${key}:${identifier}`. Value is a sliding window of hit timestamps.
// We stash it on `globalThis` so Next.js hot reload doesn't reset between
// requests in dev.
type Buckets = Map<string, number[]>;
const __MEM_KEY = '__pepnationlab_rl__';
const memoryBuckets: Buckets =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((globalThis as any)[__MEM_KEY] as Buckets) ||
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((globalThis as any)[__MEM_KEY] = new Map<string, number[]>());

function inMemoryRateLimit(
  bucketKey: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const cutoff = now - windowMs;
  const existing = (memoryBuckets.get(bucketKey) || []).filter(ts => ts > cutoff);

  if (existing.length >= limit) {
    memoryBuckets.set(bucketKey, existing);
    const oldest = existing[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldest + windowMs,
    };
  }

  existing.push(now);
  memoryBuckets.set(bucketKey, existing);
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.length),
    resetAt: now + windowMs,
  };
}

// ─── Upstash path ─────────────────────────────────────────────────────────────
async function upstashRateLimit(
  bucketKey: string,
  limit: number,
  windowSeconds: number,
  url: string,
  token: string
): Promise<RateLimitResult | null> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  try {
    // Single round trip: INCR then EXPIRE. INCR returns the new counter value;
    // we use that to decide allow/deny without a second GET.
    const resp = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', bucketKey],
        ['EXPIRE', bucketKey, String(windowSeconds), 'NX'],
      ]),
      // Don't let a slow Upstash request stall a checkout. Vercel functions
      // already have a ~10s budget; cap our share at 1.5s.
      signal: AbortSignal.timeout(1500),
    });

    if (!resp.ok) {
      // eslint-disable-next-line no-console
      console.warn(
        '[rate-limit] Upstash returned non-2xx, falling through to allow',
        resp.status
      );
      return null;
    }

    // Response shape: [{ result: <number> }, { result: 0|1 }]
    const data = (await resp.json()) as Array<{ result?: number; error?: string }>;
    const counter = Number(data?.[0]?.result ?? 0);
    if (!Number.isFinite(counter)) return null;

    if (counter > limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: now + windowMs,
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, limit - counter),
      resetAt: now + windowMs,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[rate-limit] Upstash call failed, falling through to allow', err);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function rateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const { key, limit, windowSeconds, identifier } = input;
  if (!key || limit <= 0 || windowSeconds <= 0) {
    return { allowed: true, remaining: limit, resetAt: Date.now() };
  }
  const bucketKey = identifier ? `${key}:${identifier}` : key;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    const remote = await upstashRateLimit(bucketKey, limit, windowSeconds, url, token);
    if (remote) return remote;
    // Upstash unavailable - degrade to in-memory rather than hard-fail.
  }

  return inMemoryRateLimit(bucketKey, limit, windowSeconds);
}

/**
 * Pull a stable identifier off an incoming request. Used by route handlers
 * that key on IP. Returns "unknown" when nothing usable is present so the
 * limiter still has a deterministic bucket name.
 */
export function getClientIp(req: { headers: Headers }): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || 'unknown';
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
