import { redirect } from 'next/navigation';

/**
 * /lab-tools — permanent redirect to the full CalculatorSuite.
 * This route was previously used; keeping it live prevents 404s
 * for any bookmarks or external links.
 */
export default function LabToolsRedirectPage() {
  redirect('/research/calculators');
}

export const metadata = {
  title: 'Lab Tools | Pep Nation Lab',
  robots: { index: false, follow: false },
};
