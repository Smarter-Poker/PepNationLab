import { redirect } from 'next/navigation';

// Product browsing happens on the Research Library catalog.
// /products is a legacy path; send visitors to the catalog.
export default function ProductsPage() {
  redirect('/research/catalog');
}
