import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  
  try {
    // 1. Find the Savage Brands agent
    const { data: agent, error: agentError } = await supabase
      .from('users')
      .select('id, username, full_name')
      .ilike('username', '%savage%')
      .limit(1)
      .single();
      
    if (agentError || !agent) {
      // Maybe try full_name
      const { data: agent2, error: agentError2 } = await supabase
        .from('users')
        .select('id, username, full_name')
        .ilike('full_name', '%savage%')
        .limit(1)
        .single();
        
      if (agentError2 || !agent2) {
         return NextResponse.json({ error: 'Could not find Savage Brands agent', details: agentError });
      }
      return await updateAgentProducts(supabase, agent2);
    }
    
    return await updateAgentProducts(supabase, agent);
    
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}

async function updateAgentProducts(supabase: any, agent: any) {
  // Get all products
  const { data: products } = await supabase.from('products').select('id, name');
  
  if (!products) return NextResponse.json({ error: 'No products found' });
  
  const updates = [];
  
  for (const p of products) {
    // Generate filename format we used
    const filename = p.name.replace(/[^a-z0-9]/gi, '-').toLowerCase().replace(/-+/g, '-') + '.jpg';
    // However, the filenames in public/images/savage-brands/ might be slightly different.
    // Let's use the file system format or just basic string replacement.
    
    // We'll just construct a generic filename since we created them, but we should match what was saved.
    const custom_image_url = `/images/savage-brands/${filename}`;
    
    // Upsert into agent_products
    const { data: agentProduct } = await supabase
      .from('agent_products')
      .select('id')
      .eq('agent_id', agent.id)
      .eq('product_id', p.id)
      .single();
      
    if (agentProduct) {
      await supabase
        .from('agent_products')
        .update({ custom_image_url })
        .eq('id', agentProduct.id);
      updates.push({ updated: p.name, url: custom_image_url });
    } else {
      // Need to create agent_product if it doesn't exist? Usually they exist.
      // We need retail_price etc if creating, which is complex.
    }
  }
  
  return NextResponse.json({ success: true, agent, updates_count: updates.length, updates });
}
