import { redirect } from 'next/navigation';

// This legacy wholesale ordering page has been retired.
// All product browsing now happens on agent storefronts (e.g. /savagebrands).
export default function ProductsPage() {
  redirect('/');
}
