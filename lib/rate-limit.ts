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

// ─── In-memory fallback ────────────────────────────────────────────────────
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

// ─── Credential resolution ─────────────────────────────────────────────────
/**
 * Upstash reaches this app under more than one set of variable names, and
 * which one you get depends on how the database was attached:
 *
 *   - Adding the variables by hand (or via the Upstash console) gives you
 *     UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
 *   - Attaching the database through the Vercel Marketplace integration
 *     injects the KV_-prefixed set instead - KV_REST_API_URL /
 *     KV_REST_API_TOKEN - alongside KV_URL and REDIS_URL.
 *
 * This module used to read only the UPSTASH_-prefixed pair. A correctly
 * provisioned and correctly connected Marketplace database therefore looked
 * exactly like no database at all: the limiter stayed on the in-memory
 * fallback and kept logging "UPSTASH_REDIS_REST_URL/TOKEN are not set",
 * which reads like a provisioning failure and sends you back to the
 * dashboard to re-do work that was already done. Accept both spellings.
 *
 * Only REST endpoints are usable here - this talks HTTP, not the Redis wire
 * protocol - so a `redis://` or `rediss://` value (KV_URL / REDIS_URL) is
 * rejected rather than handed to fetch(). Passing one through would make
 * every fetch throw, and since a failed Upstash call falls through to
 * "allow", that would silently cost ~1.5s of timeout on the critical path of
 * every rate-limited request while providing no limiting whatsoever.
 */
function resolveUpstash(): { url: string; token: string } | null {
  const url = (
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    ''
  ).trim();
  const token = (
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    ''
  ).trim();

  if (!url || !token) return null;
  if (!/^https?:\/\//i.test(url)) {
    warnBadUpstashUrl(url);
    return null;
  }
  return { url, token };
}

// ─── Upstash path ──────────────────────────────────────────────────────────
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
    // Atomic script: INCR then EXPIRE only if it's a new window (counter == 1).
    // This prevents a slow trickle of requests from keeping the window alive forever.
    const script = 'local c=redis.call("INCR",KEYS[1]) if c==1 then redis.call("EXPIRE",KEYS[1],ARGV[1]) end return c';
    const resp = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['EVAL', script, '1', bucketKey, String(windowSeconds)]
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

// ─── Public API ───────────────────────────────────────────────────────

// Surface a misconfiguration loudly (once per process) when running in
// production without a distributed limiter. The in-memory fallback is a
// per-instance sliding window, which on serverless barely constrains an
// attacker because each request can land on a fresh/cold instance. This warning
// makes an accidentally-unprotected production deploy visible in the logs.
let __warnedNoUpstash = false;
function warnIfUnprotectedInProd(): void {
  if (__warnedNoUpstash) return;
  __warnedNoUpstash = true;
  if (process.env.NODE_ENV === 'production') {
    // eslint-disable-next-line no-console
    console.warn(
      '[rate-limit] No Upstash REST credentials in production. Checked ' +
      'UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN and ' +
      'KV_REST_API_URL/KV_REST_API_TOKEN. Rate limiting is running on the ' +
      'per-instance in-memory fallback, which is largely ineffective on ' +
      'serverless. Attach an Upstash database (Vercel Marketplace, or set ' +
      'the variables by hand) to enforce cluster-wide limits on auth, ' +
      'register, orders, and the proxy.'
    );
  }
}

// Separate one-shot warning: credentials ARE present but the URL is not a REST
// endpoint. That is a distinct failure from "not configured" and needs a
// distinct message, otherwise it reads as an unprovisioned database.
let __warnedBadUrl = false;
function warnBadUpstashUrl(url: string): void {
  if (__warnedBadUrl) return;
  __warnedBadUrl = true;
  // eslint-disable-next-line no-console
  console.warn(
    '[rate-limit] Upstash URL is not an HTTP REST endpoint, ignoring it and ' +
    'using the in-memory fallback. This helper speaks the Upstash REST API, ' +
    'not the Redis wire protocol - use the REST URL (KV_REST_API_URL / ' +
    'UPSTASH_REDIS_REST_URL), not KV_URL or REDIS_URL. Got scheme: ' +
    (url.split(':')[0] || 'unknown')
  );
}

export async function rateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const { key, limit, windowSeconds, identifier } = input;
  if (!key || limit <= 0 || windowSeconds <= 0) {
    return { allowed: true, remaining: limit, resetAt: Date.now() };
  }
  const bucketKey = identifier ? `${key}:${identifier}` : key;

  const creds = resolveUpstash();

  if (creds) {
    const remote = await upstashRateLimit(bucketKey, limit, windowSeconds, creds.url, creds.token);
    if (remote) return remote;
    // Upstash unavailable - degrade to in-memory rather than hard-fail.
  } else {
    // No distributed limiter configured at all - flag it in production.
    warnIfUnprotectedInProd();
  }

  return inMemoryRateLimit(bucketKey, limit, windowSeconds);
}

/**
 * Pull a stable identifier off an incoming request. Used by route handlers
 * that key on IP. Returns "unknown" when nothing usable is present so the
 * limiter still has a deterministic bucket name.
 */
export function getClientIp(req: { headers: Headers }): string {
  const vercel = req.headers.get('x-vercel-forwarded-for');
  if (vercel) return vercel.split(',')[0]?.trim() || 'unknown';
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || 'unknown';
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
