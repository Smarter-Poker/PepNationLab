import type { Metadata } from 'next';
import { getAllCompounds } from '@/lib/compounds-server';
import { getAreaProducts } from '@/lib/area-products-server';
import StacksClient from '@/components/research/StacksClient';

export const metadata: Metadata = {
  title: 'Stacks & Combinations',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function StacksPage() {
  const compounds = await getAllCompounds();
  const stacks = compounds.filter((c) => c.is_stack);
  const products = await getAreaProducts();

  return <StacksClient compounds={compounds} stacks={stacks} products={products} />;
}
