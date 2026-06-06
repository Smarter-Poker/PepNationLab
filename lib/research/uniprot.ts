/**
 * UniProt REST client. https://rest.uniprot.org
 * Used by /api/cron/uniprot-sync to populate compound_orthologs and the
 * receptors[] array on compounds. Never throws - returns null or [] on
 * any network/parse failure so the cron skips to the next compound.
 */

const UNIPROT_BASE = 'https://rest.uniprot.org';

export interface UniprotEntry {
  primaryAccession: string;
  uniProtkbId: string | null;
  proteinName: string | null;
  organism: string | null;
  taxonId: number | null;
  sequence: string | null;
  length: number | null;
  raw: unknown;
}

export interface UniprotOrtholog {
  uniprot_id: string;
  organism: string;
  taxon_id: number;
  sequence_identity: number | null;
  notes: string | null;
}

function firstName(rec: unknown): string | null {
  if (!rec || typeof rec !== 'object') return null;
  const r = rec as Record<string, unknown>;
  const pn = r.proteinName as Record<string, unknown> | undefined;
  const rec2 = pn?.recommendedName as Record<string, unknown> | undefined;
  const full = rec2?.fullName as Record<string, unknown> | undefined;
  const v = full?.value;
  return typeof v === 'string' ? v : null;
}

export async function searchByName(name: string, organism?: string): Promise<UniprotEntry[]> {
  const q = (name || '').trim();
  if (!q) return [];
  let query = `(protein_name:${JSON.stringify(q)})`;
  if (organism) query += ` AND (organism_name:${JSON.stringify(organism)})`;
  const params = new URLSearchParams({
    query,
    format: 'json',
    size: '5',
    fields: 'accession,id,protein_name,organism_name,organism_id,sequence,length',
  });
  try {
    const resp = await fetch(`${UNIPROT_BASE}/uniprotkb/search?${params.toString()}`);
    if (!resp.ok) return [];
    const json = (await resp.json()) as { results?: unknown[] };
    const results = Array.isArray(json?.results) ? json.results : [];
    const out: UniprotEntry[] = [];
    for (const r of results as Record<string, unknown>[]) {
      const acc = typeof r.primaryAccession === 'string' ? r.primaryAccession : null;
      if (!acc) continue;
      const seq = (r.sequence as Record<string, unknown>) ?? {};
      const org = (r.organism as Record<string, unknown>) ?? {};
      out.push({
        primaryAccession: acc,
        uniProtkbId: typeof r.uniProtkbId === 'string' ? r.uniProtkbId : null,
        proteinName: firstName(r),
        organism: typeof org.scientificName === 'string' ? org.scientificName : null,
        taxonId: typeof org.taxonId === 'number' ? org.taxonId : null,
        sequence: typeof seq.value === 'string' ? (seq.value as string) : null,
        length: typeof seq.length === 'number' ? seq.length : null,
        raw: r,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function getById(uniprotId: string): Promise<UniprotEntry | null> {
  const id = (uniprotId || '').trim();
  if (!id) return null;
  try {
    const resp = await fetch(`${UNIPROT_BASE}/uniprotkb/${encodeURIComponent(id)}.json`);
    if (!resp.ok) return null;
    const r = (await resp.json()) as Record<string, unknown>;
    const seq = (r.sequence as Record<string, unknown>) ?? {};
    const org = (r.organism as Record<string, unknown>) ?? {};
    return {
      primaryAccession: id,
      uniProtkbId: typeof r.uniProtkbId === 'string' ? r.uniProtkbId : null,
      proteinName: firstName(r),
      organism: typeof org.scientificName === 'string' ? org.scientificName : null,
      taxonId: typeof org.taxonId === 'number' ? org.taxonId : null,
      sequence: typeof seq.value === 'string' ? (seq.value as string) : null,
      length: typeof seq.length === 'number' ? seq.length : null,
      raw: r,
    };
  } catch {
    return null;
  }
}

export async function getOrthologs(uniprotId: string): Promise<UniprotOrtholog[]> {
  const id = (uniprotId || '').trim();
  if (!id) return [];
  // Lightweight ortholog lookup via UniProt cross-references; full OrthoDB
  // calls are too heavy for a weekly cron, so we surface what UniProt
  // already returns for the entry under the 'OrthoDB' or 'eggNOG'
  // cross-reference sections.
  try {
    const resp = await fetch(`${UNIPROT_BASE}/uniprotkb/${encodeURIComponent(id)}.json`);
    if (!resp.ok) return [];
    const r = (await resp.json()) as Record<string, unknown>;
    const xrefs = Array.isArray(r.uniProtKBCrossReferences)
      ? (r.uniProtKBCrossReferences as Array<Record<string, unknown>>)
      : [];
    const out: UniprotOrtholog[] = [];
    for (const x of xrefs) {
      const db = typeof x.database === 'string' ? x.database : '';
      if (db !== 'OrthoDB' && db !== 'eggNOG' && db !== 'KEGG') continue;
      const props = Array.isArray(x.properties) ? x.properties : [];
      const idVal = typeof x.id === 'string' ? x.id : null;
      if (!idVal) continue;
      out.push({
        uniprot_id: idVal,
        organism: db,
        taxon_id: 0,
        sequence_identity: null,
        notes: props.length > 0 ? JSON.stringify(props).slice(0, 200) : null,
      });
    }
    return out.slice(0, 25);
  } catch {
    return [];
  }
}
