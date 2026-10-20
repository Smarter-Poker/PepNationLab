/** Cost visibility belongs to the selling agent's hierarchy, never buyer status. */
export async function canReadOrderItemCosts(
  service: { from: (table: string) => any },
  viewer: { id: string; role: string },
  agentId: string | null,
): Promise<boolean> {
  if (viewer.role === 'admin') return true;
  if (!agentId || !['agent', 'super_agent'].includes(viewer.role)) return false;
  if (agentId === viewer.id) return true;
  const { data, error } = await service.from('profiles')
    .select('parent_agent_id').eq('id', agentId).maybeSingle();
  return !error && data?.parent_agent_id === viewer.id;
}
