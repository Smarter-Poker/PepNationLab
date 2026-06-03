/**
 * ChEMBL REST client. https://www.ebi.ac.uk/chembl/api/data
 * Used by /api/cron/chembl-sync to populate compound_chembl_bindings
 * with receptor affinity data (pchembl_value, IC50, Ki, etc).
 */

const CHEMBL_BASE = 'https://www.ebi.ac.uk/chembl/api/data';

export interface ChemblMolecule {
  molecule_chembl_id: string;
  pref_name: string | null;
  molecule_type: string | null;
  max_phase: number | null;
  molecular_formula: string | null;
  molecular_weight: number | null;
  raw: unknown;
}

export interface ChemblActivity {
  activity_id: number;
  target_chembl_id: string | null;
  target_pref_name: string | null;
  target_organism: string | null;
  standard_type: string | null;
  standard_value: number | null;
  standard_units: string | null;
  pchembl_value: number | null;
  document_chembl_id: string | null;
  assay_type: string | null;
}

export async function searchMolecule(name: string): Promise<ChemblMolecule[]> {
  const q = (name || '').trim();
  if (!q) return [];
  try {
    const resp = await fetch(
      `${CHEMBL_BASE}/molecule/search.json?q=${encodeURIComponent(q)}&limit=10`,
    );
    if (!resp.ok) return [];
    const json = (await resp.json()) as { molecules?: unknown[] };
    const arr = Array.isArray(json?.molecules) ? json.molecules : [];
    const out: ChemblMolecule[] = [];
    for (const m of arr as Record<string, unknown>[]) {
      const id = typeof m.molecule_chembl_id === 'string' ? m.molecule_chembl_id : null;
      if (!id) continue;
      const mp = (m.molecule_properties as Record<string, unknown>) ?? {};
      out.push({
        molecule_chembl_id: id,
        pref_name: typeof m.pref_name === 'string' ? m.pref_name : null,
        molecule_type: typeof m.molecule_type === 'string' ? m.molecule_type : null,
        max_phase: typeof m.max_phase === 'number' ? m.max_phase : null,
        molecular_formula: typeof mp.full_molformula === 'string' ? (mp.full_molformula as string) : null,
        molecular_weight: typeof mp.full_mwt === 'number' ? (mp.full_mwt as number) : null,
        raw: m,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function getMoleculeById(chemblId: string): Promise<ChemblMolecule | null> {
  const id = (chemblId || '').trim();
  if (!id) return null;
  try {
    const resp = await fetch(`${CHEMBL_BASE}/molecule/${encodeURIComponent(id)}.json`);
    if (!resp.ok) return null;
    const m = (await resp.json()) as Record<string, unknown>;
    const mp = (m.molecule_properties as Record<string, unknown>) ?? {};
    return {
      molecule_chembl_id: id,
      pref_name: typeof m.pref_name === 'string' ? m.pref_name : null,
      molecule_type: typeof m.molecule_type === 'string' ? m.molecule_type : null,
      max_phase: typeof m.max_phase === 'number' ? m.max_phase : null,
      molecular_formula: typeof mp.full_molformula === 'string' ? (mp.full_molformula as string) : null,
      molecular_weight: typeof mp.full_mwt === 'number' ? (mp.full_mwt as number) : null,
      raw: m,
    };
  } catch {
    return null;
  }
}

export async function getActivities(moleculeChemblId: string): Promise<ChemblActivity[]> {
  const id = (moleculeChemblId || '').trim();
  if (!id) return [];
  try {
    const params = new URLSearchParams({
      molecule_chembl_id: id,
      limit: '50',
      format: 'json',
    });
    const resp = await fetch(`${CHEMBL_BASE}/activity.json?${params.toString()}`);
    if (!resp.ok) return [];
    const json = (await resp.json()) as { activities?: unknown[] };
    const arr = Array.isArray(json?.activities) ? json.activities : [];
    const out: ChemblActivity[] = [];
    for (const a of arr as Record<string, unknown>[]) {
      const actId = typeof a.activity_id === 'number' ? a.activity_id : null;
      if (actId === null) continue;
      out.push({
        activity_id: actId,
        target_chembl_id: typeof a.target_chembl_id === 'string' ? a.target_chembl_id : null,
        target_pref_name: typeof a.target_pref_name === 'string' ? a.target_pref_name : null,
        target_organism: typeof a.target_organism === 'string' ? a.target_organism : null,
        standard_type: typeof a.standard_type === 'string' ? a.standard_type : null,
        standard_value: typeof a.standard_value === 'number' ? a.standard_value : null,
        standard_units: typeof a.standard_units === 'string' ? a.standard_units : null,
        pchembl_value: typeof a.pchembl_value === 'number' ? a.pchembl_value : null,
        document_chembl_id: typeof a.document_chembl_id === 'string' ? a.document_chembl_id : null,
        assay_type: typeof a.assay_type === 'string' ? a.assay_type : null,
      });
    }
    return out;
  } catch {
    return [];
  }
}
