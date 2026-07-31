import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function insertTestProducts() {
  const products = [
    {
      id: 'a0000000-0000-0000-0000-000000000003',
      name: 'Epithalon 10mg (Test Print 3)',
      slug: 'test-epithalon-3',
      category: 'Test Prints',
      unit_size: '10',
      unit_measure: 'mg',
      is_active: false,
      is_banned: true, // Hide completely from public store
      description: 'Test Print Label',
      base_cost: 0,
      image_url: '',
      sku: 'TEST-EPI-3',
      in_stock: false,
      inventory_count: 0,
      min_retail_price: 0,
      max_retail_price: 0
    },
    {
      id: 'a0000000-0000-0000-0000-000000000004',
      name: 'Epithalon 10mg (Test Print 4)',
      slug: 'test-epithalon-4',
      category: 'Test Prints',
      unit_size: '10',
      unit_measure: 'mg',
      is_active: false,
      is_banned: true,
      description: 'Test Print Label',
      base_cost: 0,
      image_url: '',
      sku: 'TEST-EPI-4',
      in_stock: false,
      inventory_count: 0,
      min_retail_price: 0,
      max_retail_price: 0
    }
  ];

  const { data, error } = await supabase.from('products').upsert(products);
  if (error) {
    console.error('Error inserting test products:', error);
  } else {
    console.log('Successfully inserted test products:', data);
  }
}

insertTestProducts();
