import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const productionRefs = new Set(['ydsaqnnuwyvtyxgvrnys', 'kuklfnapbkmacvwxktbh', 'cupnhfdwveouenutnveg']);
export function validateDatabaseTestTarget(value, isolatedRef) {
  if (!value || !isolatedRef) throw new Error('Database integration tests require an explicitly configured isolated project reference and URL.');
  if (!/^[a-z]{20}$/.test(isolatedRef) || productionRefs.has(isolatedRef)) throw new Error('Production projects cannot receive database test fixtures.');
  let url;
  try { url = new URL(value); } catch { throw new Error('Invalid isolated database API URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hostname !== `${isolatedRef}.supabase.co` || url.port || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('The database test URL must match the explicitly configured isolated project.');
  }
  return true;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    validateDatabaseTestTarget(process.env.SUPABASE_URL, process.env.SUPABASE_TEST_PROJECT_REF);
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('The isolated database service credential is unavailable.');
    console.log('Explicit isolated database target verified; no production fixtures are permitted.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
