import { pingIndexNow } from '../lib/indexnow';
import { CITIES } from '../lib/cities/cities-data';

const STATIC_CITY_LIMIT = 500;
const BASE = 'https://pepnationlab.com';

async function main() {
  console.log('Building URL list...');
  const topCities = CITIES.sort((a, b) => b.population - a.population).slice(0, STATIC_CITY_LIMIT);
  
  const urls = topCities.map(c => `${BASE}/peptides/${c.stateSlug}/${c.slug}`);
  console.log(`Total URLs to ping: ${urls.length}`);

  // We chunk them in sets of 100 just in case there's an arbitrary limit, although IndexNow supports up to 10k per request.
  console.log('Sending IndexNow mass ping...');
  const res = await pingIndexNow(urls);
  
  if (res.ok) {
    console.log(`Successfully pinged IndexNow! Status: ${res.status}, Submitted: ${res.submitted} URLs.`);
  } else {
    console.error(`Failed to ping IndexNow. Status: ${res.status}`);
  }
}

main().catch(console.error);
