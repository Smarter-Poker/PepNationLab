import { permanentRedirect } from 'next/navigation';

// Product browsing happens on the Research Library catalog.
// /products is a legacy path; send visitors to the catalog.
// permanentRedirect issues a 308 so search engines consolidate
// any /products equity onto /research/catalog instead of treating
// the move as temporary (307).
export default function ProductsPage() {
  permanentRedirect('/research/catalog');
}
