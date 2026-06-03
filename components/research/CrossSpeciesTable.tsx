/**
 * CrossSpeciesTable -- UniProt ortholog table.
 * Research use only.
 */

interface Ortholog {
  species: string;
  uniprot_id: string;
  sequence_length: number;
}

interface Props {
  orthologs: Ortholog[];
}

export default function CrossSpeciesTable({ orthologs }: Props) {
  if (!orthologs || orthologs.length === 0) {
    return (
      <div className="card-glass" style={{ padding: 16, borderRadius: 12, color: '#A8B4C0', fontSize: 14 }}>
        Cross-Species Orthologs Will Populate Once The UniProt Sync Cron Runs.
      </div>
    );
  }

  return (
    <div className="card-metal" style={{ padding: 16, borderRadius: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(168,180,192,0.25)' }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', color: '#A8B4C0', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Species</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', color: '#A8B4C0', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>UniProt</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', color: '#A8B4C0', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Length (aa)</th>
          </tr>
        </thead>
        <tbody>
          {orthologs.map((o, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(168,180,192,0.10)' }}>
              <td style={{ padding: '8px 10px', color: '#FFFFFF', fontWeight: 600 }}>{o.species}</td>
              <td style={{ padding: '8px 10px' }}>
                <a
                  href={`https://www.uniprot.org/uniprotkb/${encodeURIComponent(o.uniprot_id)}/entry`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#00C4BC', textDecoration: 'none' }}
                >
                  {o.uniprot_id}
                </a>
              </td>
              <td style={{ padding: '8px 10px', color: '#D0DAE4', textAlign: 'right' }}>{o.sequence_length}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 10, fontSize: 11, color: '#A8B4C0', fontStyle: 'italic' }}>
        Source: UniProt KB. Research Use Only.
      </p>
    </div>
  );
}
