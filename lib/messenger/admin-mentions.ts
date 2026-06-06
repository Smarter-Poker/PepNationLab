/**
 * Phase 13 / Audit6 shared helper.
 *
 * Server-side @admin mention detection. Lives in one place so every code path
 * that lands a row in `messenger_messages` -- send-message, thread-reply, and
 * the scheduled-message cron -- agrees on the regex and the persistence
 * pattern. Without this helper, audit5 wired @admin detection only into
 * /api/messenger/send-message, which meant:
 *
 *   1. Thread replies containing @admin never created a moderator entry, so
 *      mentions inside threads were silently invisible to the admin inbox.
 *   2. Scheduled messages containing @admin landed via the cron's direct
 *      insert path and skipped detection too.
 *
 * The helper also guards against duplicates via the UNIQUE partial index on
 * `messenger_admin_messages.message_id` added in audit5 by issuing an upsert
 * with `ignoreDuplicates: true`.
 */

// Phase 13: word-bounded, case-insensitive, allows trailing sentence punctuation.
// Same regex audit5 used inline so behaviour is identical.
export const ADMIN_MENTION_RE = /(^|\s)@admin(\s|$|[.,!?;:])/i;

export function hasAdminMention(text: string | null | undefined): boolean {
  if (!text) return false;
  return ADMIN_MENTION_RE.test(text);
}

// Accept any Supabase-compatible client - the real generated client's
// PostgrestFilterBuilder return type is a superset of what we use here.
interface ServiceClientLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

/**
 * Persist a @admin mention. Non-fatal: on any failure we swallow because the
 * source message has already been written. Idempotent via the UNIQUE
 * partial index on `message_id` plus `onConflict: message_id` upsert.
 */
export async function recordAdminMention(
  svc: ServiceClientLike,
  args: {
    messageId: string;
    conversationId: string;
    senderId: string;
    text: string;
  },
): Promise<void> {
  try {
    await svc.from('messenger_admin_messages').upsert(
      {
        message_id: args.messageId,
        conversation_id: args.conversationId,
        sender_id: args.senderId,
        message_text: args.text.slice(0, 500),
        status: 'unread',
      },
      { onConflict: 'message_id', ignoreDuplicates: true },
    );
  } catch {
    // non-fatal: message itself is already persisted
  }
}
