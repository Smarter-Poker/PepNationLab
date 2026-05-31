-- Fix realtime reaction leak by adding conversation_id to messenger_reactions
ALTER TABLE public.messenger_reactions ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.messenger_conversations(id) ON DELETE CASCADE;

-- Backfill existing reactions
UPDATE public.messenger_reactions mr 
SET conversation_id = m.conversation_id 
FROM public.messenger_messages m 
WHERE mr.message_id = m.id;

-- Now that it's backfilled, make it NOT NULL
ALTER TABLE public.messenger_reactions ALTER COLUMN conversation_id SET NOT NULL;
