/**
 * HOTFIX fix-39: LiveKit E2EE setup HARD-DISABLED in code.
 *
 * Background:
 *   - fix-28/fix-30 shipped E2EE default-ON
 *   - fix-37 flipped the code default to OFF (opt-in via
 *     NEXT_PUBLIC_MESSENGER_CALL_E2EE=on)
 *   - But the production Vercel env still has the variable set to 'on'
 *     from the original B5 deployment, so the fix-37 code default had no
 *     effect. createE2EESetup() kept running and kept tripping the
 *     Turbopack-broken livekit-client/e2ee-worker import inside
 *     LiveKitRoom's mount, throwing synchronously and bubbling to
 *     global-error.tsx ("Critical Error Occurred").
 *
 * fix-39 removes the env var dependency entirely. createE2EESetup() is
 * now a no-op that always returns null. Calls still travel over TLS to
 * the LiveKit SFU; they are simply not end-to-end encrypted.
 *
 * To re-enable E2EE later: revert this file, but FIRST validate that
 * Turbopack correctly bundles `new Worker(new URL('livekit-client/
 * e2ee-worker', import.meta.url))` in production. The synchronous-throw
 * failure mode must not recur.
 */

import type { RoomOptions } from 'livekit-client';

export interface E2EESetup {
  // Intentionally never populated; kept exported for type compatibility
  // with any caller that still references the type.
  keyProvider: unknown;
  worker: Worker;
}

/**
 * Always returns null. E2EE is disabled platform-wide.
 */
export async function createE2EESetup(_livekitRoom: string): Promise<E2EESetup | null> {
  return null;
}

/**
 * Room options for every call.
 *
 * disconnectOnPageLeave defaults to TRUE in livekit-client, which tears the
 * media session down on `pagehide`. On a phone that event means "the screen
 * locked" or "you opened another app" at least as often as it means "the tab
 * closed" — and an iPhone locks itself after 30 seconds — so the default was
 * quietly dropping people out of live calls a minute or two in. We already
 * handle real teardown ourselves (the pagehide handler in CallOverlay, which
 * ignores bfcache restores, plus the server-side stale sweep), so the SDK
 * hanging up on our behalf is pure downside: it cannot tell the difference,
 * and it fires first.
 */
export function asRoomOptions(_setup: E2EESetup | null): RoomOptions | undefined {
  return { disconnectOnPageLeave: false };
}
