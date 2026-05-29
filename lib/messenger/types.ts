export type ConversationType = 'direct' | 'group' | 'announcement';
export type MessageType =
  | 'text' | 'image' | 'gif' | 'voice' | 'file'
  | 'contact_card' | 'location' | 'poll' | 'system';
export type ParticipantRole = 'owner' | 'admin' | 'moderator' | 'member';
export type MessageStatus = 'sent' | 'delivered' | 'read';
export type DeleteScope = 'for_me' | 'for_everyone';
export type MessagePriority = 'normal' | 'urgent' | 'important' | 'low';

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string | null;
  avatar_url: string | null;
  created_by: string | null;
  is_archived: boolean;
  last_message_text: string | null;
  last_message_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Participant {
  id: string;
  conversation_id: string;
  user_id: string;
  role: ParticipantRole;
  is_muted: boolean;
  mute_until: string | null;
  is_pinned: boolean;
  unread_count: number;
  last_read_at: string;
  last_read_message_id: string | null;
  settings: Record<string, unknown>;
  joined_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string | null;
  message_type: MessageType;
  media_url: string | null;
  media_metadata: Record<string, unknown>;
  reply_to_id: string | null;
  thread_parent_id: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  delete_scope: DeleteScope | null;
  priority: MessagePriority;
  status: MessageStatus;
  labels: string[];
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  reaction_type: 'emoji' | 'gif';
  emoji: string | null;
  gif_url: string | null;
  created_at: string;
}

export interface ConversationListItem {
  conversation_id: string;
  type: ConversationType;
  title: string | null;
  avatar_url: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_pinned: boolean;
  is_muted: boolean;
}
