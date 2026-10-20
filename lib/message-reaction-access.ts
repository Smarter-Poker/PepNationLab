/** Service clients bypass RLS, so every reaction request must check its parent. */
export async function authorizeMessageReaction(
  service: { from: (table: string) => any },
  messageId: unknown,
  userId: string,
): Promise<{ status: number; error?: string }> {
  if (typeof messageId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId)) {
    return { status: 400, error: 'Invalid Message Id' };
  }
  const { data, error } = await service.from('internal_messages')
    .select('sender_id, receiver_id').eq('id', messageId).maybeSingle();
  if (error) return { status: 500, error: 'An Unexpected Error Occurred.' };
  // Missing and unrelated messages intentionally have the same response.
  if (!data || (data.sender_id !== userId && data.receiver_id !== userId)) {
    return { status: 404, error: 'Message Not Found' };
  }
  return { status: 200 };
}
