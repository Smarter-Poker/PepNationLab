import type { Metadata } from 'next';

// Second-layer indexing protection: robots.txt already disallows this route,
// but a crawlable noindex is required so the bare URL cannot surface as
// "Indexed, though blocked by robots.txt".
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
