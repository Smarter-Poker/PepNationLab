import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { parseJsonBody } from '@/lib/schemas/http';
import { createServiceClient } from '@/lib/supabase/server';
import { contractCosts } from '@/lib/account-pricing';
const schema=z.object({items:z.array(z.object({id:z.uuid(),quantity:z.number().int().positive(),bundleName:z.string().nullable().optional()})).min(1).max(250)});
/** Private own-account prices refresh stale carts without exposing upline costs. */
export async function POST(req: NextRequest) {
 const csrf=assertSameOrigin(req); if(csrf)return csrf;
 const gate=await requireAgent(); if(!gate.ok)return gate.response;
 const body=await parseJsonBody(req,schema); if(!body.ok)return body.response;
 try {
  const svc=await createServiceClient();
  const groups=new Map<string|null,string[]>();
  for(const item of body.data.items){const name=item.bundleName??null;groups.set(name,[...(groups.get(name)??[]),item.id]);}
  const prices:Array<{id:string;bundleName:string|null;unitPrice:number}>=[];
  for(const [name,ids]of groups){
   const costs=await contractCosts(svc,gate.user.id,ids,name);
   if(!costs.size)return NextResponse.json({fixed:false},{headers:{'Cache-Control':'private, no-store'}});
   for(const id of ids)prices.push({id,bundleName:name,unitPrice:costs.get(id)!});
  }
  return NextResponse.json({fixed:true,prices},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({error:'Current Account Prices Could Not Be Loaded.'},{status:503});}
}
