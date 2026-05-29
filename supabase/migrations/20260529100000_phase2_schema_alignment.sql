-- =============================================
-- Phase 2 Schema Alignment Migration
-- Fixes all missing tables and columns found
-- by the deep-dive audit.
-- =============================================

-- 1. Add missing columns to internal_messages
ALTER TABLE internal_messages
  ADD COLUMN IF NOT EXISTS invoice_status TEXT,
  ADD COLUMN IF NOT EXISTS invoice_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS line_items JSONB,
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES internal_messages(id),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_broadcast BOOLEAN DEFAULT false;

-- 2. Update type CHECK constraint to allow new types
ALTER TABLE internal_messages DROP CONSTRAINT IF EXISTS internal_messages_type_check;
ALTER TABLE internal_messages ADD CONSTRAINT internal_messages_type_check
  CHECK (type IN ('direct_message','notification','invoice','broadcast','credit_memo','payment_reminder'));

-- 3. Add missing columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS auto_responder_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_responder_message TEXT,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- 4. Create message_reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES internal_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own reactions" ON message_reactions
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can read reactions on their messages" ON message_reactions
  FOR SELECT USING (
    message_id IN (SELECT id FROM internal_messages WHERE sender_id = auth.uid() OR receiver_id = auth.uid())
  );

-- 5. Create message_templates table
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own templates" ON message_templates
  FOR ALL USING (auth.uid() = user_id);

-- 6. Create archived_conversations table
CREATE TABLE IF NOT EXISTS archived_conversations (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  counterpart_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  archived_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, counterpart_id)
);
ALTER TABLE archived_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own archives" ON archived_conversations
  FOR ALL USING (auth.uid() = user_id);

-- 7. Fix notification_preferences — add missing columns
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS email_on_message BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_on_invoice BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS browser_push BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS mute_all BOOLEAN DEFAULT false;

-- 8. Ensure store_overhaul columns exist
ALTER TABLE agent_profiles
  ADD COLUMN IF NOT EXISTS enable_dynamic_pricing BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dynamic_pricing_tiers JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS min_order_qty INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS enable_bulk_discounts BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bulk_discount_tiers JSONB DEFAULT '[]';

ALTER TABLE agent_products
  ADD COLUMN IF NOT EXISTS is_on_sale BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10,2);

ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS max_uses_per_user INTEGER DEFAULT 1;

-- 9. Index for soft-delete queries
CREATE INDEX IF NOT EXISTS idx_internal_messages_deleted_at ON internal_messages (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_internal_messages_reply_to ON internal_messages (reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions (message_id);
