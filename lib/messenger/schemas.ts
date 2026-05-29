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
