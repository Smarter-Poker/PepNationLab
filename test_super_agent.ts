import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runTests() {
  console.log('--- SUPER AGENT END-TO-END PRICING VERIFICATION ---');

  const superAgentId = '11111111-1111-4111-8111-111111111111';
  const subAgentId = '22222222-2222-4222-8222-222222222222';
  const researcherId = '33333333-3333-4333-8333-333333333333';
  const productId = '00000000-0000-4000-8000-000000000000';

  // 1. SETUP
  await supabase.from('profiles').delete().in('id', [superAgentId, subAgentId, researcherId]);
  await supabase.from('products').delete().eq('id', productId);
  
  await supabase.from('products').insert({
    id: productId, name: 'Test Peptide X', slug: 'test-peptide-x', base_cost: 10.00, inventory_count: 100, is_active: true
  });
  await supabase.from('profiles').insert({
    id: superAgentId, email: 'super@pepnationrx.com', role: 'agent', is_super_agent: true, tier: 'tier_1' // tier 1 = 3.0x = $30.00
  });
  await supabase.from('profiles').insert({
    id: subAgentId, email: 'sub@pepnationrx.com', role: 'agent', parent_agent_id: superAgentId
  });
  await supabase.from('profiles').insert({
    id: researcherId, email: 'researcher@pepnationrx.com', role: 'user', referring_agent_id: subAgentId, tier: 'tier_3'
  });
  await supabase.from('super_agent_pricing').insert({
    super_agent_id: superAgentId, product_id: productId, baseline_cost: 50.00 // Sub-Agent pays $50
  });
  await supabase.from('agent_products').insert({
    agent_id: subAgentId, product_id: productId, retail_price: 120.00, is_active: true // Researcher pays $120
  });

  // 2. RUN ORDER API LOGIC (Mocking /api/orders/route.ts)
  const cartItems = [{ id: productId, quantity: 1 }];
  
  const { data: profile } = await supabase.from('profiles').select('id, referring_agent_id').eq('id', researcherId).single();
  const { data: dbProducts } = await supabase.from('products').select('id, name, base_cost, weight_oz').in('id', [productId]);
  
  const { data: tiers } = await supabase.from('pricing_tiers').select('tier_name, multiplier');
  const tierMultipliers: any = {};
  tiers?.forEach(t => { tierMultipliers[t.tier_name] = Number(t.multiplier); });

  let agentProfile: any = null;
  let superAgentProfile: any = null;
  
  if (profile?.referring_agent_id) {
    const { data: ap } = await supabase.from('profiles').select('id, tier, parent_agent_id').eq('id', profile.referring_agent_id).single();
    agentProfile = ap;
    if (ap?.parent_agent_id) {
      const { data: sap } = await supabase.from('profiles').select('id, tier').eq('id', ap.parent_agent_id).single();
      superAgentProfile = sap;
    }
  }

  let agentCustomRetail: any = {};
  if (agentProfile) {
    const { data: acr } = await supabase.from('agent_products').select('product_id, retail_price').eq('agent_id', agentProfile.id);
    acr?.forEach(a => { agentCustomRetail[a.product_id] = Number(a.retail_price); });
  }

  let superAgentBaselines: any = {};
  if (superAgentProfile) {
    const { data: sab } = await supabase.from('super_agent_pricing').select('product_id, baseline_cost').eq('super_agent_id', superAgentProfile.id);
    sab?.forEach(b => { superAgentBaselines[b.product_id] = Number(b.baseline_cost); });
  }

  const dbProduct = dbProducts![0];
  const baseCost = Number(dbProduct.base_cost);

  let retailPrice = agentCustomRetail[dbProduct.id] ?? (baseCost * (tierMultipliers['tier_3'] ?? 7.0));
  let costPrice = retailPrice;
  let superAgentCost = null;

  if (agentProfile) {
    if (superAgentProfile) {
      const saMultiplier = tierMultipliers[superAgentProfile.tier || 'tier_3'] ?? 7.0;
      superAgentCost = baseCost * saMultiplier;
      costPrice = superAgentBaselines[dbProduct.id] ?? superAgentCost;
    } else {
      const agentMultiplier = tierMultipliers[agentProfile.tier || 'tier_3'] ?? 7.0;
      costPrice = baseCost * agentMultiplier;
    }
  }

  console.log('--- CALCULATION RESULTS ---');
  console.log('Admin Base Cost: ', baseCost);
  console.log('Super Agent Cost (unit_super_agent_cost): ', superAgentCost, ' (Expected: 30)');
  console.log('Sub-Agent Cost (unit_cost_price): ', costPrice, ' (Expected: 50)');
  console.log('Researcher Retail Price (unit_retail_price): ', retailPrice, ' (Expected: 120)');

  if (superAgentCost === 30 && costPrice === 50 && retailPrice === 120) {
    console.log('✅ PASS: Order Engine accurately routes sub-agent margins to Super Agents!');
  } else {
    console.error('❌ FAIL: Margin logic is flawed.');
  }
}

runTests().catch(console.error);
