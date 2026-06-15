/**
 * Script to generate and populate vector embeddings for all products.
 * DEPRECATED: This script requires a Gemini embedding API key (gemini-embedding-001).
 * The production app now uses keyword search (ts_rank_cd + ILIKE) as the active search backend.
 * If you re-enable vector search, you'll need a valid GEMINI_API_KEY with billing enabled
 * or replace this with a different 768-dim embedding provider.
 * Run: GEMINI_API_KEY=... node scripts/populate-embeddings.mjs
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
    `${SUPABASE_URL}/rest/v1/compounds?select=slug,display_name,aliases,studied_for,research_areas,plain_summary,eli5_summary,benefits,compound_class,molecular_target,mechanism,best_stacked_with,efficacy_scores,wada_status,typical_frequency,pk_summary`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  return resp.json();
}

async function fetchAllProducts() {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/products?select=id,name,description,category,compound_slug`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  return resp.json();
}

async function updateEmbedding(productId, embedding) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/products?id=eq.${productId}`,
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
    throw new Error(`Update failed for ${productId}: ${err}`);
  }
}

function buildSearchText(product, compoundsMap) {
  const parts = [];
  parts.push(product.name);
  if (product.description) parts.push(product.description);
  if (product.category) parts.push(`Category: ${product.category}`);

  const compound = product.compound_slug ? compoundsMap[product.compound_slug] : null;
  if (compound) {
    parts.push(`Also known as: ${(compound.aliases || []).join(', ')}`);
    parts.push(`Studied for: ${(compound.studied_for || []).join(', ')}`);
    parts.push(`Research areas: ${(compound.research_areas || []).join(', ')}`);
    if (compound.plain_summary) parts.push(compound.plain_summary);
    if (compound.eli5_summary) parts.push(compound.eli5_summary);
    if (compound.benefits) parts.push(`Benefits: ${compound.benefits}`);
    if (compound.compound_class) parts.push(`Class: ${compound.compound_class}`);
    if (compound.molecular_target) parts.push(`Target: ${compound.molecular_target}`);
    if (compound.mechanism) parts.push(`Mechanism: ${compound.mechanism}`);
    if (compound.best_stacked_with?.length) parts.push(`Stacks with: ${compound.best_stacked_with.join(', ')}`);
    if (compound.wada_status) parts.push(`WADA status: ${compound.wada_status}`);
    if (compound.typical_frequency) parts.push(`Dosing: ${compound.typical_frequency}`);
    if (compound.pk_summary) parts.push(`Pharmacokinetics: ${compound.pk_summary}`);
    if (compound.efficacy_scores) {
      const scores = Object.entries(compound.efficacy_scores)
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}/100`)
        .join(', ');
      if (scores) parts.push(`Efficacy: ${scores}`);
    }
  }

  // Truncate to ~3000 chars to stay within embedding model limits
  return parts.join('\n').slice(0, 3000);
}

async function main() {
  console.log('Fetching compounds...');
  const compounds = await fetchAllCompounds();
  const compoundsMap = Object.fromEntries(compounds.map(c => [c.slug, c]));
  console.log(`Loaded ${compounds.length} compounds`);

  console.log('Fetching products...');
  const products = await fetchAllProducts();
  console.log(`Loaded ${products.length} products`);

  let success = 0;
  let failed = 0;

  for (const product of products) {
    try {
      const text = buildSearchText(product, compoundsMap);
      console.log(`Embedding: ${product.name} (${text.length} chars)...`);
      
      const embedding = await getEmbedding(text);
      if (!embedding || embedding.length !== 768) {
        throw new Error(`Bad embedding dimensions: ${embedding?.length}`);
      }
      
      await updateEmbedding(product.id, embedding);
      success++;
      console.log(`  [SUCCESS] ${product.name}`);
      
      // Rate limiting: Google allows 1500 req/min on free tier, 
      // but embedding is per-request so add small delay
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.error(`  [FAILED] ${product.name}:`, e.message);
      failed++;
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Success: ${success}/${products.length}`);
  console.log(`Failed: ${failed}/${products.length}`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
