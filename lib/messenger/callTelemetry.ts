/**
 * audit15 fix-19 (B6): centralized telemetry writer for messenger calls.
 *
 * Every terminal call action funnels through this helper so admin_audit_log
 * gets a uniform record. Action names are namespaced under
 * `messenger_call.` so a single LIKE filter surfaces the whole stream.
 *
 * All inserts are best-effort - a telemetry failure must never block the
 * actual call flow, so every call is wrapped in try/catch with a console
 * warning.
 */

import { createServiceClient } from '@/lib/supabase/server';

export type CallTelemetryAction =
  | 'messenger_call.start'
  | 'messenger_call.accept'
  | 'messenger_call.decline'
  | 'messenger_call.hangup'
  | 'messenger_call.missed_timeout'
  | 'messenger_call.stale_active_sweep'
  | 'messenger_call.duplicate_identity'
  | 'messenger_call.media_error';

export interface CallTelemetryPayload {
  call_id: string;
  conversation_id: string;
  initiator_id: string;
  call_type: 'audio' | 'video';
  /** ms from started_at to answered_at (only meaningful for accept). */
  ring_ms?: number;
  /** ms from answered_at to ended_at (only meaningful for hangup of active). */
  talk_ms?: number;
  /** terminal reason - 'declined' | 'missed_timeout' | 'ended_before_answer' | 'ended' */
  reason?: string;
  /** participant count when terminal - useful for group call analytics. */
  participant_count?: number;
  /** any additional context - kept generic so we can extend without schema changes. */
  [key: string]: unknown;
}

/**
 * Write a single telemetry row. `actorId` is the user who took the action
 * (initiator for start/hangup, callee for accept/decline; null for cron
 * sweeps). Caller passes whatever IP / UA they have access to.
 */
export async function recordCallTelemetry(
  action: CallTelemetryAction,
  actorId: string | null,
  payload: CallTelemetryPayload,
  ipAddress?: string | null,
  userAgent?: string | null,
): Promise<void> {
  try {
    const svc = await createServiceClient();
    await svc.from('admin_audit_log').insert({
      actor_id: actorId,
      action,
      entity_type: 'messenger_call',
      entity_id: payload.call_id,
      changes: payload as any,
      ip_address: ipAddress ?? null,
      user_agent: userAgent ?? null,
    });
  } catch (err) {
    // Telemetry MUST NOT block the call flow. Log and move on.
    console.warn('[messenger.call] telemetry insert failed', {
      action,
      call_id: payload.call_id,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
