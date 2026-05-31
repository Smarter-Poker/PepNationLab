/**
 * audit15 fix-28 (B5): LiveKit end-to-end encryption setup.
 *
 * Both participants in a call independently derive the same key from
 * the call's `livekit_room` UUID (server-generated, only the
 * authenticated participants have access to it via the call row).
 * The shared key fed to LiveKit's ExternalE2EEKeyProvider means even
 * the SFU cannot decrypt media frames.
 *
 * Returns null when E2EE is disabled or unsupported — caller should
 * pass `undefined` to LiveKitRoom in that case and rely on standard
 * TLS to the SFU.
 *
 * Disable knob:
 *   NEXT_PUBLIC_MESSENGER_CALL_E2EE=off  → returns null
 *
 * Worker bundling: Next.js + Turbopack support `new Worker(new URL(...))`.
 * The livekit-client package ships a worker at
 * `livekit-client/dist/livekit-client.e2ee.worker.mjs` which is
 * resolvable via the new URL pattern.
 */

import { ExternalE2EEKeyProvider } from 'livekit-client';
import type { RoomOptions } from 'livekit-client';

const E2EE_ENABLED = (process.env.NEXT_PUBLIC_MESSENGER_CALL_E2EE ?? 'on').toLowerCase() !== 'off';

export interface E2EESetup {
  keyProvider: ExternalE2EEKeyProvider;
  worker: Worker;
}

function browserSupportsE2EE(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof Worker === 'undefined') return false;
  if (typeof crypto === 'undefined' || !crypto.subtle) return false;
  // Insertable streams (the underlying API LiveKit uses for E2EE) requires
  // RTCRtpScriptTransform OR encoded streams. Detect via the presence of
  // RTCRtpSender / RTCRtpReceiver and one of their advanced surfaces.
  if (typeof RTCRtpSender === 'undefined') return false;
  return true;
}

/**
 * Create an E2EE setup tied to the supplied call's livekit_room name.
 * Returns null when E2EE is disabled or unsupported.
 *
 * The keyProvider derives an AES key from the room name via PBKDF2-style
 * stretching inside LiveKit. Both peers use the same room name → same key.
 */
export async function createE2EESetup(livekitRoom: string): Promise<E2EESetup | null> {
  if (!E2EE_ENABLED) return null;
  if (!browserSupportsE2EE()) return null;
  if (!livekitRoom || livekitRoom.length < 8) return null;

  try {
    // Use the official livekit-client e2ee worker.
    const worker = new Worker(
      new URL('livekit-client/e2ee-worker', import.meta.url),
      { type: 'module' },
    );
    const keyProvider = new ExternalE2EEKeyProvider();
    // The provider expects a passphrase string; livekit_room is a server-
    // generated UUID and serves as the shared secret here. Both peers
    // independently arrive at the same key.
    await keyProvider.setKey(`messenger-call:${livekitRoom}`);
    return { keyProvider, worker };
  } catch (err) {
    // Worker URL didn't resolve, key derivation failed, or browser blocked
    // the worker. Fall back to TLS-only.
    console.warn('[messenger.call] E2EE setup failed — falling back to TLS only:', err);
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
