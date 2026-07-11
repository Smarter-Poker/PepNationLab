'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
}

interface Props {
  agentId: string;
  initialFeaturedIds: string[];
  onUpdate: (newIds: string[]) => void;
}

export default function FeaturedProductsSelector({ agentId, initialFeaturedIds, onUpdate }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialFeaturedIds || []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (!error && data) {
        setProducts(data);
      }
      setLoading(false);
    };
    fetchProducts();
  }, []);

  const toggleProduct = (id: string) => {
    let newSelection = [...selectedIds];
    if (newSelection.includes(id)) {
      newSelection = newSelection.filter(x => x !== id);
    } else {
      if (newSelection.length >= 4) {
        toast.error('You can only feature up to 4 products.');
        return;
      }
      newSelection.push(id);
    }
    setSelectedIds(newSelection);
    onUpdate(newSelection);
  };

  if (loading) return <div className="text-sm text-zinc-400">Loading products...</div>;

  return (
    <div className="space-y-4">
      <div className="text-sm text-zinc-400">
        Select up to 4 products to feature at the top of your storefront.
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
        {products.map(p => (
          <label 
            key={p.id} 
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
              ${selectedIds.includes(p.id) ? 'bg-teal-900/20 border-teal-500/50' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}
            `}
          >
            <input 
              type="checkbox" 
              checked={selectedIds.includes(p.id)}
              onChange={() => toggleProduct(p.id)}
              className="w-4 h-4 rounded border-zinc-700 text-teal-500 focus:ring-teal-500 bg-zinc-900"
            />
            <span className="text-sm font-medium text-zinc-200 line-clamp-1">{p.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
