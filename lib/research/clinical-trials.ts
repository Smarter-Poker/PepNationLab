/**
 * Lightweight ClinicalTrials.gov v2 API client.
 *
 * https://clinicaltrials.gov/data-api/api
 *
 * Used by app/api/cron/trials-sync/route.ts to keep
 * compound_clinical_trials in sync with the public registry. Returns []
 * on network or parse failure — never throws — so the cron can move on
 * to the next compound.
 */

const CT_BASE = 'https://clinicaltrials.gov/api/v2';

export interface CtgovTrial {
  nctId: string;
  briefTitle: string | null;
  overallStatus: string | null;
  phase: string | null;
  enrollmentCount: number | null;
  leadSponsor: string | null;
  startDate: string | null;
  primaryCompletionDate: string | null;
  conditions: string[];
  interventions: string[];
  url: string;
  raw: unknown;
}

export interface SearchTrialsOptions {
  pageSize?: number;
  statusFilter?: string[]; // e.g. ['RECRUITING','COMPLETED']
  signal?: AbortSignal;
}

function firstString(v: unknown): string | null {
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string') return v[0];
  if (typeof v === 'string') return v;
  return null;
}

export async function searchTrials(
  intervention: string,
  opts: SearchTrialsOptions = {},
): Promise<CtgovTrial[]> {
  const term = (intervention || '').trim();
  if (!term) return [];

  const pageSize = Math.max(1, Math.min(100, opts.pageSize ?? 50));
  const params = new URLSearchParams({
    'query.intr': term,
    pageSize: String(pageSize),
    format: 'json',
  });
  if (opts.statusFilter && opts.statusFilter.length > 0) {
    params.set('filter.overallStatus', opts.statusFilter.join(','));
  }
  const url = `${CT_BASE}/studies?${params.toString()}`;

  try {
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: opts.signal,
    });
    if (!resp.ok) return [];
    const json = (await resp.json()) as { studies?: unknown[] };
    const studies = Array.isArray(json?.studies) ? json.studies : [];

    const out: CtgovTrial[] = [];
    for (const s of studies as Record<string, unknown>[]) {
      const protocol =
        ((s.protocolSection as Record<string, unknown>) ?? {}) as Record<string, unknown>;
      const idMod =
        ((protocol.identificationModule as Record<string, unknown>) ?? {}) as Record<
          string,
          unknown
        >;
      const statusMod =
        ((protocol.statusModule as Record<string, unknown>) ?? {}) as Record<string, unknown>;
      const designMod =
        ((protocol.designModule as Record<string, unknown>) ?? {}) as Record<string, unknown>;
      const sponsorMod =
        ((protocol.sponsorCollaboratorsModule as Record<string, unknown>) ?? {}) as Record<
          string,
          unknown
        >;
      const condMod =
        ((protocol.conditionsModule as Record<string, unknown>) ?? {}) as Record<
          string,
          unknown
        >;
      const intrMod =
        ((protocol.armsInterventionsModule as Record<string, unknown>) ?? {}) as Record<
          string,
          unknown
        >;

      const nctId = typeof idMod.nctId === 'string' ? idMod.nctId : null;
      if (!nctId) continue;

      const enrollmentInfo =
        ((designMod.enrollmentInfo as Record<string, unknown>) ?? {}) as Record<
          string,
          unknown
        >;
      const leadSponsor =
        ((sponsorMod.leadSponsor as Record<string, unknown>) ?? {}) as Record<
          string,
          unknown
        >;
      const startDateStruct =
        ((statusMod.startDateStruct as Record<string, unknown>) ?? {}) as Record<
          string,
          unknown
        >;
      const primaryCompletionStruct =
        ((statusMod.primaryCompletionDateStruct as Record<string, unknown>) ?? {}) as Record<
          string,
          unknown
        >;

      const phases = Array.isArray(designMod.phases) ? (designMod.phases as unknown[]) : [];
      const phase =
        phases.length > 0 && typeof phases[0] === 'string' ? (phases[0] as string) : null;

      const conditionsRaw = Array.isArray(condMod.conditions)
        ? (condMod.conditions as unknown[])
        : [];
      const conditions = conditionsRaw.filter((x): x is string => typeof x === 'string');

      const interventionsRaw = Array.isArray(intrMod.interventions)
        ? (intrMod.interventions as unknown[])
        : [];
      const interventions = interventionsRaw
        .map((i) => {
          if (i && typeof i === 'object' && 'name' in (i as Record<string, unknown>)) {
            const n = (i as Record<string, unknown>).name;
            return typeof n === 'string' ? n : null;
          }
          return null;
        })
        .filter((x): x is string => x !== null);

      const enrollmentCount =
        typeof enrollmentInfo.count === 'number' ? enrollmentInfo.count : null;

      out.push({
        nctId,
        briefTitle: firstString(idMod.briefTitle),
        overallStatus: firstString(statusMod.overallStatus),
        phase,
        enrollmentCount,
        leadSponsor: firstString(leadSponsor.name),
        startDate: firstString(startDateStruct.date),
        primaryCompletionDate: firstString(primaryCompletionStruct.date),
        conditions,
        interventions,
        url: `https://clinicaltrials.gov/study/${nctId}`,
        raw: s,
      });
    }
    return out;
  } catch {
    return [];
  }
}
