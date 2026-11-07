import { describe, it, expect } from 'vitest';
import { contractCosts, allocateBundlePrice } from '@/lib/account-pricing';

describe('account pricing contract', () => {
 it('allocates a listed bundle total to exact cents',()=>{
  const values=[...allocateBundlePrice(99.97,[{id:'a',weight:33},{id:'b',weight:33},{id:'c',weight:34}]).values()];
  expect(values.map(n=>Math.round(n*100)).reduce((a,b)=>a+b,0)).toBe(9997);
 });
 it('uses the exact server cost, including 75% retail and bundle allocations', async () => {
   const calls: unknown[]=[];
   const client={rpc:async(name:string,args:unknown)=>{calls.push([name,args]);return {data:[{product_id:'p',cost:'74.98'}],error:null};}};
   expect(await contractCosts(client as any,'agent',['p'],'Swole Savage')).toEqual(new Map([['p',74.98]]));
   expect(calls).toEqual([['fn_contract_costs',{p_agent:'agent',p_products:['p'],p_bundle:'Swole Savage'}]]);
 });
 it('keeps noncontract accounts on their existing pricing path', async()=>{
   expect((await contractCosts({rpc:async()=>({data:[],error:null})} as any,'a',['p'])).size).toBe(0);
 });
 it('fails closed on unavailable or invalid prices',async()=>{
   await expect(contractCosts({rpc:async()=>({data:null,error:{message:'offline'}})} as any,'a',['p'])).rejects.toThrow();
   await expect(contractCosts({rpc:async()=>({data:[{product_id:'p',cost:0}],error:null})} as any,'a',['p'])).rejects.toThrow();
 });
});
