import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

/**
 * GET /api/agent/storefront-config/shippo-key
 *
 * Returns the calling agent's unmasked Shippo API token. Used only when the
 * agent clicks "Show Key" in the Storefront Config UI. The key is never sent
 * in any other server -> client payload (the dashboard hydration redacts it
 * to a masked last-4 + boolean presence flag).
 */
export async function GET() {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('agent_profiles')
    .select('shippo_api_key')
    .eq('id', gate.user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Agent Profile Not Found' }, { status: 404 });
  }

  return NextResponse.json({ shippo_api_key: data?.shippo_api_key ?? '' });
}
