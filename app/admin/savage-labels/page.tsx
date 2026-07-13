import { createClient } from '@/utils/supabase/server';
import { LabelGenerator } from './LabelGenerator';

export const metadata = {
  title: 'Savage Brands Label Generator | PepNationLab Admin',
};

export default async function SavageLabelsPage() {
  const supabase = createClient();
  const { data: products } = await supabase
    .from('products')
    .select('id, name, dose_amount, dose_unit, category_id, categories(name)')
    .order('name', { ascending: true });

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
