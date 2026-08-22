import { redirect } from 'next/navigation';

/**
 * /shelf-life is deprecated. Shelf Life Tracker is now part of
 * /research/calculators#shelf-life.
 */
export default function ShelfLifeRedirectPage() {
  redirect('/research/calculators#shelf-life');
}
