import type { Metadata } from 'next';

// A11y: unique document title for the signup route (WCAG 2.4.2).
// Second-layer indexing protection: robots.txt already disallows this route,
// but a crawlable noindex is required so the bare URL cannot surface as
// "Indexed, though blocked by robots.txt".
export const metadata: Metadata = {
  title: 'Create Researcher Account | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
