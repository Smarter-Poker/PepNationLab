import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import CheckoutForm from './CheckoutForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ agent?: string }>;
}

export default async function CheckoutPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const params = await searchParams;
  // Sanitize the agentSlug - only allow alphanumeric + hyphens/underscores
  const rawAgent = params.agent ?? null;
  const agentSlug = typeof rawAgent === 'string' && /^[a-zA-Z0-9_-]+$/.test(rawAgent) ? rawAgent : null;

  if (!user) {
    const redirectTarget = agentSlug
      ? `/checkout?agent=${encodeURIComponent(agentSlug)}`
      : '/checkout';
    redirect(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
  }

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, tier, referring_agent_id, is_sub_agent')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    redirect('/login');
  }

  // Fetch PNL pricing configuration to pass down
  // Use service client so researcher-level RLS does not block the read
  const supabaseService = await createServiceClient();
  const { data: tiers } = await supabaseService
    .from('pricing_tiers')
    .select('tier_name, multiplier');

  const tierMultipliers: Record<string, number> = {};
  (tiers ?? []).forEach((t: any) => {
    tierMultipliers[t.tier_name] = Number(t.multiplier);
  });

  // Resolve the agent's payment handles so CheckoutForm shows only the
  // handles this specific agent has configured (not hardcoded platform handles).
  // Prefer agentSlug (storefront URL) -> then researcher's referring_agent_id.
  let agentPaymentHandles: Record<string, string> = {};
  let minOverallQty = 1;
  let minOrderQty = 1;
  let volumeDiscountsEnabled = true;
  try {

    if (agentSlug) {
      const { data: ap } = await supabase
        .from('agent_profiles')
        .select('payment_handles, min_overall_qty, min_order_qty, volume_pricing_enabled')
        .eq('slug', agentSlug)
        .maybeSingle();
      if (ap?.payment_handles) {
        if (typeof ap.payment_handles === 'string') {
          try { agentPaymentHandles = JSON.parse(ap.payment_handles); } catch {}
        } else {
          agentPaymentHandles = ap.payment_handles as Record<string, string>;
        }
      }
      if (ap?.min_overall_qty) {
        minOverallQty = ap.min_overall_qty;
      }
      if (ap?.min_order_qty) {
        minOrderQty = ap.min_order_qty;
      }
      if ((ap as { volume_pricing_enabled?: boolean | null } | null)?.volume_pricing_enabled === false) {
        volumeDiscountsEnabled = false;
      }
    } else if (profile.referring_agent_id) {
      const { data: ap } = await supabase
        .from('agent_profiles')
        .select('payment_handles, min_overall_qty, min_order_qty, volume_pricing_enabled')
        .eq('id', profile.referring_agent_id)
        .maybeSingle();
      if (ap?.payment_handles) {
        if (typeof ap.payment_handles === 'string') {
          try { agentPaymentHandles = JSON.parse(ap.payment_handles); } catch {}
        } else {
          agentPaymentHandles = ap.payment_handles as Record<string, string>;
        }
      }
      if (ap?.min_overall_qty) {
        minOverallQty = ap.min_overall_qty;
      }
      if (ap?.min_order_qty) {
        minOrderQty = ap.min_order_qty;
      }
      if ((ap as { volume_pricing_enabled?: boolean | null } | null)?.volume_pricing_enabled === false) {
        volumeDiscountsEnabled = false;
      }
    }
  } catch {
    // Non-blocking - checkout still works without agent handles
  }

  return (
    <CheckoutForm
      userProfile={profile}
      userEmail={user.email ?? ''}
      tierMultipliers={tierMultipliers}
      agentSlug={agentSlug}
      agentPaymentHandles={agentPaymentHandles}
      minOverallQty={minOverallQty}
      minOrderQty={minOrderQty}
      volumeDiscountsEnabled={volumeDiscountsEnabled}
    />
  );
}
