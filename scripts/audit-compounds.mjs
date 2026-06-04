async function main() {
  const url = 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3OTM5MiwiZXhwIjoyMDk0OTU1MzkyfQ.M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI';
  const r = await fetch(url + '/rest/v1/compounds?select=slug,display_name,aliases,studied_for,research_areas,mechanism,benefits,compound_class,molecular_target,category&order=display_name', {
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
  });
  const data = await r.json();
  console.log(JSON.stringify(data, null, 2));
}
main();
