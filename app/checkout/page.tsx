import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CheckoutForm from './CheckoutForm';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/checkout');
  }

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, tier, referring_agent_id')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  // Fetch PNL pricing configuration to pass down
  const { data: tiers } = await supabase
    .from('pricing_tiers')
    .select('tier_name, multiplier');

  const tierMultipliers: Record<string, number> = {};
  tiers?.forEach(t => {
    tierMultipliers[t.tier_name] = Number(t.multiplier);
  });

  return (
    <CheckoutForm
      userProfile={profile}
      userEmail={user.email ?? ''}
      tierMultipliers={tierMultipliers}
    />
  );
}
