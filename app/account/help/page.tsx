import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import HelpSupportClient from '@/components/account/HelpSupportClient';
import { FAQ_CATEGORIES } from '@/lib/help-faq';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ cat?: string }>;
}

// /account/help
// Help & Support: FAQ plus a Contact Support action that opens the user's live
// support thread with admin via the shared messenger channel
// (POST /api/messenger/support/open), which the admin Customer Support inbox monitors.
//
// R28: supports `?cat=<category-id>` so the page auto-scrolls to a category
// section on mount, and generates per-category `<title>` so link previews
// in messenger / SMS / email reflect the deep-linked category. The page
// stays noindex — these links are for internal sharing and authenticated
// users, not crawl.
export default async function AccountHelpPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const params = await searchParams;
  const rawCat = typeof params?.cat === 'string' ? params.cat.trim() : '';
  // Only honour the searchParam if it points to a real, visible category
  // for this viewer's role tier — silently ignore unknown / role-gated ids.
  const initialCategory =
    rawCat && FAQ_CATEGORIES.some((c) => c.id === rawCat) ? rawCat : null;

  return (
    <HelpSupportClient
      role={profile?.role ?? null}
      initialCategory={initialCategory}
    />
  );
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const rawCat = typeof params?.cat === 'string' ? params.cat.trim() : '';
  const cat = FAQ_CATEGORIES.find((c) => c.id === rawCat);

  const title = cat
    ? `${cat.label} | Help & Support | Pep Nation Lab`
    : 'Help & Support | Pep Nation Lab';

  const description = cat
    ? `${cat.label} answers from the Pep Nation Lab Help Center — verified responses from the support team.`
    : 'Search verified answers and open a live chat with the Pep Nation Lab support team.';

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
    },
  };
}
