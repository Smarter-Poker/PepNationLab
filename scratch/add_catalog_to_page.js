const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'account', 'lab-journal', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('let catalog: any[] = [];')) {
  const catalogFetch = `
  // --- Catalog for Stack Builder ---
  let catalog: any[] = [];
  try {
    const { data: cData } = await service
      .from('products')
      .select('id, name, image_url, category, base_cost, unit_size, unit_measure, in_stock')
      .neq('category', 'Peptide Stacks')
      .eq('is_active', true)
      .eq('is_banned', false)
      .order('name');
      
    if (cData) {
      catalog = cData.map((p: any) => ({
        product_id: p.id,
        name: p.name,
        image_url: p.image_url,
        category: p.category,
        base_cost: p.base_cost,
        retail_price: null,
        in_stock: p.in_stock,
        unit_size: p.unit_size,
        unit_measure: p.unit_measure,
      }));
    }
  } catch {}
`;

  content = content.replace('return (', catalogFetch + '\n  return (');
  
  content = content.replace('bundles={bundles}', 'bundles={bundles}\n          catalog={catalog}');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Added catalog fetch to page.tsx');
} else {
  console.log('Already added.');
}
