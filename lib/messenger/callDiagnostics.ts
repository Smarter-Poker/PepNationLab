/** Messenger diagnostics remain in the local browser or server logs. */
import { log, type LogLevel } from '../log';

export interface CallContext {
  call_id?: string;
  conversation_id?: string;
  initiator_id?: string;
  call_type?: 'audio' | 'video';
  [key: string]: unknown;
}

type CallStage = 'start' | 'accept' | 'decline' | 'hangup' | 'sweep' |
  'token_fetch' | 'token_refresh' | 'broadcast' | 'push' | 'overlay' | 'realtime' | 'unknown';

function emit(level: LogLevel, context: Record<string, unknown>, error?: unknown): void {
  try {
    log(level, 'messenger.call', context, error);
  } catch {
    // Telemetry cannot interrupt a call or its original failure response.
    try { console.error('[messenger.call] Diagnostic could not be serialized'); } catch { /* Console unavailable. */ }
  }
}

export function captureCallError(err: unknown, stage: CallStage, context: CallContext = {}): void {
  emit('error', { ...context, stage }, err);
}

export function captureCallEvent(message: string, stage: CallStage,
  level: 'info' | 'warning' | 'error' = 'info', context: CallContext = {}): void {
  emit(level === 'warning' ? 'warn' : level, { ...context, stage, message });
}

export function recordCallMetric(name: string, value: number, context: CallContext = {}): void {
  emit('info', { ...context, metric: name, value });
}
