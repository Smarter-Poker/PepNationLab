import { describe,it,expect,vi } from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/lib/admin-auth',()=>({requireAgent:async()=>({ok:true,user:{id:'own-agent'}})}));
vi.mock('@/lib/supabase/server',()=>({createServiceClient:async()=>({rpc:mocks.rpc})}));
import { GET } from '@/app/api/agent/tier/route';
describe('own account contract display',()=>{
 it('shows retail percentage instead of the old commission markup',async()=>{
  mocks.rpc.mockResolvedValue({data:[{retail_factor:0.75,house_cogs_multiplier:1.5}],error:null});
  const r=await GET();const b=await r.json();
  expect(b.contractPricing.percentage).toBe(75);expect(b.contractPricing.basis).toBe('Store Retail');expect(b.chainPriced).toBeUndefined();
  expect(mocks.rpc).toHaveBeenCalledWith('fn_account_pricing_contract',{p_agent:'own-agent'});
 });
 it('shows the actual COG basis for the root account',async()=>{
  mocks.rpc.mockResolvedValue({data:[{retail_factor:null,house_cogs_multiplier:1.5}],error:null});
  const b=await (await GET()).json();expect(b.contractPricing.percentage).toBe(150);expect(b.contractPricing.basis).toBe('Pep Nation COGS');
 });
});
