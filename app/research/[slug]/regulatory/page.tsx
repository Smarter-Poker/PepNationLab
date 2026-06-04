/**
 * Per-compound regulatory dashboard. Shows FDA / EMA / Health Canada / TGA /
 * PMDA cards + DEA schedule + WADA chip + compound_recall_alerts rows.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCompound } from '@/lib/compounds-server';
import { wadaLabel } from '@/lib/compounds';
import IframeLink from '@/components/ui/IframeLink';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const compound = await getCompound(slug);
  const name = compound?.display_name ?? 'Compound';
  return {
    title: `Regulatory Dashboard For ${name} | Research Library | Pep Nation Lab`,
    robots: { index: false, follow: false },
  };
}

export const dynamic = 'force-dynamic';

interface RecallRow {
  id: string;
  compound_slug: string;
  alert_type: string | null;
  agency: string | null;
  alert_date: string | null;
  description: string | null;
  url: string | null;
}

interface RegRow {
  fda_approval_year: number | null;
  ema_approval_year: number | null;
  dea_schedule: string | null;
  dailymed_setid: string | null;
  faers_event_count: number | null;
}

interface RegCardProps {
  agency: string;
  status: string;
  detail?: string;
  url?: string;
  isPending?: boolean;
}

function RegCard({ agency, status, detail, url, isPending }: RegCardProps) {
  return (
    <article className="glass-panel" style={{ padding: 'var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--silver, #A8B4C0)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>{agency}</span>
      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: isPending ? 'var(--silver, #A8B4C0)' : 'var(--white, #FFFFFF)' }}>{status}</span>
      {detail && <span style={{ fontSize: '0.82rem', color: 'var(--silver-light, #D0DAE4)' }}>{detail}</span>}
      {url && (
        <IframeLink href={url} style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.78rem', textDecoration: 'none', marginTop: 4 }}>
          View Source
        </IframeLink>
      )}
    </article>
  );
}

export default async function CompoundRegulatoryPage({ params }: PageProps) {
  const { slug } = await params;
  const compound = await getCompound(slug);
  if (!compound) notFound();

  const supabase = await createClient();
  const reg = (compound ?? {}) as unknown as RegRow;

  const { data: recallsData } = await supabase
    .from('compound_recall_alerts')
    .select('id, compound_slug, alert_type, agency, alert_date, description, url')
    .eq('compound_slug', slug)
    .in('alert_type', ['recall', 'black_box', 'safety_signal'])
    .order('alert_date', { ascending: false });

  const recalls = (recallsData ?? []) as RecallRow[];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href={`/research/${slug}`} style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To {compound.display_name} Monograph
        </Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          Regulatory Dashboard For {compound.display_name}
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Cross-Agency Approval, Scheduling, And Safety Signal Status. Sourced From FDA Drugs@FDA, EMA EPAR, And Agency Public Records.
        </p>
      </header>

      <section style={{ marginBottom: 'var(--space-6, 32px)' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--teal, #00C4BC)', marginBottom: 'var(--space-3, 12px)' }}>
          Approval Status By Agency
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3, 12px)' }}>
          <RegCard
            agency="FDA (United States)"
            status={reg.fda_approval_year ? `Approved ${reg.fda_approval_year}` : 'Not Approved'}
            detail={reg.dailymed_setid ? 'DailyMed Label Indexed' : undefined}
            url={reg.dailymed_setid ? `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${encodeURIComponent(reg.dailymed_setid)}` : undefined}
          />
          <RegCard
            agency="EMA (European Union)"
            status={reg.ema_approval_year ? `Approved ${reg.ema_approval_year}` : 'Not Approved'}
          />
          <RegCard agency="Health Canada" status="Status Pending Sync" isPending />
          <RegCard agency="TGA (Australia)" status="Status Pending Sync" isPending />
          <RegCard agency="PMDA (Japan)" status="Status Pending Sync" isPending />
          <RegCard
            agency="DEA Schedule (US)"
            status={reg.dea_schedule ?? 'Not Scheduled'}
          />
          <RegCard
            agency="WADA"
            status={wadaLabel(compound.wada_status)}
            detail={compound.wada_status && compound.wada_status !== 'not_listed' ? 'See Bibliography For Prohibition History' : undefined}
          />
          <RegCard
            agency="FDA FAERS"
            status={reg.faers_event_count !== null ? `${reg.faers_event_count} Adverse Events Recorded` : 'Pending Sync'}
            isPending={reg.faers_event_count === null}
          />
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--teal, #00C4BC)', marginBottom: 'var(--space-3, 12px)' }}>
          Recall And Safety Signal Feed
        </h2>
        {recalls.length === 0 ? (
          <div className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
            No Recalls Or Black-Box Warnings Currently Indexed.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
            {recalls.map((r) => (
              <article key={r.id} className="glass-panel" style={{ padding: 'var(--space-4, 16px) var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', borderLeft: '3px solid var(--red-600, #E53E3E)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2, 8px)' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--red-600, #E53E3E)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                      {r.alert_type ?? 'Safety'}
                    </span>
                    {r.agency && (
                      <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--silver, #A8B4C0)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {r.agency}
                      </span>
                    )}
                  </div>
                  {r.alert_date && (
                    <span style={{ fontSize: '0.82rem', color: 'var(--silver, #A8B4C0)' }}>{r.alert_date}</span>
                  )}
                </div>
                {r.description && (
                  <p style={{ marginTop: 'var(--space-2, 8px)', marginBottom: 0, fontSize: '0.9rem', color: 'var(--silver-light, #D0DAE4)', lineHeight: 1.6 }}>
                    {r.description}
                  </p>
                )}
                {r.url && (
                  <div style={{ marginTop: 'var(--space-2, 8px)' }}>
                    <IframeLink href={r.url} style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.82rem', textDecoration: 'none' }}>
                      View Original Alert
                    </IframeLink>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <p style={{ marginTop: 'var(--space-6, 32px)', fontSize: '0.78rem', color: 'var(--silver, #A8B4C0)', fontStyle: 'italic' }}>
        Research Use Only. Cross-Agency Status Is Indicative, Not Authoritative. Confirm Current Status Directly With Each Agency Before Use.
      </p>
    </div>
  );
}
