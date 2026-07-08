import type { Metadata } from 'next';

// The shipping page is an internal fulfillment tool (packing slips, label
// purchase) - it must never appear in search results. The page itself is a
// client component and cannot export metadata, so the noindex lives here.
export const metadata: Metadata = {
  title: 'Shipping | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default function ShippingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
