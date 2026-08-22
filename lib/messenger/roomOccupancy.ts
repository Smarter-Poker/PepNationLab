/**
 * lib/messenger/roomOccupancy.ts
 *
 * Server-side LiveKit room occupancy check.
 *
 * Owner report 2026-08-19: "it's making random calls all by itself". Root
 * cause: a group call everyone had left was still 'active' in messenger_calls
 * (the leave guards deliberately do not end a call whose remote count reads
 * zero mid-reconnect, and no client stayed around to write 'ended'). Every
 * app focus then re-surfaced a full-screen "call in progress" card for a
 * meeting that ended half an hour ago - which reads exactly like the phone
 * spontaneously making calls.
 *
 * The database cannot know whether a room is really live - only LiveKit can.
 * This helper asks it. Callers use the answer to self-heal stranded rows.
 *
 * Returns:
 *   true  - the room exists with ZERO participants, or LiveKit has already
 *           garbage-collected it (room not found = nobody in it).
 *   false - at least one participant is connected: genuinely live.
 *   null  - could not determine (API error, missing config). Callers must
 *           FAIL OPEN on null and keep today's behavior - never end a call
 *           because a status check errored.
 */

export async function livekitRoomIsEmpty(livekitRoom: string): Promise<boolean | null> {
  try {
    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!url || !apiKey || !apiSecret || !livekitRoom) return null;

    const { RoomServiceClient } = await import('livekit-server-sdk');
    // RoomServiceClient speaks HTTP; the env var holds the client WS URL.
    const httpUrl = url.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
    const svc = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    const participants = await svc.listParticipants(livekitRoom);
    return participants.length === 0;
  } catch (err) {
    // LiveKit deletes a room shortly after the last participant leaves;
    // "room not found" therefore MEANS empty, not error.
    const msg = String((err as { message?: string } | null)?.message ?? err ?? '');
    if (/not[\s_-]?found|does not exist/i.test(msg)) return true;
    console.warn('[roomOccupancy] livekit check failed (failing open):', msg.slice(0, 200));
    return null;
  }
}

/**
 * A stranded-'active' row is only declared dead when the room is EMPTY and
 * the call is old enough that "the accepter has not connected yet" is no
 * longer plausible. 45 seconds is several times the worst observed
 * accept-to-connect time.
 */
export const OCCUPANCY_GRACE_MS = 45 * 1000;

export function pastOccupancyGrace(answeredAt: string | null, startedAt: string | null): boolean {
  const anchor = answeredAt ?? startedAt;
  if (!anchor) return true;
  const t = Date.parse(anchor);
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > OCCUPANCY_GRACE_MS;
}
