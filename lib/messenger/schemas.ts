import { z } from 'zod';

// Audit4 fix: media_metadata is JSONB and is currently capped only by the
// 1 MB Next.js request body limit. Persisting multi-megabyte client JSON
// per message is wasteful, slows realtime fanout, and the column was only
// ever spec'd for filename / mime / dimensions. Cap to 8 KB serialized.
const MEDIA_METADATA_MAX_BYTES = 8 * 1024;
function boundedMetadata() {
  return z
    .record(z.string(), z.unknown())
    .refine(
      (v) => {
        try {
          return Buffer.byteLength(JSON.stringify(v), 'utf8') <= MEDIA_METADATA_MAX_BYTES;
        } catch {
          return false;
        }
      },
      { message: 'mediaMetadata exceeds 8KB' },
    );
}

export const StartConversationSchema = z.object({
  type: z.enum(['direct', 'group', 'announcement']),
  participantIds: z.array(z.string().uuid()).min(1).max(50),
  title: z.string().trim().max(120).optional(),
  avatarUrl: z.string().url().optional(),
});
export type StartConversationInput = z.infer<typeof StartConversationSchema>;

export const SendMessageSchema = z
  .object({
    conversationId: z.string().uuid(),
    text: z.string().max(2000).optional(),
    messageType: z
      .enum(['text', 'image', 'gif', 'voice', 'video', 'file', 'contact_card', 'location', 'poll'])
      .default('text'),
    mediaUrl: z.string().url().optional(),
    mediaMetadata: boundedMetadata().optional(),
    replyToId: z.string().uuid().optional(),
    threadParentId: z.string().uuid().optional(),
    expiresAt: z.string().datetime().optional(),
    clientMessageId: z.string().uuid().optional(),
  })
  .refine((d) => Boolean(d.text && d.text.trim().length > 0) || Boolean(d.mediaUrl), {
    message: 'Either text or mediaUrl required',
  })
  .refine((d) => !(d.replyToId && d.threadParentId), {
    message: 'Cannot Both Reply And Thread',
  });
export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export const MarkReadSchema = z.object({
  conversationId: z.string().uuid(),
  lastReadMessageId: z.string().uuid(),
});
export type MarkReadInput = z.infer<typeof MarkReadSchema>;

export const ReactSchema = z.object({
  messageId: z.string().uuid(),
  emoji: z.string().min(1).max(32),
  action: z.enum(['add', 'remove']),
});
export type ReactInput = z.infer<typeof ReactSchema>;

export const EditMessageSchema = z.object({
  messageId: z.string().uuid(),
  text: z.string().trim().min(1).max(2000),
});
export type EditMessageInput = z.infer<typeof EditMessageSchema>;

export const DeleteMessageSchema = z.object({
  messageId: z.string().uuid(),
  scope: z.enum(['for_me', 'for_everyone']),
});
export type DeleteMessageInput = z.infer<typeof DeleteMessageSchema>;

export const GetMessagesSchema = z.object({
  conversationId: z.string().uuid(),
  beforeId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(50).optional(),
});
export type GetMessagesInput = z.infer<typeof GetMessagesSchema>;

// Phase 9: groups / participants / mute / archive

export const AddParticipantSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['admin', 'moderator', 'member']).optional(),
});
export type AddParticipantInput = z.infer<typeof AddParticipantSchema>;

export const RemoveParticipantSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
});
export type RemoveParticipantInput = z.infer<typeof RemoveParticipantSchema>;

export const SetParticipantRoleSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'moderator', 'member']),
});
export type SetParticipantRoleInput = z.infer<typeof SetParticipantRoleSchema>;

// Audit10: require one of (unmute=true | muteUntil) so a no-arg call cannot
// silently mute indefinitely.
export const MuteConversationSchema = z
  .object({
    conversationId: z.string().uuid(),
    muteUntil: z.string().datetime().optional(),
    unmute: z.boolean().optional(),
  })
  .refine(
    (v) => v.unmute === true || Boolean(v.muteUntil),
    { message: 'Must Provide Either Unmute Or muteUntil' },
  );
export type MuteConversationInput = z.infer<typeof MuteConversationSchema>;

export const ArchiveConversationSchema = z.object({
  conversationId: z.string().uuid(),
  archived: z.boolean(),
});
export type ArchiveConversationInput = z.infer<typeof ArchiveConversationSchema>;

export const LeaveConversationSchema = z.object({
  conversationId: z.string().uuid(),
});
export type LeaveConversationInput = z.infer<typeof LeaveConversationSchema>;

export const ListParticipantsSchema = z.object({
  conversationId: z.string().uuid(),
});
export type ListParticipantsInput = z.infer<typeof ListParticipantsSchema>;

// Phase 10: premium UX schemas

export const PinMessageSchema = z.object({
  messageId: z.string().uuid(),
  conversationId: z.string().uuid(),
  action: z.enum(['pin', 'unpin']),
});
export type PinMessageInput = z.infer<typeof PinMessageSchema>;

export const ListPinsSchema = z.object({
  conversationId: z.string().uuid(),
});
export type ListPinsInput = z.infer<typeof ListPinsSchema>;

export const BookmarkMessageSchema = z.object({
  messageId: z.string().uuid(),
  action: z.enum(['add', 'remove']),
});
export type BookmarkMessageInput = z.infer<typeof BookmarkMessageSchema>;

export const MESSAGE_LABEL_VALUES = ['Important', 'Action Required', 'Order', 'Payment'] as const;
export type MessageLabelValue = (typeof MESSAGE_LABEL_VALUES)[number];

export const LabelMessageSchema = z.object({
  messageId: z.string().uuid(),
  label: z.enum(MESSAGE_LABEL_VALUES),
  action: z.enum(['add', 'remove']),
});
export type LabelMessageInput = z.infer<typeof LabelMessageSchema>;

export const ListLabelsSchema = z.object({
  messageIds: z.array(z.string().uuid()).min(1).max(200),
});
export type ListLabelsInput = z.infer<typeof ListLabelsSchema>;

export const THEME_VALUES = ['default', 'teal', 'indigo', 'rose', 'amber', 'slate'] as const;
export type ThemeValue = (typeof THEME_VALUES)[number];

export const SetThemeSchema = z.object({
  conversationId: z.string().uuid(),
  themeValue: z.enum(THEME_VALUES),
});
export type SetThemeInput = z.infer<typeof SetThemeSchema>;

export const GetThemeSchema = z.object({
  conversationId: z.string().uuid(),
});
export type GetThemeInput = z.infer<typeof GetThemeSchema>;

export const ScheduleMessageCreateSchema = z
  .object({
    action: z.literal('create').optional().default('create'),
    conversationId: z.string().uuid(),
    text: z.string().max(2000).optional(),
    messageType: z.enum(['text', 'image', 'gif', 'voice', 'video', 'file']).default('text'),
    mediaUrl: z.string().url().optional(),
    mediaMetadata: boundedMetadata().optional(),
    replyToId: z.string().uuid().optional(),
    scheduledAt: z.string().datetime(),
  })
  .refine((d) => Boolean(d.text && d.text.trim().length > 0) || Boolean(d.mediaUrl), {
    message: 'Either text or mediaUrl required',
  });
export type ScheduleMessageCreateInput = z.infer<typeof ScheduleMessageCreateSchema>;

export const ScheduleMessageCancelSchema = z.object({
  action: z.literal('cancel'),
  id: z.string().uuid(),
});
export type ScheduleMessageCancelInput = z.infer<typeof ScheduleMessageCancelSchema>;

export const ThreadReplySchema = z
  .object({
    threadParentId: z.string().uuid(),
    text: z.string().max(2000).optional(),
    messageType: z.enum(['text', 'image', 'gif', 'voice', 'video', 'file']).default('text'),
    mediaUrl: z.string().url().optional(),
  })
  .refine((d) => Boolean(d.text && d.text.trim().length > 0) || Boolean(d.mediaUrl), {
    message: 'Either text or mediaUrl required',
  });
export type ThreadReplyInput = z.infer<typeof ThreadReplySchema>;

export const ListThreadRepliesSchema = z.object({
  threadParentId: z.string().uuid(),
});
export type ListThreadRepliesInput = z.infer<typeof ListThreadRepliesSchema>;

export const TemplateCreateSchema = z.object({
  action: z.literal('create'),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
  category: z.string().trim().max(40).optional(),
  shortcut: z.string().trim().max(40).optional(),
});
export type TemplateCreateInput = z.infer<typeof TemplateCreateSchema>;

export const TemplateUpdateSchema = z.object({
  action: z.literal('update'),
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(120).optional(),
  body: z.string().trim().min(1).max(2000).optional(),
  category: z.string().trim().max(40).optional(),
  shortcut: z.string().trim().max(40).optional(),
});
export type TemplateUpdateInput = z.infer<typeof TemplateUpdateSchema>;

export const TemplateDeleteSchema = z.object({
  action: z.literal('delete'),
  id: z.string().uuid(),
});
export type TemplateDeleteInput = z.infer<typeof TemplateDeleteSchema>;

export const TemplateUseSchema = z.object({
  action: z.literal('use'),
  id: z.string().uuid(),
});
export type TemplateUseInput = z.infer<typeof TemplateUseSchema>;

export const TemplateActionSchema = z.discriminatedUnion('action', [
  TemplateCreateSchema,
  TemplateUpdateSchema,
  TemplateDeleteSchema,
  TemplateUseSchema,
]);
export type TemplateActionInput = z.infer<typeof TemplateActionSchema>;

// Phase 11: voice / video calls (LiveKit)

export const StartCallSchema = z.object({
  conversationId: z.string().uuid(),
  callType: z.enum(['audio', 'video']),
});
export type StartCallInput = z.infer<typeof StartCallSchema>;

export const CallSignalSchema = z.object({
  callId: z.string().uuid(),
  action: z.enum(['start', 'accept', 'decline', 'hangup']),
});
export type CallSignalInput = z.infer<typeof CallSignalSchema>;

export const LivekitTokenSchema = z.object({
  callId: z.string().uuid(),
});
export type LivekitTokenInput = z.infer<typeof LivekitTokenSchema>;

// Phase 12: safety - blocks / reports / admin moderation

export const BlockUserSchema = z.object({
  targetUserId: z.string().uuid(),
  action: z.enum(['block', 'unblock']),
  reason: z.string().max(500).optional(),
});
export type BlockUserInput = z.infer<typeof BlockUserSchema>;

export const ReportMessageSchema = z.object({
  messageId: z.string().uuid(),
  reason: z.enum(['spam', 'harassment', 'inappropriate', 'scam', 'other']),
  note: z.string().max(500).optional(),
});
export type ReportMessageInput = z.infer<typeof ReportMessageSchema>;

export const ResolveReportSchema = z.object({
  reportId: z.string().uuid(),
  status: z.enum(['resolved', 'dismissed']),
  note: z.string().max(500).optional(),
});
export type ResolveReportInput = z.infer<typeof ResolveReportSchema>;

export const DeleteReportedMessageSchema = z.object({
  messageId: z.string().uuid(),
  reportId: z.string().uuid().optional(),
});
export type DeleteReportedMessageInput = z.infer<typeof DeleteReportedMessageSchema>;

// Phase 13: intelligence - reminders

export const SetReminderSchema = z
  .object({
    messageId: z.string().uuid().optional(),
    conversationId: z.string().uuid().optional(),
    remindAt: z.string().datetime(),
    note: z.string().max(500).optional(),
  })
  .refine(
    (v) => Boolean(v.messageId) || Boolean(v.conversationId),
    { message: 'Reminder Must Bind To A Message Or Conversation' },
  );
export type SetReminderInput = z.infer<typeof SetReminderSchema>;

export const CancelReminderSchema = z.object({
  reminderId: z.string().uuid(),
});
export type CancelReminderInput = z.infer<typeof CancelReminderSchema>;

export const ListAdminMentionsSchema = z.object({
  status: z.enum(['unread', 'read', 'resolved']).optional(),
});
export type ListAdminMentionsInput = z.infer<typeof ListAdminMentionsSchema>;

export const ResolveAdminMentionSchema = z.object({
  mentionId: z.string().uuid(),
  status: z.enum(['read', 'resolved']),
  note: z.string().max(500).optional(),
});
export type ResolveAdminMentionInput = z.infer<typeof ResolveAdminMentionSchema>;

export const NotificationPrefsSchema = z.object({
  browserPush: z.boolean().optional(),
  emailOnMessage: z.boolean().optional(),
  emailOnInvoice: z.boolean().optional(),
  muteAll: z.boolean().optional(),
});
export type NotificationPrefsInput = z.infer<typeof NotificationPrefsSchema>;
