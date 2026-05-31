/**
 * audit15 fix-37 (HOTFIX): LiveKit E2EE setup with default-OFF.
 *
 * Originally shipped in fix-28 / fix-30 with default-ON. A production
 * incident reported that accepting calls instantly crashed both clients
 * with the root error boundary. Working theory: Turbopack isn't
 * correctly bundling the `livekit-client/e2ee-worker` subpath import
 * for `new Worker(new URL(...))`, so the worker script fails to load
 * asynchronously, and LiveKitRoom throws inside render when it tries
 * to communicate with the broken worker.
 *
 * Until Worker bundling is validated end-to-end, E2EE is OFF by default.
 * Set `NEXT_PUBLIC_MESSENGER_CALL_E2EE=on` to re-enable.
 *
 * When disabled (which is the default now), calls use standard TLS to
 * the LiveKit SFU — still encrypted in transit, just not end-to-end.
 */

import type { ExternalE2EEKeyProvider as ExternalE2EEKeyProviderType, RoomOptions } from 'livekit-client';

// audit15 fix-37: default OFF. Opt-in via NEXT_PUBLIC_MESSENGER_CALL_E2EE=on.
const E2EE_ENABLED = (process.env.NEXT_PUBLIC_MESSENGER_CALL_E2EE ?? 'off').toLowerCase() === 'on';

export interface E2EESetup {
  keyProvider: ExternalE2EEKeyProviderType;
  worker: Worker;
}

function browserSupportsE2EE(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof Worker === 'undefined') return false;
  if (typeof crypto === 'undefined' || !crypto.subtle) return false;
  if (typeof RTCRtpSender === 'undefined') return false;
  return true;
}

/**
 * Create an E2EE setup tied to the supplied call's livekit_room name.
 * Returns null when E2EE is disabled (default) or unsupported.
 */
export async function createE2EESetup(livekitRoom: string): Promise<E2EESetup | null> {
  if (!E2EE_ENABLED) return null;
  if (!browserSupportsE2EE()) return null;
  if (!livekitRoom || livekitRoom.length < 8) return null;

  // audit15 fix-37: dynamic import so the ExternalE2EEKeyProvider class is
  // only loaded when E2EE is actually requested. Avoids any chance of a
  // top-level import side effect crashing the page when E2EE is off.
  let ExternalE2EEKeyProvider: typeof ExternalE2EEKeyProviderType | undefined;
  try {
    const lk = await import('livekit-client');
    ExternalE2EEKeyProvider = lk.ExternalE2EEKeyProvider;
  } catch (err) {
    console.warn('[messenger.call] livekit-client e2ee provider import failed:', err);
    return null;
  }
  if (!ExternalE2EEKeyProvider) {
    console.warn('[messenger.call] ExternalE2EEKeyProvider not exported by livekit-client');
    return null;
  }

  let worker: Worker | null = null;
  try {
    // Note: if Turbopack doesn't bundle this subpath import, the URL will
    // not resolve at build time and this line will throw synchronously
    // OR produce a Worker that fails async. The outer try/catch catches
    // the synchronous case; for the async case we accept the orphan and
    // fall back to TLS.
    worker = new Worker(
      new URL('livekit-client/e2ee-worker', import.meta.url),
      { type: 'module' },
    );
  } catch (err) {
    console.warn('[messenger.call] E2EE worker construction failed — falling back to TLS only:', err);
    return null;
  }

  try {
    const keyProvider = new ExternalE2EEKeyProvider();
    await keyProvider.setKey(`messenger-call:${livekitRoom}`);
    return { keyProvider, worker };
  } catch (err) {
    console.warn('[messenger.call] E2EE key provider init failed — falling back to TLS only:', err);
    try { worker.terminate(); } catch {}
    return null;
  }
}

/**
 * Build the LiveKit RoomOptions.e2ee shape from a setup, suitable for
 * `<LiveKitRoom options={...}>`. Returns undefined when no setup.
 */
export function asRoomOptions(setup: E2EESetup | null): RoomOptions | undefined {
  if (!setup) return undefined;
  return {
    e2ee: {
      keyProvider: setup.keyProvider,
      worker: setup.worker,
    },
  };
}
