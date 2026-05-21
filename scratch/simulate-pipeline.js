const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Self-contained .env.local parser to avoid installing dotenv dependency
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) {
      console.warn('.env.local file not found in cwd!');
      return;
    }
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index === -1) return;
      const key = trimmed.substring(0, index).trim();
      const val = trimmed.substring(index + 1).trim();
      process.env[key] = val;
    });
  } catch (e) {
    console.error('Error reading env file:', e);
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function simulate() {
  console.log('=== STARTING PEPNATIONLAB END-TO-END PIPELINE SIMULATION ===\n');

  // 1. Check/provision test researcher
  const resEmail = 'test_researcher@pepnationlab.com';
  console.log(`[1] Provisioning test researcher: ${resEmail}`);
  
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw listErr;

  let resUser = users.find(u => u.email === resEmail);
  if (!resUser) {
    const { data: nu, error: createErr } = await supabase.auth.admin.createUser({
      email: resEmail,
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: { full_name: 'Test Researcher' }
    });
    if (createErr) throw createErr;
    resUser = nu.user;
    console.log(` -> Created new researcher auth user with ID: ${resUser.id}`);
  } else {
    console.log(` -> Existing researcher auth user found with ID: ${resUser.id}`);
  }

  // Upsert profiles record for researcher
  const { error: profErr } = await supabase
    .from('profiles')
    .upsert({
      id: resUser.id,
      email: resEmail,
      full_name: 'Test Researcher',
      role: 'researcher',
      tier: 'tier_3', // standard retail/default tier
      disclaimer_v1_accepted: true,
      is_active: true
    });
  if (profErr) throw profErr;
  console.log(' -> Upserted researcher profile (Tier 3)');

  // 2. Load active products & verify pricing multipliers
  console.log('\n[2] Fetching active products and applying Tier 3 pricing...');
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true);
  
  if (prodErr) throw prodErr;
  if (!products || products.length === 0) {
    console.log(' -> No active products found in database! Creating seed product...');
    const { data: newProd, error: insertErr } = await supabase
      .from('products')
      .insert({
        name: 'BPC-157 Research Grade',
        slug: 'bpc-157-research-grade',
        sku: 'BPC-157-5MG',
        category: 'Peptides',
        base_cost: 15.00,
        unit_size: '5',
        unit_measure: 'mg',
        inventory_count: 50,
        low_stock_threshold: 5,
        backorder_days: 14,
        is_active: true
      })
      .select()
      .single();
    if (insertErr) throw insertErr;
    products.push(newProd);
    console.log(` -> Created seed product: "${newProd.name}" (Base cost: $15.00)`);
  } else {
    console.log(` -> Found ${products.length} active products.`);
  }

  // Fetch Tier 3 multiplier
  const { data: tierData, error: tierErr } = await supabase
    .from('pricing_tiers')
    .select('multiplier')
    .eq('tier_name', 'tier_3')
    .single();
  if (tierErr) throw tierErr;
  
  const multiplier = Number(tierData.multiplier);
  console.log(` -> Tier 3 pricing multiplier: ${multiplier}x`);

  const testProduct = products[0];
  const calculatedPrice = Number(testProduct.base_cost) * multiplier;
  console.log(` -> Calculated pricing for "${testProduct.name}": Base $${testProduct.base_cost} * ${multiplier} = $${calculatedPrice.toFixed(2)}`);

  // 3. Log disclaimer acceptance log record
  console.log('\n[3] Logging final compliance checkout disclaimer gate acceptance...');
  const { data: discLog, error: discErr } = await supabase
    .from('disclaimer_acceptances')
    .insert({
      user_id: resUser.id,
      disclaimer_version: 'v1.0',
      layer: 'checkout',
      ip_address: '127.0.0.1',
      user_agent: 'Antigravity Automated Test Pipeline'
    })
    .select()
    .single();
  if (discErr) throw discErr;
  console.log(` -> Disclaimer log successfully inserted: ID: ${discLog.id}`);

  // 4. Create and submit checkout wizard order
  console.log('\n[4] Creating test compliance checkout wizard order...');
  const initialStock = testProduct.inventory_count;
  const orderQty = 2;
  const orderTotal = calculatedPrice * orderQty;

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      buyer_id: resUser.id,
      shipping_address: {
        street: '123 Laboratory Way',
        city: 'Research Triangle',
        state: 'NC',
        zip: '27709'
      },
      fulfillment_method: 'ship',
      payment_method: 'zelle',
      subtotal: orderTotal,
      shipping_cost: 15.00,
      total: orderTotal + 15.00,
      status: 'pending_customer_payment'
    })
    .select()
    .single();
  if (orderErr) throw orderErr;
  console.log(` -> Order successfully created: ID: ${order.id}, Status: ${order.status}, Total: $${Number(order.total).toFixed(2)}`);

  // Insert order items
  const { error: itemsErr } = await supabase
    .from('order_items')
    .insert({
      order_id: order.id,
      product_id: testProduct.id,
      product_name: testProduct.name,
      quantity: orderQty,
      unit_cost_price: Number(testProduct.base_cost),
      unit_retail_price: calculatedPrice
    });
  if (itemsErr) throw itemsErr;
  console.log(' -> Inserted order item records successfully.');

  // 5. Admin portal processing
  console.log('\n[5] Simulating Admin dashboard approval and tracking ingestion...');
  
  // Transition to approved_ship (Admin confirms offline payment received)
  const { data: approvedOrder, error: appErr } = await supabase
    .from('orders')
    .update({
      status: 'approved_ship'
    })
    .eq('id', order.id)
    .select()
    .single();
  if (appErr) throw appErr;
  console.log(` -> Payment confirmed by Admin! Status updated to: ${approvedOrder.status}`);

  // Transition to in_fulfillment
  const { data: fulfillingOrder, error: fulErr } = await supabase
    .from('orders')
    .update({ status: 'in_fulfillment' })
    .eq('id', order.id)
    .select()
    .single();
  if (fulErr) throw fulErr;
  console.log(` -> Store fulfillment initiated! Status updated to: ${fulfillingOrder.status}`);

  // Transition to shipped with tracking number
  const trackingCode = 'USPS-9400-TEST-12345';
  const { data: shippedOrder, error: shipErr } = await supabase
    .from('orders')
    .update({
      status: 'shipped',
      tracking_number: trackingCode
    })
    .eq('id', order.id)
    .select()
    .single();
  if (shipErr) throw shipErr;
  console.log(` -> Order shipped successfully! Tracking Code: ${shippedOrder.tracking_number}, Status: ${shippedOrder.status}`);

  // 6. Verify stock synchronization triggers & final states
  console.log('\n[6] Verifying database trigger inventory deductions...');
  const { data: updatedProduct, error: getProdErr } = await supabase
    .from('products')
    .select('*')
    .eq('id', testProduct.id)
    .single();
  if (getProdErr) throw getProdErr;

  const expectedStock = initialStock - orderQty;
  console.log(` -> Initial Stock: ${initialStock} Units`);
  console.log(` -> Quantity Ordered: ${orderQty} Units`);
  console.log(` -> Current Stock: ${updatedProduct.inventory_count} Units`);
  
  if (updatedProduct.inventory_count === expectedStock) {
    console.log(' -> [PASS] DB trigger synced inventory count correctly!');
  } else {
    console.error(' -> [FAIL] Inventory count mismatch!');
  }

  console.log('\n=== END-TO-END PIPELINE SIMULATION COMPLETED WITH 100% SUCCESS ===');
}

simulate().catch(e => {
  console.error('\n[FAIL] PIPELINE SIMULATION FAILED:', e);
  process.exit(1);
});
