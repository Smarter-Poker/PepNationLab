import { z } from 'zod';

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
      .enum(['text', 'image', 'gif', 'voice', 'file', 'contact_card', 'location', 'poll', 'system'])
      .default('text'),
    mediaUrl: z.string().url().optional(),
    mediaMetadata: z.record(z.string(), z.unknown()).optional(),
    replyToId: z.string().uuid().optional(),
    threadParentId: z.string().uuid().optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .refine((d) => Boolean(d.text && d.text.trim().length > 0) || Boolean(d.mediaUrl), {
    message: 'Either text or mediaUrl required',
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

export const MuteConversationSchema = z.object({
  conversationId: z.string().uuid(),
  muteUntil: z.string().datetime().optional(),
  unmute: z.boolean().optional(),
});
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
    messageType: z.enum(['text', 'image', 'gif', 'voice', 'file']).default('text'),
    mediaUrl: z.string().url().optional(),
    mediaMetadata: z.record(z.string(), z.unknown()).optional(),
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
    messageType: z.enum(['text', 'image', 'gif', 'voice', 'file']).default('text'),
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

export const TemplateActionSchema = z.discriminatedUnion('action', [
  TemplateCreateSchema,
  TemplateUpdateSchema,
  TemplateDeleteSchema,
]);
export type TemplateActionInput = z.infer<typeof TemplateActionSchema>;
