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

  const { data: allProducts, error: prodError } = await supabase
    .from('products')
    .select('id, name, category, unit_size, unit_measure, image_url')
    .order('name');

  const { data: agentProducts, error: agentError } = await supabase
    .from('agent_products')
    .select(`
      product_id,
      custom_image_url
    `)
    .eq('agent_id', agent?.id);

  if (prodError || agentError) {
    console.error('Supabase error fetching products:', prodError || agentError);
  }

  const savageOverrides = new Map(
    (agentProducts || []).map((ap: any) => [ap.product_id, ap.custom_image_url])
  );

  const products = (allProducts || []).map((p: any) => {
    return {
      ...p,
      image: savageOverrides.get(p.id) || p.image_url || ''
    };
  });

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      <div className="flex-none bg-background border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Savage Brands Labels</h1>
          <p className="text-muted-foreground">
            Print-ready templates for 1.5" x 2.5" vials (300dpi).
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <LabelGenerator products={products || []} />
      </div>
    </div>
  );
}
