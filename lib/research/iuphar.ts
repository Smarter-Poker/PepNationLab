/**
 * IUPHAR / Guide to Pharmacology REST client.
 * https://www.guidetopharmacology.org/services/
 * Feeds compound_chembl_bindings + receptor-action panel data.
 */

const IUPHAR_BASE = 'https://www.guidetopharmacology.org/services';

export interface IupharLigand {
  ligandId: number;
  name: string;
  type: string | null;
  approved: boolean | null;
  withdrawn: boolean | null;
}

export interface IupharAction {
  targetId: number;
  targetName: string;
  action: string | null;
  endogenous: boolean | null;
  selectivity: string | null;
  affinity: string | null;
}

export async function searchLigand(name: string): Promise<IupharLigand[]> {
  const n = (name || '').trim();
  if (!n) return [];
  try {
    const resp = await fetch(
      `${IUPHAR_BASE}/ligands?name=${encodeURIComponent(n)}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!resp.ok) return [];
    const json = (await resp.json()) as unknown;
    const arr = Array.isArray(json) ? (json as Array<Record<string, unknown>>) : [];
    const out: IupharLigand[] = [];
    for (const r of arr) {
      const id = typeof r.ligandId === 'number' ? r.ligandId : null;
      const nm = typeof r.name === 'string' ? r.name : null;
      if (id === null || !nm) continue;
      out.push({
        ligandId: id,
        name: nm,
        type: typeof r.type === 'string' ? r.type : null,
        approved: typeof r.approved === 'boolean' ? r.approved : null,
        withdrawn: typeof r.withdrawn === 'boolean' ? r.withdrawn : null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function getReceptorActions(ligandId: number): Promise<IupharAction[]> {
  if (!Number.isFinite(ligandId)) return [];
  try {
    const resp = await fetch(`${IUPHAR_BASE}/ligands/${ligandId}/interactions`, {
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return [];
    const json = (await resp.json()) as unknown;
    const arr = Array.isArray(json) ? (json as Array<Record<string, unknown>>) : [];
    const out: IupharAction[] = [];
    for (const r of arr) {
      const tid = typeof r.targetId === 'number' ? r.targetId : null;
      const tname = typeof r.targetName === 'string' ? r.targetName : null;
      if (tid === null || !tname) continue;
      out.push({
        targetId: tid,
        targetName: tname,
        action: typeof r.action === 'string' ? r.action : null,
        endogenous: typeof r.endogenous === 'boolean' ? r.endogenous : null,
        selectivity: typeof r.selectivity === 'string' ? r.selectivity : null,
        affinity: typeof r.affinity === 'string' ? r.affinity : null,
      });
    }
    return out;
  } catch {
    return [];
  }
}
