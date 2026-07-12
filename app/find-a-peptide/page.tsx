import { permanentRedirect } from 'next/navigation';

/**
 * /find-a-peptide is merged into /research/match.
 * 308 Permanent Redirect — preserves SEO equity.
 */
export default function FindAPeptideRedirectPage() {
  permanentRedirect('/research/match');
}
