import { describe,it,expect,vi } from 'vitest';
import { NextRequest,NextResponse } from 'next/server';
const m=vi.hoisted(()=>({rpc:vi.fn(),gate:vi.fn()}));
vi.mock('@/lib/admin-auth',()=>({requireAgent:()=>m.gate()}));
vi.mock('@/lib/csrf',()=>({assertSameOrigin:()=>null}));
vi.mock('@/lib/supabase/server',()=>({createServiceClient:async()=>({rpc:m.rpc})}));
import { POST } from '@/app/api/cart/contract-prices/route';
const id='00000000-0000-4000-8000-000000000001';
const req=()=>new NextRequest('https://pepnationlab.com/api/cart/contract-prices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agentId:'another-agent',items:[{id,quantity:1,bundleName:'Swole Savage'}]})});
describe('private contract cart prices',()=>{
 it('quotes only the authenticated account and returns its purchase price',async()=>{
  m.gate.mockResolvedValue({ok:true,user:{id:'actual-agent'}});
  m.rpc.mockResolvedValue({data:[{product_id:id,cost:33.75}],error:null});
  const r=await POST(req());expect(r.status).toBe(200);expect(r.headers.get('Cache-Control')).toContain('private');
  expect(await r.json()).toEqual({fixed:true,prices:[{id,bundleName:'Swole Savage',unitPrice:33.75}]});
  expect(m.rpc).toHaveBeenLastCalledWith('fn_contract_costs',{p_agent:'actual-agent',p_products:[id],p_bundle:'Swole Savage'});
 });
 it('refuses an unauthenticated or unauthorized caller before reading costs',async()=>{
  m.rpc.mockClear();m.gate.mockResolvedValue({ok:false,response:NextResponse.json({error:'Forbidden'},{status:403})});
  expect((await POST(req())).status).toBe(403);expect(m.rpc).not.toHaveBeenCalled();
 });
});
