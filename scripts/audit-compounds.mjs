async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable');
    process.exit(1);
  }
  const r = await fetch(url + '/rest/v1/compounds?select=slug,display_name,aliases,studied_for,research_areas,mechanism,benefits,compound_class,molecular_target,plain_summary,eli5_summary,best_stacked_with,efficacy_scores,category,wada_status,risk_level,half_life&order=display_name', {
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
  });
  const data = await r.json();
  // Show fields that are empty/null for Phase 2 prioritization
  data.forEach(c => {
    const missing = [];
    if (!c.mechanism) missing.push('mechanism');
    if (!c.benefits) missing.push('benefits');
    if (!c.plain_summary) missing.push('plain_summary');
    if (!c.eli5_summary) missing.push('eli5_summary');
    if (!c.best_stacked_with || c.best_stacked_with.length === 0) missing.push('best_stacked_with');
    if (!c.efficacy_scores || Object.keys(c.efficacy_scores || {}).length === 0) missing.push('efficacy_scores');
    console.log(JSON.stringify({
      slug: c.slug,
      name: c.display_name,
      aliases: c.aliases.length,
      studied_for: c.studied_for.length,
      areas: c.research_areas.length,
      MISSING: missing,
      best_stacked_with: c.best_stacked_with,
      efficacy_scores: c.efficacy_scores,
      mechanism_chars: (c.mechanism || '').length,
      benefits_chars: (c.benefits || '').length,
    }));
  });
}
main();
