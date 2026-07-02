import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

export async function GET(req: Request) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const agentId = gate.user.id;
    const supabase = await createServiceClient();

    // 1. Fetch current agent inventory
    const { data: inventory, error: invError } = await supabase
      .from('agent_inventory')
      .select('product_id, stock_count, products(id, name, is_active, admin_bulk_price, admin_bulk_threshold)')
      .eq('agent_id', agentId);

    if (invError) {
      return NextResponse.json({ error: 'Failed to load inventory' }, { status: 500 });
    }

    // 2. Fetch past 30 days of sales for this agent
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // We only care about orders that were actually approved/fulfilled
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, created_at, status')
      .eq('agent_id', agentId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .in('status', ['approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered']);

    if (ordersError) {
      return NextResponse.json({ error: 'Failed to load historical orders' }, { status: 500 });
    }

    const orderIds = orders.map(o => o.id);
    let orderItems: { product_id: string; quantity: number }[] = [];

    if (orderIds.length > 0) {
      const { data: items } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .in('order_id', orderIds);
      if (items) orderItems = items;
    }

    // 3. Calculate Run Rates and Reorder Logic
    const LEAD_TIME_DAYS = 15; // Shipping from China
    const SAFETY_STOCK_DAYS = 5; // Buffer

    const productSales: Record<string, number> = {};
    orderItems.forEach(item => {
      if (item.product_id) {
        productSales[item.product_id] = (productSales[item.product_id] || 0) + Number(item.quantity);
      }
    });

    const smartAlerts = [];
    const suggestedCart = [];

    for (const inv of inventory || []) {
      const product = Array.isArray(inv.products) ? inv.products[0] : inv.products;
      if (!product || !product.is_active) continue;

      const totalSold30Days = productSales[inv.product_id] || 0;
      const dailyRunRate = totalSold30Days / 30;

      // Only calculate reorders if they actually sell this product
      if (dailyRunRate > 0) {
        const leadTimeDemand = Math.ceil(dailyRunRate * LEAD_TIME_DAYS);
        const safetyStock = Math.ceil(dailyRunRate * SAFETY_STOCK_DAYS);
        const reorderPoint = leadTimeDemand + safetyStock;

        if (inv.stock_count <= reorderPoint) {
          // Suggest enough to cover the next 30 days (minus what they currently have)
          const targetStock = Math.ceil(dailyRunRate * 30) + safetyStock;
          let suggestQty = targetStock - inv.stock_count;
          
          if (suggestQty < 0) suggestQty = 0;

          // If they are close to the bulk threshold, bump it up to hit bulk tier
          if (product.admin_bulk_threshold && product.admin_bulk_price) {
            if (suggestQty >= (product.admin_bulk_threshold * 0.8) && suggestQty < product.admin_bulk_threshold) {
              suggestQty = product.admin_bulk_threshold;
            }
          }

          if (suggestQty > 0) {
            smartAlerts.push({
              product_id: inv.product_id,
              name: product.name,
              current_stock: inv.stock_count,
              reorder_point: reorderPoint,
              daily_run_rate: dailyRunRate.toFixed(2),
              message: `Low Stock! Selling ${dailyRunRate.toFixed(1)}/day. 15-day shipping transit requires reorder soon.`
            });

            suggestedCart.push({
              id: inv.product_id,
              name: product.name,
              quantity: suggestQty
            });
          }
        }
      } else if (inv.stock_count <= 5) {
        // Fallback for low stock but no recent sales (maybe they are a new agent)
        smartAlerts.push({
          product_id: inv.product_id,
          name: product.name,
          current_stock: inv.stock_count,
          reorder_point: 5,
          daily_run_rate: "0.00",
          message: `Low Stock! You only have ${inv.stock_count} units left. Consider restocking.`
        });
        suggestedCart.push({
          id: inv.product_id,
          name: product.name,
          quantity: 10 // default fallback
        });
      }
    }

    return NextResponse.json({
      alerts: smartAlerts,
      suggestedCart: suggestedCart
    });

  } catch (error) {
    console.error('Reorder Logic Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
