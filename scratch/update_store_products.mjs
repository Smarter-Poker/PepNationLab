import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ydsaqnnuwyvtyxgvrnys.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3OTM5MiwiZXhwIjoyMDk0OTU1MzkyfQ.M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI',
  { auth: { persistSession: false } }
);

async function main() {
  console.log('--- FETCHING PRODUCTS FROM DATABASE ---');
  const { data: products, error } = await sb
    .from('products')
    .select('id, name, image_url, backorder_days');

  if (error) {
    console.error('Error fetching products:', error);
    return;
  }

  console.log(`Fetched ${products.length} products.`);

  for (const product of products) {
    let newName = product.name;
    let newImageUrl = product.image_url;
    let newBackorderDays = product.backorder_days;
    let needsUpdate = false;

    // 1. Remove "The " from names
    if (newName.startsWith('The ')) {
      newName = newName.substring(4);
      needsUpdate = true;
    }
    // Also check case-insensitive just in case
    else if (newName.toLowerCase().startsWith('the ')) {
      newName = newName.substring(4);
      needsUpdate = true;
    }

    // 2. Prepend "Stack " to "KLOW"
    if (newName.includes('KLOW') && !newName.startsWith('Stack ')) {
      newName = 'Stack ' + newName;
      needsUpdate = true;
    }

    // 3. Map new images for Wolverine Stack, Shred Stack, and Limitless Stack
    const lowerName = newName.toLowerCase();
    if (lowerName.includes('wolverine')) {
      newImageUrl = '/images/products/wolverine-stack.png';
      needsUpdate = true;
    } else if (lowerName.includes('shred')) {
      newImageUrl = '/images/products/shred-stack.png';
      needsUpdate = true;
    } else if (lowerName.includes('limitless')) {
      newImageUrl = '/images/products/limitless-stack.png';
      needsUpdate = true;
    }

    // 4. Remove backorder badges (set backorder_days = 0)
    // The user specifically requested: "REMOVE THE BACKORDER BADGES AS WELL."
    // Let's set backorder_days to 0 for the Shred and Limitless stacks (or generally all)
    if (lowerName.includes('shred') || lowerName.includes('limitless')) {
      if (newBackorderDays !== 0) {
        newBackorderDays = 0;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      console.log(`Updating "${product.name}":`);
      console.log(`  -> Name: "${newName}"`);
      console.log(`  -> Image: "${newImageUrl}"`);
      console.log(`  -> Backorder days: ${newBackorderDays}`);

      const { error: updateError } = await sb
        .from('products')
        .update({
          name: newName,
          image_url: newImageUrl,
          backorder_days: newBackorderDays,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id);

      if (updateError) {
        console.error(`  ❌ Error updating product ${product.id}:`, updateError);
      } else {
        console.log(`  ✅ Successfully updated.`);
      }
    }
  }

  console.log('--- PRODUCT UPDATES COMPLETED ---');
}

main().catch(console.error);
