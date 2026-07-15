import { createClient } from '@/lib/supabase/server';
import { LabelGenerator } from './LabelGenerator';

export const metadata = {
  title: 'Savage Brands Label Generator | PepNationLab Admin',
};

export default async function SavageLabelsPage() {
  const supabase = await createClient();
  const { data: agent } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', '%savage%')
    .single();

  // Fetch all products (for Pep Nation view)
  const { data: allProducts, error: prodError } = await supabase
    .from('products')
    .select('id, name, slug, category, unit_size, unit_measure, image_url')
    .order('name');

  // Fetch Savage Brands custom products
  const { data: agentProducts, error: agentError } = await supabase
    .from('agent_products')
    .select(`
      custom_image_url,
      product:product_id (
        id, name, slug, category, unit_size, unit_measure, image_url
      )
    `)
    .eq('agent_id', 'a8c7db76-58bf-49f9-aa09-1cdb71dbce19');

  if (prodError || agentError) {
    console.error('Error fetching products:', prodError || agentError);
    return <div>Error loading labels.</div>;
  }

  // Use agentProducts for Savage, or fallback to all products
  // We will pass allProducts to LabelGenerator to let it handle both.
  const mappedSavage = agentProducts?.map((ap: any) => ({
    ...ap.product,
    image: ap.custom_image_url || ap.product.image_url
  })) || [];

  const mappedAll = allProducts?.map((p: any) => ({
    ...p,
    image: p.image_url
  })) || [];

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Printable Labels</h1>
            <p className="text-muted-foreground">
              Generate 300dpi labels for Pep Nation and Savage Brands.
            </p>
          </div>
          
          <LabelGenerator savageProducts={mappedSavage} pepProducts={mappedAll} />
        </div>
      </div>
    </div>
  );
}
