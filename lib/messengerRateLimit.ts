/**
 * Messenger Rate Limit Helper (Phase 15)
 *
 * Thin wrapper over the platform `rateLimit` helper in `lib/rate-limit.ts`.
 * Centralizes the messenger-specific bucket configuration so route handlers
 * stay tiny and so the limits live in exactly one place.
 *
 * Buckets follow the Phase 15 plan:
 *   - send       : 30 / minute  (send-message, thread-reply, schedule-message)
 *   - react      : 60 / minute  (react-message)
 *   - read       : 120 / minute (get-conversations, get-messages, list-*)
 *   - upload     : 10 / minute  (upload-media)
 *   - default    : 60 / minute  (state-mutating writes that aren't sends/reacts)
 *   - admin      : 200 / minute (admin moderation routes - privileged)
 *   - call_start : 5 / minute   (per-pair start-call throttle; audit15 fix-18)
 *
 * Cron routes deliberately do NOT pass through the limiter - they are
 * system-internal and already gated by Bearer CRON_SECRET.
 *
 * Upstash REST is used when configured, otherwise we fall back to the
 * in-memory token-bucket implemented in `lib/rate-limit.ts`. Either way the
 * limiter "fails open" - if the limiter itself errors, the request is
 * allowed through. A rate limiter that locks users out on its own bug is
 * worse than no limiter at all.
 *
 * Usage inside a route:
 *   const { user, error } = await requireSession();
 *   if (error) return NextResponse.json({ error }, { status: 401 });
 *   const limited = await messengerRateLimit('send', user.id);
 *   if (!limited.allowed) return messengerRateLimitResponse(limited);
 */

import { NextResponse } from 'next/server';
import { rateLimit, type RateLimitResult } from './rate-limit';

export type MessengerBucket =
  | 'send'
  | 'react'
  | 'read'
  | 'upload'
  | 'default'
  | 'admin'
  | 'call_start';

interface BucketConfig {
  /** Stable bucket key sent to `lib/rate-limit`. */
  key: string;
  /** Maximum hits allowed inside the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

const BUCKETS: Record<MessengerBucket, BucketConfig> = {
  send: { key: 'messenger_send', limit: 30, windowSeconds: 60 },
  react: { key: 'messenger_react', limit: 60, windowSeconds: 60 },
  read: { key: 'messenger_read', limit: 120, windowSeconds: 60 },
  upload: { key: 'messenger_upload', limit: 10, windowSeconds: 60 },
  default: { key: 'messenger_default', limit: 60, windowSeconds: 60 },
  admin: { key: 'messenger_admin', limit: 200, windowSeconds: 60 },
  // audit15 fix-18 (B2): per-pair burst guard. Callers pass identifier as
  // `${callerId}:${targetId}` so a single user can still call many distinct
  // targets at the higher `default` rate - only the pairwise burst is gated.
  call_start: { key: 'messenger_call_start', limit: 5, windowSeconds: 60 },
};

/**
 * Apply the messenger rate limit for `bucket` keyed by `identifier`
 * (typically the authenticated user id). Returns the platform-standard
 * `RateLimitResult` so callers can inspect `remaining` and `resetAt` if
 * they want to surface those headers.
 */
export async function messengerRateLimit(
  bucket: MessengerBucket,
  identifier: string,
): Promise<RateLimitResult> {
  const cfg = BUCKETS[bucket];
  return rateLimit({
    key: cfg.key,
    limit: cfg.limit,
    windowSeconds: cfg.windowSeconds,
    identifier,
  });
}

/**
 * Build the canonical 429 response for a messenger limiter hit. Includes a
 * `Retry-After` header per RFC 7231 so well-behaved clients can back off
 * without busy-looping.
 */
export function messengerRateLimitResponse(result: RateLimitResult): NextResponse {
  const retryMs = Math.max(0, result.resetAt - Date.now());
  const retryAfterSeconds = Math.max(1, Math.ceil(retryMs / 1000));
  return NextResponse.json(
    {
      error: 'Rate Limit Exceeded',
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    },
  );
}
