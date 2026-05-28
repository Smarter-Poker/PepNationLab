import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

// GET: Fetch the agent's current inventory levels for all active products
export async function GET(req: NextRequest) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const agentId = gate.user.id;

    // Fetch all active products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, sku, category')
      .eq('is_active', true);

    if (productsError) {
      return NextResponse.json({ error: productsError.message }, { status: 500 });
    }

    // Fetch the agent's inventory
    const { data: inventory, error: inventoryError } = await supabase
      .from('agent_inventory')
      .select('product_id, stock_count')
      .eq('agent_id', agentId);

    if (inventoryError) {
      return NextResponse.json({ error: inventoryError.message }, { status: 500 });
    }

    const inventoryMap = new Map(inventory?.map(i => [i.product_id, i.stock_count]) || []);

    const result = products.map(p => ({
      ...p,
      stock_count: inventoryMap.get(p.id) || 0
    }));

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Agent Inventory API GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Update inventory count for a specific product
export async function POST(req: NextRequest) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const agentId = gate.user.id;
    const { productId, stockCount } = await req.json();

    if (!productId || typeof stockCount !== 'number' || Number.isNaN(stockCount)) {
      return NextResponse.json({ error: 'Product ID and stockCount required' }, { status: 400 });
    }

    // Reject negative inventory — the agent cannot have less than zero stock,
    // and negative values would corrupt downstream pricing/availability logic.
    if (stockCount < 0) {
      return NextResponse.json({ error: 'Stock Count Cannot Be Negative' }, { status: 400 });
    }

    // Upsert the inventory count
    const { error } = await supabase
      .from('agent_inventory')
      .upsert({
        agent_id: agentId,
        product_id: productId,
        stock_count: stockCount,
        updated_at: new Date().toISOString()
      }, { onConflict: 'agent_id, product_id' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Agent Inventory API POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
