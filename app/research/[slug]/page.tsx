/**
 * Compound monograph — the full Research-Use-Only detail page for one compound.
 * Server component: fetches the compound by slug, then hands off to the client
 * MonographTabs component, which presents the data in tabbed, short-paragraph
 * sections (Overview, Mechanism, Studied For, Handling, Safety, Sources) with a
 * sticky Back control. No human dosing — research use only.
 */
import { notFound } from 'next/navigation';
import { getCompound } from '@/lib/compounds-server';
import MonographTabs from '@/components/research/MonographTabs';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const compound = await getCompound(slug);
  const name = compound?.display_name ?? 'Compound';
  return {
    title: `${name} | Research | Pep Nation Lab`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const compound = await getCompound(slug);
  if (!compound) notFound();

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)' }}>
      <MonographTabs compound={compound} />
    </div>
  );
}
