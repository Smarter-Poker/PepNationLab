/**
 * SARPanel -- analogue family relative to a baseline. Shows MW, half-life,
 * and evidence tier per analogue.
 */

import type { Compound } from '@/lib/compounds';
import { evidenceTier } from '@/lib/compounds';

interface CompoundLike extends Pick<Compound, 'slug' | 'display_name' | 'evidence_tier' | 'half_life'> {
  molecular_weight_da?: number | null;
  measured_half_life_hours?: number | null;
  predicted_half_life_hours?: number | null;
}

interface Props {
  compounds: CompoundLike[];
  baselineSlug?: string | null;
}

export default function SARPanel({ compounds, baselineSlug }: Props) {
  if (!compounds || compounds.length === 0) {
    return (
      <div className="card-metal" style={{ padding: 16, borderRadius: 12, color: '#A8B4C0', fontSize: 14 }}>
        No Analogue Family Available For This Compound.
      </div>
    );
  }

  const baseline = baselineSlug ? compounds.find((c) => c.slug === baselineSlug) : compounds[0];
  const baseMw = baseline?.molecular_weight_da ?? null;
  const baseHl = baseline?.measured_half_life_hours ?? baseline?.predicted_half_life_hours ?? null;

  return (
    <div className="card-metal" style={{ padding: 16, borderRadius: 12 }}>
      <h3 style={{ margin: 0, color: '#FFFFFF', fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Structure-Activity Relationship Panel</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(168,180,192,0.25)' }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', color: '#A8B4C0', fontSize: 11, textTransform: 'uppercase' }}>Analogue</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', color: '#A8B4C0', fontSize: 11, textTransform: 'uppercase' }}>MW (Da)</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', color: '#A8B4C0', fontSize: 11, textTransform: 'uppercase' }}>Half-Life (h)</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', color: '#A8B4C0', fontSize: 11, textTransform: 'uppercase' }}>Evidence</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', color: '#A8B4C0', fontSize: 11, textTransform: 'uppercase' }}>Vs Baseline</th>
          </tr>
        </thead>
        <tbody>
          {compounds.map((c) => {
            const t = evidenceTier(c.evidence_tier);
            const hl = c.measured_half_life_hours ?? c.predicted_half_life_hours ?? null;
            const dMw = baseMw && c.molecular_weight_da ? (((c.molecular_weight_da - baseMw) / baseMw) * 100).toFixed(1) : null;
            const isBaseline = c.slug === baseline?.slug;
            return (
              <tr key={c.slug} style={{ borderBottom: '1px solid rgba(168,180,192,0.10)' }}>
                <td style={{ padding: '8px 10px', color: '#FFFFFF', fontWeight: isBaseline ? 800 : 600 }}>
                  {c.display_name}{isBaseline ? ' (Baseline)' : ''}
                </td>
                <td style={{ padding: '8px 10px', color: '#D0DAE4', textAlign: 'right' }}>
                  {c.molecular_weight_da ? c.molecular_weight_da.toFixed(1) : '-'}
                </td>
                <td style={{ padding: '8px 10px', color: '#D0DAE4', textAlign: 'right' }}>
                  {hl !== null ? hl.toFixed(1) : '-'}
                </td>
                <td style={{ padding: '8px 10px', color: t.color, fontWeight: 700 }}>{t.label}</td>
                <td style={{ padding: '8px 10px', color: '#00C4BC', textAlign: 'right' }}>
                  {dMw !== null && !isBaseline ? `${Number(dMw) > 0 ? '+' : ''}${dMw}% MW` : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ marginTop: 10, fontSize: 11, color: '#A8B4C0', fontStyle: 'italic' }}>
        Comparative Lab Reference. Research Use Only.
      </p>
    </div>
  );
}
