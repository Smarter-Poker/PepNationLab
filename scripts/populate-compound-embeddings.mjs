/**
 * Script to generate and populate vector embeddings for all compounds.
 * Uses Google Gemini gemini-embedding-001 (768-dim) model.
 * Run: node scripts/populate-compound-embeddings.mjs
 */

const SUPABASE_URL = 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3OTM5MiwiZXhwIjoyMDk0OTU1MzkyfQ.M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI';

// Read from environment for Gemini key
const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) {
  console.error('ERROR: GEMINI_API_KEY environment variable is required');
  process.exit(1);
}

async function getEmbedding(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_KEY}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini embedding failed: ${resp.status} ${err}`);
  }
  const data = await resp.json();
  return data.embedding?.values;
}

async function fetchAllCompounds() {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/compounds?select=id,slug,display_name,aliases,studied_for,research_areas,plain_summary,eli5_summary,benefits,compound_class,molecular_target,mechanism,best_stacked_with,efficacy_scores,wada_status,typical_frequency,pk_summary`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  return resp.json();
}

async function updateCompoundEmbedding(compoundId, embedding) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/compounds?id=eq.${compoundId}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ embedding }),
    }
  );
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Update failed for compound ${compoundId}: ${err}`);
  }
}

function buildSearchText(compound) {
  const parts = [];
  parts.push(compound.display_name);
  if (compound.aliases && compound.aliases.length) parts.push(`Also known as: ${compound.aliases.join(', ')}`);
  if (compound.studied_for && compound.studied_for.length) parts.push(`Studied for: ${compound.studied_for.join(', ')}`);
  if (compound.research_areas && compound.research_areas.length) parts.push(`Research areas: ${compound.research_areas.join(', ')}`);
  if (compound.plain_summary) parts.push(compound.plain_summary);
  if (compound.eli5_summary) parts.push(compound.eli5_summary);
  if (compound.benefits) parts.push(`Benefits: ${compound.benefits}`);
  if (compound.compound_class) parts.push(`Class: ${compound.compound_class}`);
  if (compound.molecular_target) parts.push(`Target: ${compound.molecular_target}`);
  if (compound.mechanism) parts.push(`Mechanism: ${compound.mechanism}`);
  if (compound.best_stacked_with && compound.best_stacked_with.length) parts.push(`Stacks with: ${compound.best_stacked_with.join(', ')}`);
  if (compound.wada_status) parts.push(`WADA status: ${compound.wada_status}`);
  if (compound.typical_frequency) parts.push(`Dosing: ${compound.typical_frequency}`);
  if (compound.pk_summary) parts.push(`Pharmacokinetics: ${compound.pk_summary}`);
  if (compound.efficacy_scores) {
    const scores = Object.entries(compound.efficacy_scores)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}/100`)
      .join(', ');
    if (scores) parts.push(`Efficacy: ${scores}`);
  }
  return parts.join('\n').slice(0, 3000);
}

async function main() {
  console.log('Fetching compounds...');
  const compounds = await fetchAllCompounds();
  console.log(`Loaded ${compounds.length} compounds`);

  let success = 0;
  let failed = 0;

  for (const compound of compounds) {
    try {
      const text = buildSearchText(compound);
      console.log(`Embedding compound: ${compound.display_name} (${text.length} chars)...`);
      
      const embedding = await getEmbedding(text);
      if (!embedding || embedding.length !== 768) {
        throw new Error(`Bad embedding dimensions: ${embedding?.length}`);
      }
      
      await updateCompoundEmbedding(compound.id, embedding);
      success++;
      console.log(`  [OK] ${compound.display_name}`);
      
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.error(`  [FAILED] ${compound.display_name}:`, e.message);
      failed++;
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Success: ${success}/${compounds.length}`);
  console.log(`Failed: ${failed}/${compounds.length}`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
