/**
 * Technical Data Sheet - print-friendly spec sheet for one compound.
 * Server component: fetches the compound and renders all identity, handling,
 * regulatory, evidence, and source fields in a clean, printable layout, plus a
 * QR code that links to the public compound profile (for vial labels).
 * Research-Use-Only footer. No human dosing.
 *
 * Title Case is applied to every value cell (except Sources URLs). Storage
 * temperatures render in Fahrenheit. Premium thick brushed-nickel frame.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCompound } from '@/lib/compounds-server';
import { evidenceTier, wadaLabel } from '@/lib/compounds';
import { generateQrDataUrl } from '@/lib/qr';
import PrintButton from '@/components/research/PrintButton';
import IframeLink from '@/components/ui/IframeLink';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const compound = await getCompound(slug);
  const name = compound?.display_name ?? 'Compound';
  return {
    title: `${name} Spec Sheet | Research | Pep Nation Lab`,
    robots: { index: false, follow: false },
  };
}

// Convert Celsius temperatures embedded in free text to Fahrenheit.
// Ranges first ("2-8C" -> "36-46°F"), then single values ("-20C" -> "-4°F").
function toFahrenheit(value?: string | null): string | null {
  if (!value) return value ?? null;
  let out = value.replace(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)\s*°?\s*C\b/gi, (_m, a, b) => {
    const fa = Math.round(Number(a) * 9 / 5 + 32);
    const fb = Math.round(Number(b) * 9 / 5 + 32);
    return `${fa}-${fb}°F`;
  });
  out = out.replace(/(-?\d+(?:\.\d+)?)\s*°?\s*C\b/gi, (_m, a) => {
    const f = Math.round(Number(a) * 9 / 5 + 32);
    return `${f}°F`;
  });
  return out;
}

function Row({ label, value, cap = true }: { label: string; value: React.ReactNode; cap?: boolean }) {
  if (value == null || value === '') return null;
  return (
    <tr>
      <th
        style={{
          textAlign: 'left',
          verticalAlign: 'top',
          padding: '8px 12px',
          width: '34%',
          color: 'var(--silver)',
          fontWeight: 700,
          fontSize: '0.82rem',
          }}
      >
        {label}
      </th>
      <td
        style={{
          padding: '8px 12px',
          color: 'var(--white)',
          fontSize: '0.9rem',
          textTransform: cap ? 'capitalize' : undefined,
        }}
      >
        {value}
      </td>
    </tr>
  );
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const compound = await getCompound(slug);
  if (!compound) notFound();

  const id = compound.identity ?? {};
  const h = compound.handling ?? {};
  const tier = evidenceTier(compound.evidence_tier);

  const profileUrl = `https://pepnationlab.com/research/${compound.slug}`;
  let qr: string | null = null;
  try {
    qr = await generateQrDataUrl(profileUrl);
  } catch {
    qr = null;
  }

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      <div
        data-print-hide="true"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}
      >
        <PrintButton />
        <Link
          href={`/research/${compound.slug}`}
          className="btn-ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back To Monograph
        </Link>
      </div>

      {/* Premium thick brushed-nickel frame */}
      <section
        style={{
          borderRadius: 24,
          padding: 'var(--space-6)',
          background: 'linear-gradient(180deg, #131b24 0%, #0a0f14 100%)',
          boxShadow:
            '0 0 0 2px #5d6166, 0 0 0 4px #b9bdc2, 0 0 0 6px #6c7075, inset 0 1px 0 rgba(255,255,255,0.10), 0 30px 90px rgba(0,0,0,0.85), 0 6px 28px rgba(160,168,176,0.14)',
        }}
      >
        <header style={{ marginBottom: 'var(--space-4)', borderBottom: '2px solid var(--teal)', paddingBottom: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--teal)', letterSpacing: '0.06em', margin: 0 }}>
              Technical Data Sheet
            </p>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--white)', margin: '6px 0 0' }}>
              {compound.display_name}
            </h1>
            {compound.aliases.length > 0 && (
              <p style={{ fontSize: '0.82rem', color: 'var(--silver)', margin: '4px 0 0' }}>
                Also Known As: {compound.aliases.join(', ')}
              </p>
            )}
          </div>
          {qr && (
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt={`QR Code Linking To The ${compound.display_name} Research Profile`}
                width={92}
                height={92}
                style={{ borderRadius: 8, display: 'block' }}
              />
              <p style={{ fontSize: '0.66rem', color: 'var(--silver)', margin: '4px 0 0', maxWidth: 92 }}>
                Scan To View Profile
              </p>
            </div>
          )}
        </header>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <Row label="Evidence Tier" value={tier.label} />
            <Row label="Category" value={compound.category} />
            <Row label="Class" value={compound.compound_class} />
            <Row label="Molecular Target" value={compound.molecular_target} />
            <Row label="Sequence" value={id.sequence} />
            <Row label="Molecular Weight" value={id.molecular_weight} />
            <Row label="CAS" value={id.cas} cap={false} />
            <Row label="Parent" value={id.parent} />
            <Row label="Mechanism" value={compound.mechanism} />
            <Row
              label="Studied For"
              value={compound.studied_for.length > 0 ? compound.studied_for.join(', ') : null}
            />
            <Row label="Form" value={h.form} />
            <Row label="Diluent" value={h.diluent} />
            <Row label="Storage Temperature" value={toFahrenheit(h.storage_temp)} />
            <Row label="Light Sensitive" value={h.light_sensitive == null ? null : h.light_sensitive ? 'Yes' : 'No'} />
            <Row label="Freeze / Thaw" value={h.freeze_thaw} />
            <Row
              label="Reconstituted Shelf Life"
              value={h.reconstituted_days != null ? `${h.reconstituted_days} Days` : null}
            />
            <Row label="Handling Notes" value={h.notes} />
            <Row label="Regulatory" value={compound.regulatory} />
            <Row label="WADA Status" value={wadaLabel(compound.wada_status)} />
            <Row
              cap={false}
              label="Sources"
              value={
                compound.sources.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                    {compound.sources.map((src, i) => {
                      const href = /^https?:\/\//i.test(src) ? src : `https://${src}`;
                      return (
                        <li key={i} style={{ wordBreak: 'break-all' }}>
                          <IframeLink href={href} style={{ color: 'var(--teal)' }}>
                            {src}
                          </IframeLink>
                        </li>
                      );
                    })}
                  </ul>
                ) : null
              }
            />
          </tbody>
        </table>

        <footer style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--teal)', margin: 0 }}>
            Research Use Only
          </p>
          <p style={{ fontSize: '0.74rem', color: 'var(--silver)', margin: '4px 0 0' }}>
            Pep Nation Lab - Not For Human Or Veterinary Use. Information Provided For Laboratory Research Purposes Only.
          </p>
        </footer>
      </section>
    </main>
  );
}
