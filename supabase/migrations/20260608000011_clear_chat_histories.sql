-- Migration: 20260608000011_clear_chat_histories.sql
-- Description: Clear all chat histories, messages, conversations, and reactions from the database

-- 1. Delete dependent tables
DELETE FROM public.message_reactions;
DELETE FROM public.archived_conversations;

DELETE FROM public.messenger_edit_history;
DELETE FROM public.messenger_message_dismissals;
DELETE FROM public.messenger_link_previews;
DELETE FROM public.messenger_pins;
DELETE FROM public.messenger_bookmarks;
DELETE FROM public.messenger_conversation_labels;
DELETE FROM public.messenger_scheduled;
DELETE FROM public.messenger_reactions;
DELETE FROM public.messenger_reports;
DELETE FROM public.messenger_reminders;
DELETE FROM public.messenger_favorites;

-- 2. Delete calls, blocked lists, and admin messages
DELETE FROM public.messenger_calls;
DELETE FROM public.messenger_blocked;
DELETE FROM public.messenger_admin_messages;

-- 3. Delete messages
DELETE FROM public.messenger_messages;
DELETE FROM public.internal_messages;

-- 4. Delete participants and conversations
DELETE FROM public.messenger_participants;
DELETE FROM public.messenger_conversations;

-- 5. Delete templates, labels, and themes
DELETE FROM public.messenger_templates;
DELETE FROM public.messenger_labels;
DELETE FROM public.messenger_themes;
