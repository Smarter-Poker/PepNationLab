// WADA archive functionality removed. Stubs retained for import compatibility.

export type WadaEntry = {
  compound_slug: string;
  year: number;
  status: string;
  note?: string;
};

export async function fetchWadaArchive(_slug: string): Promise<WadaEntry[]> {
  return [];
}

export async function syncWadaArchive(): Promise<{ synced: number; skipped: number }> {
  return { synced: 0, skipped: 0 };
}

export function isWadaProhibited(_status: string): boolean {
  return false;
}
