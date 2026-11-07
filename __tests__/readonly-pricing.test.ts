import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const m=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/lib/admin-auth',()=>({requireAgent:async()=>({ok:true,user:{id:'own-agent'},isAdmin:false}),requireAgentOrAdmin:async()=>({ok:true,user:{id:'own-agent'},isAdmin:false})}));
vi.mock('@/lib/supabase/server',()=>({createServiceClient:async()=>({rpc:m.rpc}),createAdminClient:()=>({rpc:m.rpc}),createClient:async()=>({rpc:m.rpc})}));
vi.mock('@/lib/csrf',()=>({assertSameOrigin:()=>null}));
import { PATCH as productPatch } from '@/app/api/agent/products/route';
import { POST as bundlePost, PATCH as bundlePatch, DELETE as bundleDelete } from '@/app/api/agent/bundles/route';
import { POST as couponPost } from '@/app/api/agent/coupons/route';
import { POST as couponBulk } from '@/app/api/agent/coupons/bulk/route';
import { POST as baselinePost } from '@/app/api/agent/super-agent/pricing/route';
import { PATCH as couponPatch, DELETE as couponDelete } from '@/app/api/agent/coupons/[id]/route';
import { canEditStorePricing } from '@/lib/account-pricing';
const request=(method:string,body:unknown)=>new NextRequest('https://pepnationlab.com/api/agent/products',{method,body:JSON.stringify(body),headers:{'Content-Type':'application/json'}});
beforeEach(()=>{vi.clearAllMocks();m.rpc.mockResolvedValue({data:false,error:null});});
describe('account pricing editing permission',()=>{
 it.each([{retail_price:60},{sale_price:50},{is_on_sale:true},{margin_percent:60},{manufacturer_cost:10}])('refuses a direct product pricing request %j',async patch=>{
  const r=await productPatch(request('PATCH',{id:'11111111-1111-4111-8111-111111111111',...patch}));
  expect(r.status).toBe(403);expect(m.rpc).toHaveBeenCalledExactlyOnceWith('can_edit_store_pricing',{p_agent:'own-agent'});
 });
 it.each([['POST',bundlePost],['PATCH',bundlePatch],['DELETE',bundleDelete]] as const)('refuses bundle mutation %s',async(method,handler)=>{
  const r=await handler(request(method,{id:'bundle',action:'update_price',custom_price:60}));
  expect(r.status).toBe(403);expect(m.rpc).toHaveBeenCalledExactlyOnceWith('can_edit_store_pricing',{p_agent:'own-agent'});
 });
 it.each([['Coupon',couponPost],['Bulk Coupons',couponBulk],['Baseline',baselinePost]] as const)('refuses alternate pricing edits %s',async(_name,handler)=>{
  expect((await handler(request('POST',{}))).status).toBe(403);
 });
 it.each([['PATCH',couponPatch],['DELETE',couponDelete]] as const)('refuses coupon changes %s',async(method,handler)=>{
  const r=await handler(request(method,{}),{params:Promise.resolve({id:'11111111-1111-4111-8111-111111111111'})});
  expect(r.status).toBe(403);
 });
 it('fails closed when the permission response is unavailable',async()=>{
  m.rpc.mockResolvedValue({data:null,error:{message:'unavailable'}});
  await expect(canEditStorePricing({rpc:m.rpc} as any,'own-agent')).rejects.toThrow('Pricing Permission Unavailable');
 });
});
