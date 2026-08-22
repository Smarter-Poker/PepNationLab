/**
 * lib/messenger/conversations.ts
 *
 * Shared direct-conversation resolver. Previously duplicated verbatim in
 * /api/researcher/payment-proof and /api/agent/orders/mark-paid; extracted so
 * every route that needs to drop a message into the buyer<->agent thread uses
 * one implementation.
 *
 * Returns the existing direct conversation between the two users, creating
 * one (with both participants) when none exists. Never throws - returns null
 * on any failure so messenger integration stays best-effort.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export async function findOrCreateDirectConversation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svc: SupabaseClient<any, any, any>,
  userAId: string,
  userBId: string,
): Promise<string | null> {
  try {
    // A buyer==agent "self-buy" (a store owner test-buying their own store) has
    // no distinct counterparty. Returning the first arbitrary direct thread here
    // mis-files the payment-proof / confirming-payment messages into an unrelated
    // conversation (in practice the user's standing admin support DM), making the
    // owner's own messages surface under the admin's name. No buyer<->seller
    // message is needed for a self-buy, so skip messenger integration entirely.
    if (userAId === userBId) return null;

    const { data: aParticipations } = await svc
      .from('messenger_participants')
      .select('conversation_id')
      .eq('user_id', userAId);

    const aConvoIds = (aParticipations ?? [])
      .map((p) => p.conversation_id)
      .filter(Boolean) as string[];

    if (aConvoIds.length > 0) {
      const { data: sharedDirectConvos } = await svc
        .from('messenger_conversations')
        .select('id')
        .eq('type', 'direct')
        .in('id', aConvoIds);

      const sharedDirectIds = (sharedDirectConvos ?? []).map((c) => c.id);

      if (sharedDirectIds.length > 0) {
        const { data: sharedPart } = await svc
          .from('messenger_participants')
          .select('conversation_id')
          .eq('user_id', userBId)
          .in('conversation_id', sharedDirectIds)
          .limit(1)
          .maybeSingle();

        if (sharedPart?.conversation_id) return sharedPart.conversation_id;
      }
    }

    const { data: newConvo, error: convoErr } = await svc
      .from('messenger_conversations')
      .insert({ type: 'direct' })
      .select('id')
      .maybeSingle();

    if (convoErr || !newConvo?.id) return null;

    await svc.from('messenger_participants').insert([
      { conversation_id: newConvo.id, user_id: userAId },
      { conversation_id: newConvo.id, user_id: userBId },
    ]);

    return newConvo.id;
  } catch {
    return null;
  }
}
