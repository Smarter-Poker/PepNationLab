/**
 * audit15 fix-24 (B9): Sentry wrapper for the messenger call subsystem.
 *
 * Centralizes error and event reporting so the surface has a single tagged
 * stream operators can filter on. All helpers swallow Sentry setup errors
 * — telemetry must never break a real call.
 */

import * as Sentry from '@sentry/nextjs';

export interface CallSentryContext {
  call_id?: string;
  conversation_id?: string;
  initiator_id?: string;
  call_type?: 'audio' | 'video';
  /** Free-form additional context. */
  [key: string]: unknown;
}

type CallStage =
  | 'start'
  | 'accept'
  | 'decline'
  | 'hangup'
  | 'sweep'
  | 'token_fetch'
  | 'token_refresh'
  | 'broadcast'
  | 'push'
  | 'overlay'
  | 'realtime'
  | 'unknown';

function safe<T>(fn: () => T): void {
  try {
    fn();
  } catch (err) {
    // Sentry itself failed — silently drop. Console only.
    if (typeof console !== 'undefined') {
      console.warn('[messenger.call] sentry helper threw', err);
    }
  }
}

export function captureCallError(
  err: unknown,
  stage: CallStage,
  context: CallSentryContext = {},
): void {
  safe(() => {
    Sentry.withScope((scope) => {
      scope.setTag('feature', 'messenger.call');
      scope.setTag('stage', stage);
      if (context.call_id) scope.setTag('call_id', context.call_id);
      if (context.conversation_id) scope.setTag('conversation_id', context.conversation_id);
      if (context.call_type) scope.setTag('call_type', context.call_type);
      scope.setContext('call', context);
      const realErr = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
      Sentry.captureException(realErr);
    });
  });
}

export function captureCallEvent(
  message: string,
  stage: CallStage,
  level: 'info' | 'warning' | 'error' = 'info',
  context: CallSentryContext = {},
): void {
  safe(() => {
    Sentry.withScope((scope) => {
      scope.setTag('feature', 'messenger.call');
      scope.setTag('stage', stage);
      if (context.call_id) scope.setTag('call_id', context.call_id);
      if (context.conversation_id) scope.setTag('conversation_id', context.conversation_id);
      scope.setContext('call', context);
      scope.setLevel(level);
      Sentry.captureMessage(message);
    });
  });
}

/**
 * Record a numeric metric attached to a Sentry event. Useful for emitting
 * counts from cron jobs that don't otherwise raise an exception.
 *
 * Example:
 *   recordCallMetric('mark_missed_calls.stale_active_sweep_count', 3);
 *
 * The metric is wrapped in a captureMessage at level=info so it appears as
 * a discrete event in the Sentry feed, with the numeric value in extras.
 * (Native Sentry metrics API is not stable across versions; this
 * approach works against any @sentry/nextjs >= 8.)
 */
export function recordCallMetric(
  name: string,
  value: number,
  context: CallSentryContext = {},
): void {
  safe(() => {
    Sentry.withScope((scope) => {
      scope.setTag('feature', 'messenger.call');
      scope.setTag('metric', name);
      scope.setContext('metric', { name, value, ...context });
      scope.setLevel('info');
      Sentry.captureMessage(`messenger.call.metric ${name}=${value}`);
    });
  });
}
