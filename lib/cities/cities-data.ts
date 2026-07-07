/**
 * cities-data.ts
 * Master list of US cities for local SEO landing page generation.
 * Tier 1 = highest wealth/population priority (Beverly Hills, Scottsdale, etc.)
 * Tier 2 = strong metro suburbs with disposable income
 * Tier 3 = mid-size cities with measurable peptide-related search volume
 */

export interface City {
  name: string;
  slug: string;           // URL slug, e.g. "oak-lawn"
  state: string;          // Full state name, e.g. "Illinois"
  stateSlug: string;      // URL-safe state slug, e.g. "illinois"
  stateAbbr: string;      // Two-letter state abbreviation, e.g. "IL"
  population: number;
  medianIncome: number;   // Approximate median household income (USD)
  tier: 1 | 2 | 3;
  region?: string;        // Optional regional label, e.g. "Chicagoland area"
  county?: string;        // County name WITHOUT the word "County", e.g. "Cook"
  zips?: string[];        // Representative ZIP codes for the city
  localBlurb?: string;    // Unique city-specific copy rendered on the landing page
}

export const CITIES: City[] = [
  // ─────────────────────────────────────────────
  // CALIFORNIA
  // ─────────────────────────────────────────────
  { name: 'Beverly Hills', slug: 'beverly-hills', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 34000, medianIncome: 120000, tier: 1, region: 'Greater Los Angeles' },
  { name: 'Newport Beach', slug: 'newport-beach', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 85000, medianIncome: 130000, tier: 1, region: 'Orange County' },
  { name: 'Palo Alto', slug: 'palo-alto', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 68000, medianIncome: 150000, tier: 1, region: 'Silicon Valley' },
  { name: 'Malibu', slug: 'malibu', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 13000, medianIncome: 145000, tier: 1, region: 'Greater Los Angeles' },
  { name: 'Atherton', slug: 'atherton', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 7000, medianIncome: 250000, tier: 1, region: 'Silicon Valley' },
  { name: 'Menlo Park', slug: 'menlo-park', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 34000, medianIncome: 160000, tier: 1, region: 'Silicon Valley' },
  { name: 'Los Altos', slug: 'los-altos', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 31000, medianIncome: 185000, tier: 1, region: 'Silicon Valley' },
  { name: 'Saratoga', slug: 'saratoga', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 31000, medianIncome: 175000, tier: 1, region: 'Silicon Valley' },
  { name: 'Laguna Beach', slug: 'laguna-beach', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 23000, medianIncome: 120000, tier: 1, region: 'Orange County' },
  { name: 'Rancho Santa Fe', slug: 'rancho-santa-fe', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 3100, medianIncome: 210000, tier: 1, region: 'Greater San Diego' },
  { name: 'San Francisco', slug: 'san-francisco', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 874000, medianIncome: 130000, tier: 1, region: 'Bay Area' },
  { name: 'Los Angeles', slug: 'los-angeles', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 3990000, medianIncome: 70000, tier: 1, region: 'Greater Los Angeles' },
  { name: 'San Diego', slug: 'san-diego', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 1423000, medianIncome: 85000, tier: 1, region: 'Greater San Diego' },
  { name: 'Irvine', slug: 'irvine', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 310000, medianIncome: 100000, tier: 1, region: 'Orange County' },
  { name: 'Santa Monica', slug: 'santa-monica', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 93000, medianIncome: 95000, tier: 1, region: 'Greater Los Angeles' },
  { name: 'Pasadena', slug: 'pasadena', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 138000, medianIncome: 80000, tier: 2 },
  { name: 'Walnut Creek', slug: 'walnut-creek', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 70000, medianIncome: 100000, tier: 2, region: 'Bay Area' },
  { name: 'Pleasanton', slug: 'pleasanton', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 82000, medianIncome: 130000, tier: 2, region: 'Bay Area' },
  { name: 'Dublin', slug: 'dublin', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 72000, medianIncome: 125000, tier: 2, region: 'Bay Area' },
  { name: 'San Jose', slug: 'san-jose', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 1013000, medianIncome: 110000, tier: 2, region: 'Silicon Valley' },
  { name: 'Cupertino', slug: 'cupertino', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 60000, medianIncome: 155000, tier: 1, region: 'Silicon Valley' },
  { name: 'Sunnyvale', slug: 'sunnyvale', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 155000, medianIncome: 130000, tier: 2, region: 'Silicon Valley' },
  { name: 'Santa Barbara', slug: 'santa-barbara', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 91000, medianIncome: 72000, tier: 2 },
  { name: 'Thousand Oaks', slug: 'thousand-oaks', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 128000, medianIncome: 100000, tier: 2 },
  { name: 'Carlsbad', slug: 'carlsbad', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 118000, medianIncome: 100000, tier: 2, region: 'Greater San Diego' },
  { name: 'Encinitas', slug: 'encinitas', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 62000, medianIncome: 95000, tier: 2, region: 'Greater San Diego' },
  { name: 'Rancho Cucamonga', slug: 'rancho-cucamonga', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 178000, medianIncome: 82000, tier: 2 },
  { name: 'Roseville', slug: 'roseville', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 145000, medianIncome: 87000, tier: 2 },
  { name: 'Folsom', slug: 'folsom', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 82000, medianIncome: 107000, tier: 2 },
  { name: 'Fresno', slug: 'fresno', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 545000, medianIncome: 50000, tier: 3 },
  { name: 'Sacramento', slug: 'sacramento', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 524000, medianIncome: 60000, tier: 3 },

  // ─────────────────────────────────────────────
  // ARIZONA
  // ─────────────────────────────────────────────
  { name: 'Scottsdale', slug: 'scottsdale', state: 'Arizona', stateSlug: 'arizona', stateAbbr: 'AZ', population: 258000, medianIncome: 85000, tier: 1, region: 'Greater Phoenix' },
  { name: 'Paradise Valley', slug: 'paradise-valley', state: 'Arizona', stateSlug: 'arizona', stateAbbr: 'AZ', population: 14000, medianIncome: 225000, tier: 1, region: 'Greater Phoenix' },
  { name: 'Chandler', slug: 'chandler', state: 'Arizona', stateSlug: 'arizona', stateAbbr: 'AZ', population: 270000, medianIncome: 80000, tier: 2, region: 'Greater Phoenix' },
  { name: 'Gilbert', slug: 'gilbert', state: 'Arizona', stateSlug: 'arizona', stateAbbr: 'AZ', population: 275000, medianIncome: 90000, tier: 2, region: 'Greater Phoenix' },
  { name: 'Tempe', slug: 'tempe', state: 'Arizona', stateSlug: 'arizona', stateAbbr: 'AZ', population: 195000, medianIncome: 55000, tier: 2, region: 'Greater Phoenix' },
  { name: 'Mesa', slug: 'mesa', state: 'Arizona', stateSlug: 'arizona', stateAbbr: 'AZ', population: 509000, medianIncome: 60000, tier: 2, region: 'Greater Phoenix' },
  { name: 'Peoria', slug: 'peoria', state: 'Arizona', stateSlug: 'arizona', stateAbbr: 'AZ', population: 186000, medianIncome: 75000, tier: 2, region: 'Greater Phoenix' },
  { name: 'Glendale', slug: 'glendale', state: 'Arizona', stateSlug: 'arizona', stateAbbr: 'AZ', population: 248000, medianIncome: 57000, tier: 3, region: 'Greater Phoenix' },
  { name: 'Phoenix', slug: 'phoenix', state: 'Arizona', stateSlug: 'arizona', stateAbbr: 'AZ', population: 1608000, medianIncome: 58000, tier: 2, region: 'Greater Phoenix' },
  { name: 'Tucson', slug: 'tucson', state: 'Arizona', stateSlug: 'arizona', stateAbbr: 'AZ', population: 543000, medianIncome: 45000, tier: 3 },
  { name: 'Sedona', slug: 'sedona', state: 'Arizona', stateSlug: 'arizona', stateAbbr: 'AZ', population: 10000, medianIncome: 65000, tier: 2 },
  { name: 'Fountain Hills', slug: 'fountain-hills', state: 'Arizona', stateSlug: 'arizona', stateAbbr: 'AZ', population: 25000, medianIncome: 78000, tier: 2, region: 'Greater Phoenix' },

  // ─────────────────────────────────────────────
  // FLORIDA
  // ─────────────────────────────────────────────
  { name: 'Palm Beach', slug: 'palm-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 9000, medianIncome: 200000, tier: 1 },
  { name: 'Naples', slug: 'naples', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 22000, medianIncome: 110000, tier: 1 },
  { name: 'Boca Raton', slug: 'boca-raton', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 99000, medianIncome: 80000, tier: 1 },
  { name: 'Coral Gables', slug: 'coral-gables', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 50000, medianIncome: 120000, tier: 1, region: 'Greater Miami' },
  { name: 'Aventura', slug: 'aventura', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 40000, medianIncome: 75000, tier: 1, region: 'Greater Miami' },
  { name: 'Weston', slug: 'weston', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 72000, medianIncome: 100000, tier: 2, region: 'Greater Fort Lauderdale' },
  { name: 'Parkland', slug: 'parkland', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 35000, medianIncome: 130000, tier: 1, region: 'Greater Fort Lauderdale' },
  { name: 'Wellington', slug: 'wellington', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 68000, medianIncome: 82000, tier: 2 },
  { name: 'Sarasota', slug: 'sarasota', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 57000, medianIncome: 60000, tier: 2 },
  { name: 'Fort Lauderdale', slug: 'fort-lauderdale', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 183000, medianIncome: 58000, tier: 2 },
  { name: 'Miami', slug: 'miami', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 470000, medianIncome: 45000, tier: 2 },
  { name: 'Tampa', slug: 'tampa', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 399000, medianIncome: 57000, tier: 2 },
  { name: 'Orlando', slug: 'orlando', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 307000, medianIncome: 50000, tier: 2 },
  { name: 'Jacksonville', slug: 'jacksonville', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 949000, medianIncome: 55000, tier: 2 },
  { name: 'St. Petersburg', slug: 'st-petersburg', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 259000, medianIncome: 55000, tier: 2 },
  { name: 'Clearwater', slug: 'clearwater', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 117000, medianIncome: 52000, tier: 3 },
  { name: 'Delray Beach', slug: 'delray-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 69000, medianIncome: 60000, tier: 2 },
  { name: 'Pompano Beach', slug: 'pompano-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 115000, medianIncome: 52000, tier: 3 },
  { name: 'West Palm Beach', slug: 'west-palm-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 117000, medianIncome: 52000, tier: 2 },
  { name: 'Bonita Springs', slug: 'bonita-springs', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 55000, medianIncome: 73000, tier: 2 },
  { name: 'Marco Island', slug: 'marco-island', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 18000, medianIncome: 95000, tier: 1 },

  // ─────────────────────────────────────────────
  // TEXAS
  // ─────────────────────────────────────────────
  { name: 'Plano', slug: 'plano', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 290000, medianIncome: 90000, tier: 1, region: 'Greater Dallas' },
  { name: 'Frisco', slug: 'frisco', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 220000, medianIncome: 115000, tier: 1, region: 'Greater Dallas' },
  { name: 'McKinney', slug: 'mckinney', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 206000, medianIncome: 92000, tier: 2, region: 'Greater Dallas' },
  { name: 'Allen', slug: 'allen', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 108000, medianIncome: 97000, tier: 2, region: 'Greater Dallas' },
  { name: 'Southlake', slug: 'southlake', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 32000, medianIncome: 200000, tier: 1, region: 'Greater Fort Worth' },
  { name: 'Colleyville', slug: 'colleyville', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 27000, medianIncome: 155000, tier: 1, region: 'Greater Fort Worth' },
  { name: 'Keller', slug: 'keller', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 52000, medianIncome: 108000, tier: 2, region: 'Greater Fort Worth' },
  { name: 'Sugar Land', slug: 'sugar-land', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 118000, medianIncome: 102000, tier: 2, region: 'Greater Houston' },
  { name: 'The Woodlands', slug: 'the-woodlands', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 115000, medianIncome: 112000, tier: 1, region: 'Greater Houston' },
  { name: 'Katy', slug: 'katy', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 22000, medianIncome: 90000, tier: 2, region: 'Greater Houston' },
  { name: 'Pearland', slug: 'pearland', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 130000, medianIncome: 88000, tier: 2, region: 'Greater Houston' },
  { name: 'Round Rock', slug: 'round-rock', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 139000, medianIncome: 80000, tier: 2, region: 'Greater Austin' },
  { name: 'Cedar Park', slug: 'cedar-park', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 87000, medianIncome: 95000, tier: 2, region: 'Greater Austin' },
  { name: 'Leander', slug: 'leander', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 72000, medianIncome: 88000, tier: 2, region: 'Greater Austin' },
  { name: 'Houston', slug: 'houston', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 2304000, medianIncome: 52000, tier: 2 },
  { name: 'Dallas', slug: 'dallas', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 1304000, medianIncome: 54000, tier: 2 },
  { name: 'Austin', slug: 'austin', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 979000, medianIncome: 75000, tier: 2 },
  { name: 'San Antonio', slug: 'san-antonio', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 1434000, medianIncome: 52000, tier: 2 },
  { name: 'Fort Worth', slug: 'fort-worth', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 920000, medianIncome: 57000, tier: 2 },
  { name: 'El Paso', slug: 'el-paso', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 678000, medianIncome: 48000, tier: 3 },
  { name: 'Arlington', slug: 'arlington', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 394000, medianIncome: 58000, tier: 3 },
  { name: 'Corpus Christi', slug: 'corpus-christi', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 317000, medianIncome: 52000, tier: 3 },
  { name: 'Lubbock', slug: 'lubbock', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 258000, medianIncome: 50000, tier: 3 },

  // ─────────────────────────────────────────────
  // ILLINOIS — full state build-out, targeted by wealth + population.
  // County, ZIPs, and a unique localBlurb per city (doorway-page mitigation).
  // ─────────────────────────────────────────────

  // — Chicago Core —
  {
    name: 'Chicago', slug: 'chicago', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 2721000, medianIncome: 71000, tier: 1, region: 'Chicagoland area', county: 'Cook',
    zips: ['60601', '60611', '60614', '60657'],
    localBlurb: 'The third-largest city in the nation anchors one of the densest medical and research corridors in the country, home to the University of Chicago, Northwestern University Feinberg School of Medicine, UIC, and the Illinois Medical District on the Near West Side.',
  },

  // — North Shore And North Cook —
  {
    name: 'Evanston', slug: 'evanston', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 75000, medianIncome: 95000, tier: 2, region: 'Chicagoland area', county: 'Cook',
    zips: ['60201', '60202', '60208'],
    localBlurb: 'Evanston is home to Northwestern University and its research enterprise, making the city one of the most active academic research communities on the North Shore.',
  },
  {
    name: 'Wilmette', slug: 'wilmette', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 27000, medianIncome: 170000, tier: 1, region: 'Chicagoland area', county: 'Cook',
    zips: ['60091'],
    localBlurb: 'A lakefront North Shore village known for the Bahai House of Worship and one of the most highly educated populations in the Chicago metro.',
  },
  {
    name: 'Kenilworth', slug: 'kenilworth', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 2500, medianIncome: 250000, tier: 1, region: 'Chicagoland area', county: 'Cook',
    zips: ['60043'],
    localBlurb: 'The smallest and one of the most affluent villages on the North Shore, Kenilworth sits on the Lake Michigan shoreline between Wilmette and Winnetka.',
  },
  {
    name: 'Winnetka', slug: 'winnetka', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 12000, medianIncome: 250000, tier: 1, region: 'Chicagoland area', county: 'Cook',
    zips: ['60093'],
    localBlurb: 'Consistently ranked among the wealthiest communities in the United States, Winnetka combines lakefront estates with the nationally recognized New Trier Township school system.',
  },
  {
    name: 'Glencoe', slug: 'glencoe', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 8800, medianIncome: 235000, tier: 1, region: 'Chicagoland area', county: 'Cook',
    zips: ['60022'],
    localBlurb: 'Home to the Chicago Botanic Garden and a wooded Lake Michigan shoreline, Glencoe is one of the most established affluent villages on the North Shore.',
  },
  {
    name: 'Northfield', slug: 'northfield', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 5700, medianIncome: 150000, tier: 1, region: 'Chicagoland area', county: 'Cook',
    zips: ['60093'],
    localBlurb: 'A compact North Shore village along the Edens corridor with a strong corporate base, including the longtime headquarters campus of Medline Industries.',
  },
  {
    name: 'Northbrook', slug: 'northbrook', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 35000, medianIncome: 145000, tier: 1, region: 'Chicagoland area', county: 'Cook',
    zips: ['60062'],
    localBlurb: 'Northbrook hosts headquarters operations for major firms including UL Solutions and Astellas US, placing it at the center of the north suburban corporate and life-sciences corridor.',
  },
  {
    name: 'Glenview', slug: 'glenview', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 48000, medianIncome: 130000, tier: 1, region: 'Chicagoland area', county: 'Cook',
    zips: ['60025', '60026'],
    localBlurb: 'Built around the redeveloped Glenview Naval Air Station, The Glen district anchors a village that pairs strong household incomes with major medical offices and corporate campuses.',
  },
  {
    name: 'Skokie', slug: 'skokie', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 67000, medianIncome: 90000, tier: 2, region: 'Chicagoland area', county: 'Cook',
    zips: ['60076', '60077'],
    localBlurb: 'Skokie hosts the Illinois Science + Technology Park, a former pharmaceutical research campus, along with Endeavor Health Skokie Hospital.',
  },
  {
    name: 'Park Ridge', slug: 'park-ridge', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 39000, medianIncome: 130000, tier: 1, region: 'Chicagoland area', county: 'Cook',
    zips: ['60068'],
    localBlurb: 'Park Ridge is anchored by Advocate Lutheran General Hospital, one of the largest teaching hospitals in the Chicago suburbs.',
  },

  // — Lake County —
  {
    name: 'Highland Park', slug: 'highland-park', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 30000, medianIncome: 155000, tier: 1, region: 'Chicagoland area', county: 'Lake',
    zips: ['60035'],
    localBlurb: 'Known for the Ravinia Festival, the oldest outdoor music festival in North America, Highland Park is also served by Endeavor Health Highland Park Hospital.',
  },
  {
    name: 'Lake Forest', slug: 'lake-forest', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 19500, medianIncome: 200000, tier: 1, region: 'Chicagoland area', county: 'Lake',
    zips: ['60045'],
    localBlurb: 'One of the Midwest’s classic estate communities, Lake Forest is home to Lake Forest College and Northwestern Medicine Lake Forest Hospital.',
  },
  {
    name: 'Lake Bluff', slug: 'lake-bluff', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 5700, medianIncome: 165000, tier: 1, region: 'Chicagoland area', county: 'Lake',
    zips: ['60044'],
    localBlurb: 'A small lakefront village just north of Lake Forest with a walkable historic downtown and some of the highest household incomes in Lake County.',
  },
  {
    name: 'Deerfield', slug: 'deerfield', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 19000, medianIncome: 165000, tier: 1, region: 'Chicagoland area', county: 'Lake',
    zips: ['60015'],
    localBlurb: 'Deerfield’s corporate campuses include the headquarters of Walgreens Boots Alliance and Baxter International, placing the village at the heart of the north suburban life-sciences corridor.',
  },
  {
    name: 'Riverwoods', slug: 'riverwoods', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 3700, medianIncome: 200000, tier: 1, region: 'Chicagoland area', county: 'Lake',
    zips: ['60015'],
    localBlurb: 'A heavily wooded enclave of estate lots adjacent to Deerfield, Riverwoods is home to the Discover Financial Services headquarters campus.',
  },
  {
    name: 'Lincolnshire', slug: 'lincolnshire', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 7500, medianIncome: 170000, tier: 1, region: 'Chicagoland area', county: 'Lake',
    zips: ['60069'],
    localBlurb: 'Lincolnshire pairs a major corporate office corridor along Milwaukee Avenue with Adlai E. Stevenson High School, one of the top-ranked public schools in Illinois.',
  },
  {
    name: 'Buffalo Grove', slug: 'buffalo-grove', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 43000, medianIncome: 125000, tier: 1, region: 'Chicagoland area', county: 'Lake',
    zips: ['60089'],
    localBlurb: 'Straddling the Lake-Cook county line, Buffalo Grove is a consistently top-rated family suburb with a strong professional and medical office base.',
  },
  {
    name: 'Libertyville', slug: 'libertyville', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 20000, medianIncome: 145000, tier: 1, region: 'Chicagoland area', county: 'Lake',
    zips: ['60048'],
    localBlurb: 'Libertyville’s historic Milwaukee Avenue downtown is complemented by Advocate Condell Medical Center, Lake County’s only Level I trauma center.',
  },
  {
    name: 'Vernon Hills', slug: 'vernon-hills', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 26000, medianIncome: 110000, tier: 2, region: 'Chicagoland area', county: 'Lake',
    zips: ['60061'],
    localBlurb: 'A retail and corporate hub in central Lake County, Vernon Hills grew around the Hawthorn district and hosts major technology employers including the CDW headquarters.',
  },
  {
    name: 'Mundelein', slug: 'mundelein', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 31000, medianIncome: 95000, tier: 2, region: 'Chicagoland area', county: 'Lake',
    zips: ['60060'],
    localBlurb: 'One of Lake County’s larger villages, Mundelein is home to the University of Saint Mary of the Lake and a growing advanced-manufacturing base.',
  },
  {
    name: 'Grayslake', slug: 'grayslake', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 20000, medianIncome: 110000, tier: 2, region: 'Chicagoland area', county: 'Lake',
    zips: ['60030'],
    localBlurb: 'Grayslake hosts the main campus of the College of Lake County and sits at the center of the county’s fast-growing central corridor.',
  },
  {
    name: 'Gurnee', slug: 'gurnee', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 30000, medianIncome: 100000, tier: 2, region: 'Chicagoland area', county: 'Lake',
    zips: ['60031'],
    localBlurb: 'Best known for Six Flags Great America and Gurnee Mills, Gurnee draws regional traffic from across the Illinois-Wisconsin border.',
  },
  {
    name: 'Lake Zurich', slug: 'lake-zurich', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 19800, medianIncome: 125000, tier: 2, region: 'Chicagoland area', county: 'Lake',
    zips: ['60047'],
    localBlurb: 'A lakeside community in southwestern Lake County with strong schools and household incomes well above the metro average.',
  },
  {
    name: 'Long Grove', slug: 'long-grove', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 8000, medianIncome: 190000, tier: 1, region: 'Chicagoland area', county: 'Lake',
    zips: ['60047'],
    localBlurb: 'Long Grove preserves a historic crossroads downtown surrounded by estate-lot neighborhoods, making it one of the wealthiest communities in Lake County.',
  },
  {
    name: 'Hawthorn Woods', slug: 'hawthorn-woods', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 9800, medianIncome: 200000, tier: 1, region: 'Chicagoland area', county: 'Lake',
    zips: ['60047'],
    localBlurb: 'An estate-lot village in the Ela Township countryside, Hawthorn Woods ranks among the highest-income communities in the Chicago metro.',
  },
  {
    name: 'Kildeer', slug: 'kildeer', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 4000, medianIncome: 220000, tier: 1, region: 'Chicagoland area', county: 'Lake',
    zips: ['60047'],
    localBlurb: 'A low-density village of wooded estate parcels near Deer Park Town Center, Kildeer has among the highest household incomes in Illinois.',
  },
  {
    name: 'Deer Park', slug: 'deer-park', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 3200, medianIncome: 180000, tier: 1, region: 'Chicagoland area', county: 'Lake',
    zips: ['60010'],
    localBlurb: 'Deer Park combines the Deer Park Town Center lifestyle district with large-lot residential neighborhoods on the Lake-Cook county line.',
  },

  // — Barrington Area And Northwest Cook —
  {
    name: 'Barrington', slug: 'barrington', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 10300, medianIncome: 130000, tier: 1, region: 'Chicagoland area', county: 'Cook',
    zips: ['60010'],
    localBlurb: 'The historic center of the affluent Barrington area, served by Advocate Good Shepherd Hospital and a Metra-anchored downtown.',
  },
  {
    name: 'South Barrington', slug: 'south-barrington', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 5000, medianIncome: 230000, tier: 1, region: 'Chicagoland area', county: 'Cook',
    zips: ['60010'],
    localBlurb: 'A gated-estate community anchoring the western Barrington area, with the Arboretum of South Barrington as its retail centerpiece.',
  },
  {
    name: 'Barrington Hills', slug: 'barrington-hills', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 4200, medianIncome: 200000, tier: 1, region: 'Chicagoland area', county: 'Cook',
    zips: ['60010'],
    localBlurb: 'Famous for equestrian estates on minimum five-acre zoning, Barrington Hills spans four counties of rolling countryside northwest of Chicago.',
  },
  {
    name: 'Inverness', slug: 'inverness', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 7600, medianIncome: 190000, tier: 1, region: 'Chicagoland area', county: 'Cook',
    zips: ['60067'],
    localBlurb: 'A winding-lane estate community adjacent to Palatine, Inverness is one of the most affluent villages in northwest Cook County.',
  },
  {
    name: 'Arlington Heights', slug: 'arlington-heights', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 77000, medianIncome: 110000, tier: 2, region: 'Chicagoland area', county: 'Cook',
    zips: ['60004', '60005'],
    localBlurb: 'The largest village in Illinois, Arlington Heights is anchored by Endeavor Health Northwest Community Hospital and the landmark Arlington Park redevelopment site.',
  },
  {
    name: 'Palatine', slug: 'palatine', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 65000, medianIncome: 95000, tier: 2, region: 'Chicagoland area', county: 'Cook',
    zips: ['60067', '60074'],
    localBlurb: 'Palatine is home to Harper College, one of the largest community colleges in Illinois, and a dense professional-services employment base.',
  },
  {
    name: 'Mount Prospect', slug: 'mount-prospect', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 56000, medianIncome: 100000, tier: 2, region: 'Chicagoland area', county: 'Cook',
    zips: ['60056'],
    localBlurb: 'A large northwest suburb on the UP Northwest Metra line with a revitalized downtown and household incomes above the metro average.',
  },
  {
    name: 'Hoffman Estates', slug: 'hoffman-estates', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 52000, medianIncome: 100000, tier: 2, region: 'Chicagoland area', county: 'Cook',
    zips: ['60169', '60192'],
    localBlurb: 'Hoffman Estates hosts Ascension Saint Alexius Medical Center and the NOW Arena entertainment district on the I-90 corridor.',
  },
  {
    name: 'Elk Grove Village', slug: 'elk-grove-village', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 32000, medianIncome: 95000, tier: 2, region: 'Chicagoland area', county: 'Cook',
    zips: ['60007'],
    localBlurb: 'Home to the largest consolidated business park in North America, Elk Grove Village is a logistics and light-manufacturing powerhouse beside O’Hare.',
  },
  {
    name: 'Schaumburg', slug: 'schaumburg', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 78000, medianIncome: 90000, tier: 2, region: 'Chicagoland area', county: 'Cook',
    zips: ['60173', '60193'],
    localBlurb: 'Schaumburg’s Woodfield corridor is one of the largest suburban employment and retail centers in the United States.',
  },
  {
    name: 'Des Plaines', slug: 'des-plaines', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 60000, medianIncome: 82000, tier: 3, region: 'Chicagoland area', county: 'Cook',
    zips: ['60016', '60018'],
    localBlurb: 'A dense, transit-served suburb beside O’Hare International Airport with a large healthcare and logistics workforce.',
  },

  // — McHenry County —
  {
    name: 'Crystal Lake', slug: 'crystal-lake', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 40000, medianIncome: 100000, tier: 2, region: 'Chicagoland area', county: 'McHenry',
    zips: ['60012', '60014'],
    localBlurb: 'McHenry County’s commercial hub, built around its namesake lake, with Northwestern Medicine facilities serving the surrounding region.',
  },
  {
    name: 'Algonquin', slug: 'algonquin', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 30000, medianIncome: 120000, tier: 2, region: 'Chicagoland area', county: 'McHenry',
    zips: ['60102'],
    localBlurb: 'A Fox River community on the Randall Road retail corridor with household incomes well above the Chicago metro average.',
  },
  {
    name: 'Lake In The Hills', slug: 'lake-in-the-hills', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 28000, medianIncome: 110000, tier: 2, region: 'Chicagoland area', county: 'McHenry',
    zips: ['60156'],
    localBlurb: 'One of McHenry County’s fastest-grown suburbs, Lake In The Hills pairs newer subdivisions with its own regional airport.',
  },
  {
    name: 'Cary', slug: 'cary', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 18000, medianIncome: 115000, tier: 2, region: 'Chicagoland area', county: 'McHenry',
    zips: ['60013'],
    localBlurb: 'A Fox River valley community on the UP Northwest Metra line with strong family demographics and hilly, wooded neighborhoods.',
  },
  {
    name: 'Huntley', slug: 'huntley', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 28000, medianIncome: 95000, tier: 2, region: 'Chicagoland area', county: 'McHenry',
    zips: ['60142'],
    localBlurb: 'Huntley is home to Northwestern Medicine Huntley Hospital and the large Del Webb Sun City community on the I-90 corridor.',
  },
  {
    name: 'McHenry', slug: 'mchenry', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 27000, medianIncome: 85000, tier: 3, region: 'Chicagoland area', county: 'McHenry',
    zips: ['60050', '60051'],
    localBlurb: 'The Fox River city that gives its county its name, served by Northwestern Medicine McHenry Hospital.',
  },

  // — Kane County And Fox Valley —
  {
    name: 'St. Charles', slug: 'st-charles', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 33000, medianIncome: 120000, tier: 1, region: 'Chicagoland area', county: 'Kane',
    zips: ['60174', '60175'],
    localBlurb: 'A historic Fox River downtown anchors St. Charles, the centerpiece of the affluent Tri-Cities corridor in Kane County.',
  },
  {
    name: 'Geneva', slug: 'geneva', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 21500, medianIncome: 130000, tier: 1, region: 'Chicagoland area', county: 'Kane',
    zips: ['60134'],
    localBlurb: 'Geneva pairs a boutique Third Street downtown with Northwestern Medicine Delnor Hospital, serving the affluent Fox Valley Tri-Cities.',
  },
  {
    name: 'Batavia', slug: 'batavia', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 26000, medianIncome: 115000, tier: 2, region: 'Chicagoland area', county: 'Kane',
    zips: ['60510'],
    localBlurb: 'Batavia is home to Fermilab, the national particle-physics laboratory, giving the city one of the strongest pure-research identities in Illinois.',
  },
  {
    name: 'Campton Hills', slug: 'campton-hills', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 11000, medianIncome: 165000, tier: 1, region: 'Chicagoland area', county: 'Kane',
    zips: ['60175'],
    localBlurb: 'An estate-lot village west of St. Charles with some of the highest household incomes in Kane County.',
  },
  {
    name: 'South Elgin', slug: 'south-elgin', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 23000, medianIncome: 100000, tier: 2, region: 'Chicagoland area', county: 'Kane',
    zips: ['60177'],
    localBlurb: 'A growing Fox River suburb between Elgin and St. Charles on the Randall Road medical and retail corridor.',
  },
  {
    name: 'Elgin', slug: 'elgin', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 114000, medianIncome: 75000, tier: 3, region: 'Chicagoland area', county: 'Kane',
    zips: ['60120', '60123', '60124'],
    localBlurb: 'One of the Fox Valley’s principal cities, Elgin is served by Advocate Sherman Hospital and Ascension Saint Joseph.',
  },
  {
    name: 'Aurora', slug: 'aurora', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 178000, medianIncome: 85000, tier: 2, region: 'Chicagoland area', county: 'Kane',
    zips: ['60502', '60504', '60505', '60506'],
    localBlurb: 'The second-largest city in Illinois spans four counties and is served by Rush Copley Medical Center and Ascension Mercy.',
  },
  {
    name: 'Bartlett', slug: 'bartlett', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 40000, medianIncome: 120000, tier: 2, region: 'Chicagoland area', county: 'Cook',
    zips: ['60103'],
    localBlurb: 'A tri-county residential suburb with strong incomes, centered on its Metra downtown along the Milwaukee District West line.',
  },
  {
    name: 'Carol Stream', slug: 'carol-stream', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 39000, medianIncome: 95000, tier: 2, region: 'Chicagoland area', county: 'DuPage',
    zips: ['60188'],
    localBlurb: 'A DuPage County village with a major distribution and light-industrial base and quick access to the I-355 corridor.',
  },
  {
    name: 'Bloomingdale', slug: 'bloomingdale', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 22000, medianIncome: 100000, tier: 2, region: 'Chicagoland area', county: 'DuPage',
    zips: ['60108'],
    localBlurb: 'Home to the Stratford Square area and the Indian Lakes district, Bloomingdale is a stable, high-income DuPage suburb.',
  },
  {
    name: 'Roselle', slug: 'roselle', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 23000, medianIncome: 100000, tier: 2, region: 'Chicagoland area', county: 'DuPage',
    zips: ['60172'],
    localBlurb: 'A commuter village on the Milwaukee District West Metra line straddling the DuPage-Cook county line.',
  },

  // — DuPage County —
  {
    name: 'Naperville', slug: 'naperville', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 149000, medianIncome: 145000, tier: 1, region: 'Chicagoland area', county: 'DuPage',
    zips: ['60540', '60563', '60564', '60565'],
    localBlurb: 'Regularly ranked among the best places to live in America, Naperville is anchored by Endeavor Health Edward Hospital, North Central College, and the I-88 research and technology corridor.',
  },
  {
    name: 'Wheaton', slug: 'wheaton', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 53000, medianIncome: 115000, tier: 2, region: 'Chicagoland area', county: 'DuPage',
    zips: ['60187', '60189'],
    localBlurb: 'The DuPage County seat and home of Wheaton College, with a classic Metra-served downtown at the center of the county.',
  },
  {
    name: 'Glen Ellyn', slug: 'glen-ellyn', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 28000, medianIncome: 135000, tier: 1, region: 'Chicagoland area', county: 'DuPage',
    zips: ['60137'],
    localBlurb: 'Glen Ellyn hosts the College of DuPage, one of the largest community colleges in the nation, beside a historic lakeside downtown.',
  },
  {
    name: 'Elmhurst', slug: 'elmhurst', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 46000, medianIncome: 135000, tier: 1, region: 'Chicagoland area', county: 'DuPage',
    zips: ['60126'],
    localBlurb: 'Elmhurst pairs Elmhurst University and Endeavor Health Elmhurst Hospital with one of the strongest downtowns in DuPage County.',
  },
  {
    name: 'Lombard', slug: 'lombard', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 44000, medianIncome: 95000, tier: 2, region: 'Chicagoland area', county: 'DuPage',
    zips: ['60148'],
    localBlurb: 'The Lilac Village is a central DuPage suburb with a large healthcare and professional-services workforce along the I-88 corridor.',
  },
  {
    name: 'Lisle', slug: 'lisle', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 24000, medianIncome: 100000, tier: 2, region: 'Chicagoland area', county: 'DuPage',
    zips: ['60532'],
    localBlurb: 'Lisle sits in the heart of the I-88 corporate corridor and is home to Benedictine University and the Morton Arboretum.',
  },
  {
    name: 'Downers Grove', slug: 'downers-grove', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 50000, medianIncome: 115000, tier: 2, region: 'Chicagoland area', county: 'DuPage',
    zips: ['60515', '60516'],
    localBlurb: 'A major BNSF commuter suburb anchored by Advocate Good Samaritan Hospital and a thriving historic downtown.',
  },
  {
    name: 'Woodridge', slug: 'woodridge', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 34000, medianIncome: 95000, tier: 2, region: 'Chicagoland area', county: 'DuPage',
    zips: ['60517'],
    localBlurb: 'A south-central DuPage suburb with a large corporate-park base along I-355 and the Seven Bridges district.',
  },
  {
    name: 'Darien', slug: 'darien', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 22000, medianIncome: 105000, tier: 2, region: 'Chicagoland area', county: 'DuPage',
    zips: ['60561'],
    localBlurb: 'A quiet southeast DuPage suburb minutes from the Argonne research corridor and the I-55 employment belt.',
  },
  {
    name: 'Clarendon Hills', slug: 'clarendon-hills', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 8700, medianIncome: 165000, tier: 1, region: 'Chicagoland area', county: 'DuPage',
    zips: ['60514'],
    localBlurb: 'A small BNSF commuter village between Hinsdale and Westmont with a walkable downtown and top-tier schools.',
  },
  {
    name: 'Winfield', slug: 'winfield', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 10000, medianIncome: 125000, tier: 2, region: 'Chicagoland area', county: 'DuPage',
    zips: ['60190'],
    localBlurb: 'Winfield is anchored by Northwestern Medicine Central DuPage Hospital, one of the largest hospitals in the western suburbs.',
  },
  {
    name: 'Oak Brook', slug: 'oak-brook', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 8200, medianIncome: 145000, tier: 1, region: 'Chicagoland area', county: 'DuPage',
    zips: ['60523'],
    localBlurb: 'A corporate-headquarters village anchored by Oakbrook Center, one of the largest open-air shopping centers in the country.',
  },
  {
    name: 'Burr Ridge', slug: 'burr-ridge', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 11000, medianIncome: 165000, tier: 1, region: 'Chicagoland area', county: 'DuPage',
    zips: ['60527'],
    localBlurb: 'An affluent I-55 corridor village of executive homes centered on the Burr Ridge Village Center lifestyle district.',
  },
  {
    name: 'Hinsdale', slug: 'hinsdale', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 17500, medianIncome: 220000, tier: 1, region: 'Chicagoland area', county: 'DuPage',
    zips: ['60521'],
    localBlurb: 'One of Chicago’s wealthiest suburbs, Hinsdale is home to UChicago Medicine AdventHealth Hinsdale and a landmark BNSF downtown.',
  },

  // — West Cook —
  {
    name: 'Oak Park', slug: 'oak-park', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 52000, medianIncome: 105000, tier: 2, region: 'Chicagoland area', county: 'Cook',
    zips: ['60301', '60302', '60304'],
    localBlurb: 'Famous for the world’s largest collection of Frank Lloyd Wright buildings, Oak Park is served by Rush Oak Park Hospital.',
  },
  {
    name: 'River Forest', slug: 'river-forest', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 11000, medianIncome: 155000, tier: 1, region: 'Chicagoland area', county: 'Cook',
    zips: ['60305'],
    localBlurb: 'A leafy village of landmark homes adjacent to Oak Park, home to Dominican University and Concordia University Chicago.',
  },
  {
    name: 'Riverside', slug: 'riverside', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 9000, medianIncome: 120000, tier: 2, region: 'Chicagoland area', county: 'Cook',
    zips: ['60546'],
    localBlurb: 'A National Historic Landmark village designed by Frederick Law Olmsted, whose curvilinear plan shaped American suburb design.',
  },
  {
    name: 'Western Springs', slug: 'western-springs', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 13000, medianIncome: 190000, tier: 1, region: 'Chicagoland area', county: 'Cook',
    zips: ['60558'],
    localBlurb: 'A BNSF commuter village known for its historic water tower downtown and consistently top-ranked public schools.',
  },
  {
    name: 'La Grange', slug: 'la-grange', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 16000, medianIncome: 145000, tier: 1, region: 'Chicagoland area', county: 'Cook',
    zips: ['60525'],
    localBlurb: 'La Grange’s historic downtown and UChicago Medicine AdventHealth La Grange anchor the near-west BNSF corridor.',
  },

  // — Southwest Cook —
  {
    name: 'Oak Lawn', slug: 'oak-lawn', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 55000, medianIncome: 78000, tier: 2, region: 'Chicagoland area', county: 'Cook',
    zips: ['60453'],
    localBlurb: 'Oak Lawn is anchored by Advocate Christ Medical Center, a Level I trauma center and one of the busiest teaching hospitals in the Chicago area.',
  },
  {
    name: 'Orland Park', slug: 'orland-park', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 58000, medianIncome: 100000, tier: 2, region: 'Chicagoland area', county: 'Cook',
    zips: ['60462', '60467'],
    localBlurb: 'The retail and medical hub of the southwest suburbs, with major outpatient campuses operated by the region’s largest health systems.',
  },
  {
    name: 'Tinley Park', slug: 'tinley-park', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 55000, medianIncome: 95000, tier: 2, region: 'Chicagoland area', county: 'Cook',
    zips: ['60477', '60487'],
    localBlurb: 'Home to one of the region’s largest outdoor concert venues and a growing Metra-served downtown in the Southland.',
  },
  {
    name: 'Palos Park', slug: 'palos-park', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 5900, medianIncome: 130000, tier: 1, region: 'Chicagoland area', county: 'Cook',
    zips: ['60464'],
    localBlurb: 'A wooded village surrounded by the Palos forest preserves, the largest preserve holdings in Cook County.',
  },
  {
    name: 'Palos Heights', slug: 'palos-heights', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 12000, medianIncome: 105000, tier: 2, region: 'Chicagoland area', county: 'Cook',
    zips: ['60463'],
    localBlurb: 'Home to Trinity Christian College and Northwestern Medicine Palos Hospital along the Route 83 corridor.',
  },

  // — Will County And Southwest Corridor —
  {
    name: 'Frankfort', slug: 'frankfort', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 21000, medianIncome: 145000, tier: 1, region: 'Chicagoland area', county: 'Will',
    zips: ['60423'],
    localBlurb: 'A historic downtown along the Old Plank Road Trail anchors Frankfort, one of the most affluent communities in the south suburbs.',
  },
  {
    name: 'Mokena', slug: 'mokena', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 20000, medianIncome: 120000, tier: 2, region: 'Chicagoland area', county: 'Will',
    zips: ['60448'],
    localBlurb: 'A Rock Island line commuter village with strong household incomes in the fast-growing southwest corridor.',
  },
  {
    name: 'New Lenox', slug: 'new-lenox', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 27000, medianIncome: 120000, tier: 2, region: 'Chicagoland area', county: 'Will',
    zips: ['60451'],
    localBlurb: 'New Lenox is served by Silver Cross Hospital, a major regional medical center on the Route 6 corridor.',
  },
  {
    name: 'Lemont', slug: 'lemont', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 18000, medianIncome: 125000, tier: 2, region: 'Chicagoland area', county: 'Cook',
    zips: ['60439'],
    localBlurb: 'Lemont sits beside Argonne National Laboratory, one of the nation’s premier federal research facilities, above the historic I&M Canal.',
  },
  {
    name: 'Homer Glen', slug: 'homer-glen', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 24000, medianIncome: 125000, tier: 2, region: 'Chicagoland area', county: 'Will',
    zips: ['60491'],
    localBlurb: 'A large-lot Will County community incorporated in 2001, with among the highest household incomes in the Southland.',
  },
  {
    name: 'Lockport', slug: 'lockport', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 26000, medianIncome: 95000, tier: 2, region: 'Chicagoland area', county: 'Will',
    zips: ['60441'],
    localBlurb: 'A historic I&M Canal town turned fast-growing suburb, minutes from the Silver Cross medical corridor.',
  },
  {
    name: 'Bolingbrook', slug: 'bolingbrook', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 74000, medianIncome: 95000, tier: 2, region: 'Chicagoland area', county: 'Will',
    zips: ['60440', '60490'],
    localBlurb: 'One of the largest southwest suburbs, served by UChicago Medicine AdventHealth Bolingbrook and a major I-55 corporate corridor.',
  },
  {
    name: 'Romeoville', slug: 'romeoville', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 40000, medianIncome: 85000, tier: 3, region: 'Chicagoland area', county: 'Will',
    zips: ['60446'],
    localBlurb: 'Home to Lewis University and a major I-55 logistics corridor in the heart of Will County.',
  },
  {
    name: 'Plainfield', slug: 'plainfield', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 45000, medianIncome: 130000, tier: 1, region: 'Chicagoland area', county: 'Will',
    zips: ['60544', '60585', '60586'],
    localBlurb: 'One of the fastest-growing communities in Illinois over the past two decades, with a rebuilt historic downtown along Route 59.',
  },
  {
    name: 'Shorewood', slug: 'shorewood', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 18500, medianIncome: 105000, tier: 2, region: 'Chicagoland area', county: 'Will',
    zips: ['60404'],
    localBlurb: 'A growing DuPage River community west of Joliet at the I-55 and Route 59 junction.',
  },
  {
    name: 'Joliet', slug: 'joliet', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 150000, medianIncome: 75000, tier: 3, region: 'Chicagoland area', county: 'Will',
    zips: ['60431', '60432', '60435'],
    localBlurb: 'The historic heart of Will County, served by Ascension Saint Joseph - Joliet and home to the University of St. Francis.',
  },

  // — Kendall County —
  {
    name: 'Oswego', slug: 'oswego', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 35000, medianIncome: 115000, tier: 2, region: 'Chicagoland area', county: 'Kendall',
    zips: ['60543'],
    localBlurb: 'Kendall County’s largest community, Oswego combines two decades of rapid growth with a historic Fox River downtown.',
  },
  {
    name: 'Yorkville', slug: 'yorkville', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 24000, medianIncome: 105000, tier: 2, region: 'Chicagoland area', county: 'Kendall',
    zips: ['60560'],
    localBlurb: 'The Kendall County seat on the Fox River, one of the fastest-growing county centers in the state.',
  },

  // — Northern Illinois —
  {
    name: 'Rockford', slug: 'rockford', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 147000, medianIncome: 55000, tier: 3, region: 'Northern Illinois', county: 'Winnebago',
    zips: ['61101', '61107', '61108'],
    localBlurb: 'A northern Illinois manufacturing and aerospace hub served by three hospital systems and the University of Illinois College of Medicine Rockford.',
  },

  // — Central Illinois —
  {
    name: 'Springfield', slug: 'springfield', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 114000, medianIncome: 62000, tier: 3, region: 'Central Illinois', county: 'Sangamon',
    zips: ['62701', '62704', '62711'],
    localBlurb: 'The state capital is home to SIU School of Medicine, HSHS St. John’s Hospital, and Springfield Memorial Hospital, one of the largest medical hubs downstate.',
  },
  {
    name: 'Peoria', slug: 'peoria', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 111000, medianIncome: 58000, tier: 3, region: 'Central Illinois', county: 'Peoria',
    zips: ['61604', '61614', '61615'],
    localBlurb: 'A longstanding medical center for downstate Illinois, Peoria is home to OSF HealthCare headquarters and the University of Illinois College of Medicine Peoria.',
  },
  {
    name: 'Morton', slug: 'morton', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 17000, medianIncome: 90000, tier: 2, region: 'Central Illinois', county: 'Tazewell',
    zips: ['61550'],
    localBlurb: 'The Pumpkin Capital of the World is an affluent Peoria-area suburb with major Caterpillar distribution operations.',
  },
  {
    name: 'Mahomet', slug: 'mahomet', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 9500, medianIncome: 115000, tier: 2, region: 'Central Illinois', county: 'Champaign',
    zips: ['61853'],
    localBlurb: 'The fastest-growing community in Champaign County, popular with university and research-park professionals.',
  },
  {
    name: 'Champaign', slug: 'champaign', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 89000, medianIncome: 60000, tier: 3, region: 'Central Illinois', county: 'Champaign',
    zips: ['61820', '61821', '61822'],
    localBlurb: 'Home to the University of Illinois Urbana-Champaign, its Research Park, and the Carle Health system, Champaign anchors one of the top public research universities in the world.',
  },
  {
    name: 'Bloomington', slug: 'bloomington', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 79000, medianIncome: 75000, tier: 3, region: 'Central Illinois', county: 'McLean',
    zips: ['61701', '61704'],
    localBlurb: 'The home of State Farm’s headquarters and Illinois Wesleyan University, served by Carle BroMenn and OSF St. Joseph medical centers.',
  },
  {
    name: 'Normal', slug: 'normal', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 53000, medianIncome: 60000, tier: 3, region: 'Central Illinois', county: 'McLean',
    zips: ['61761'],
    localBlurb: 'Home to Illinois State University and Rivian’s flagship manufacturing plant, Normal is half of the twin-city Bloomington-Normal metro.',
  },
  {
    name: 'Decatur', slug: 'decatur', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 69000, medianIncome: 55000, tier: 3, region: 'Central Illinois', county: 'Macon',
    zips: ['62521', '62526'],
    localBlurb: 'A manufacturing and agribusiness center anchored by ADM’s North American headquarters and Millikin University.',
  },

  // — Metro East And Quad Cities —
  {
    name: 'Edwardsville', slug: 'edwardsville', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 26000, medianIncome: 90000, tier: 2, region: 'Metro East', county: 'Madison',
    zips: ['62025'],
    localBlurb: 'Home to Southern Illinois University Edwardsville, the principal university campus of the Metro East.',
  },
  {
    name: "O'Fallon", slug: 'ofallon', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 32000, medianIncome: 100000, tier: 2, region: 'Metro East', county: 'St. Clair',
    zips: ['62269'],
    localBlurb: "One of the fastest-growing cities in southern Illinois, adjacent to Scott Air Force Base and home to HSHS St. Elizabeth's Hospital.",
  },
  {
    name: 'Belleville', slug: 'belleville', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 42000, medianIncome: 60000, tier: 3, region: 'Metro East', county: 'St. Clair',
    zips: ['62220', '62221', '62223'],
    localBlurb: 'The St. Clair County seat and historic center of the Metro East, served by Memorial Hospital Belleville.',
  },
  {
    name: 'Moline', slug: 'moline', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 42000, medianIncome: 62000, tier: 3, region: 'Quad Cities', county: 'Rock Island',
    zips: ['61265'],
    localBlurb: 'Part of the Quad Cities, Moline is home to John Deere’s world headquarters and a UnityPoint Health regional campus.',
  },

  // ─────────────────────────────────────────────
  // NEW YORK
  // ─────────────────────────────────────────────
  { name: 'New York City', slug: 'new-york-city', state: 'New York', stateSlug: 'new-york', stateAbbr: 'NY', population: 8336000, medianIncome: 70000, tier: 1 },
  { name: 'Greenwich', slug: 'greenwich', state: 'Connecticut', stateSlug: 'connecticut', stateAbbr: 'CT', population: 63000, medianIncome: 130000, tier: 1 },
  { name: 'Scarsdale', slug: 'scarsdale', state: 'New York', stateSlug: 'new-york', stateAbbr: 'NY', population: 17000, medianIncome: 200000, tier: 1 },
  { name: 'Bronxville', slug: 'bronxville', state: 'New York', stateSlug: 'new-york', stateAbbr: 'NY', population: 6500, medianIncome: 175000, tier: 1 },
  { name: 'Great Neck', slug: 'great-neck', state: 'New York', stateSlug: 'new-york', stateAbbr: 'NY', population: 10000, medianIncome: 120000, tier: 1 },
  { name: 'Manhasset', slug: 'manhasset', state: 'New York', stateSlug: 'new-york', stateAbbr: 'NY', population: 8000, medianIncome: 155000, tier: 1 },
  { name: 'Southampton', slug: 'southampton', state: 'New York', stateSlug: 'new-york', stateAbbr: 'NY', population: 3500, medianIncome: 110000, tier: 1 },
  { name: 'East Hampton', slug: 'east-hampton', state: 'New York', stateSlug: 'new-york', stateAbbr: 'NY', population: 1200, medianIncome: 130000, tier: 1 },
  { name: 'White Plains', slug: 'white-plains', state: 'New York', stateSlug: 'new-york', stateAbbr: 'NY', population: 60000, medianIncome: 70000, tier: 2 },
  { name: 'Yonkers', slug: 'yonkers', state: 'New York', stateSlug: 'new-york', stateAbbr: 'NY', population: 212000, medianIncome: 60000, tier: 3 },
  { name: 'Buffalo', slug: 'buffalo', state: 'New York', stateSlug: 'new-york', stateAbbr: 'NY', population: 277000, medianIncome: 40000, tier: 3 },
  { name: 'Albany', slug: 'albany', state: 'New York', stateSlug: 'new-york', stateAbbr: 'NY', population: 99000, medianIncome: 48000, tier: 3 },
  { name: 'Rochester', slug: 'rochester', state: 'New York', stateSlug: 'new-york', stateAbbr: 'NY', population: 211000, medianIncome: 37000, tier: 3 },

  // ─────────────────────────────────────────────
  // CONNECTICUT
  // ─────────────────────────────────────────────
  { name: 'Westport', slug: 'westport', state: 'Connecticut', stateSlug: 'connecticut', stateAbbr: 'CT', population: 28000, medianIncome: 165000, tier: 1 },
  { name: 'Darien', slug: 'darien', state: 'Connecticut', stateSlug: 'connecticut', stateAbbr: 'CT', population: 22000, medianIncome: 200000, tier: 1 },
  { name: 'New Canaan', slug: 'new-canaan', state: 'Connecticut', stateSlug: 'connecticut', stateAbbr: 'CT', population: 20000, medianIncome: 215000, tier: 1 },
  { name: 'Wilton', slug: 'wilton', state: 'Connecticut', stateSlug: 'connecticut', stateAbbr: 'CT', population: 18000, medianIncome: 165000, tier: 1 },
  { name: 'Fairfield', slug: 'fairfield', state: 'Connecticut', stateSlug: 'connecticut', stateAbbr: 'CT', population: 61000, medianIncome: 110000, tier: 2 },
  { name: 'Stamford', slug: 'stamford', state: 'Connecticut', stateSlug: 'connecticut', stateAbbr: 'CT', population: 135000, medianIncome: 85000, tier: 2 },
  { name: 'Hartford', slug: 'hartford', state: 'Connecticut', stateSlug: 'connecticut', stateAbbr: 'CT', population: 122000, medianIncome: 37000, tier: 3 },
  { name: 'New Haven', slug: 'new-haven', state: 'Connecticut', stateSlug: 'connecticut', stateAbbr: 'CT', population: 135000, medianIncome: 42000, tier: 3 },

  // ─────────────────────────────────────────────
  // GEORGIA
  // ─────────────────────────────────────────────
  { name: 'Alpharetta', slug: 'alpharetta', state: 'Georgia', stateSlug: 'georgia', stateAbbr: 'GA', population: 67000, medianIncome: 115000, tier: 1, region: 'Greater Atlanta' },
  { name: 'Johns Creek', slug: 'johns-creek', state: 'Georgia', stateSlug: 'georgia', stateAbbr: 'GA', population: 83000, medianIncome: 110000, tier: 1, region: 'Greater Atlanta' },
  { name: 'Roswell', slug: 'roswell', state: 'Georgia', stateSlug: 'georgia', stateAbbr: 'GA', population: 95000, medianIncome: 90000, tier: 2, region: 'Greater Atlanta' },
  { name: 'Sandy Springs', slug: 'sandy-springs', state: 'Georgia', stateSlug: 'georgia', stateAbbr: 'GA', population: 110000, medianIncome: 85000, tier: 2, region: 'Greater Atlanta' },
  { name: 'Milton', slug: 'milton', state: 'Georgia', stateSlug: 'georgia', stateAbbr: 'GA', population: 42000, medianIncome: 140000, tier: 1, region: 'Greater Atlanta' },
  { name: 'Dunwoody', slug: 'dunwoody', state: 'Georgia', stateSlug: 'georgia', stateAbbr: 'GA', population: 50000, medianIncome: 92000, tier: 2, region: 'Greater Atlanta' },
  { name: 'Atlanta', slug: 'atlanta', state: 'Georgia', stateSlug: 'georgia', stateAbbr: 'GA', population: 498000, medianIncome: 65000, tier: 2 },
  { name: 'Savannah', slug: 'savannah', state: 'Georgia', stateSlug: 'georgia', stateAbbr: 'GA', population: 147000, medianIncome: 50000, tier: 3 },
  { name: 'Augusta', slug: 'augusta', state: 'Georgia', stateSlug: 'georgia', stateAbbr: 'GA', population: 200000, medianIncome: 44000, tier: 3 },

  // ─────────────────────────────────────────────
  // COLORADO
  // ─────────────────────────────────────────────
  { name: 'Aspen', slug: 'aspen', state: 'Colorado', stateSlug: 'colorado', stateAbbr: 'CO', population: 7500, medianIncome: 120000, tier: 1 },
  { name: 'Vail', slug: 'vail', state: 'Colorado', stateSlug: 'colorado', stateAbbr: 'CO', population: 5500, medianIncome: 90000, tier: 1 },
  { name: 'Boulder', slug: 'boulder', state: 'Colorado', stateSlug: 'colorado', stateAbbr: 'CO', population: 106000, medianIncome: 80000, tier: 1 },
  { name: 'Cherry Hills Village', slug: 'cherry-hills-village', state: 'Colorado', stateSlug: 'colorado', stateAbbr: 'CO', population: 6500, medianIncome: 220000, tier: 1, region: 'Greater Denver' },
  { name: 'Greenwood Village', slug: 'greenwood-village', state: 'Colorado', stateSlug: 'colorado', stateAbbr: 'CO', population: 16000, medianIncome: 155000, tier: 1, region: 'Greater Denver' },
  { name: 'Parker', slug: 'parker', state: 'Colorado', stateSlug: 'colorado', stateAbbr: 'CO', population: 65000, medianIncome: 102000, tier: 2, region: 'Greater Denver' },
  { name: 'Centennial', slug: 'centennial', state: 'Colorado', stateSlug: 'colorado', stateAbbr: 'CO', population: 108000, medianIncome: 97000, tier: 2, region: 'Greater Denver' },
  { name: 'Highlands Ranch', slug: 'highlands-ranch', state: 'Colorado', stateSlug: 'colorado', stateAbbr: 'CO', population: 96000, medianIncome: 112000, tier: 2, region: 'Greater Denver' },
  { name: 'Denver', slug: 'denver', state: 'Colorado', stateSlug: 'colorado', stateAbbr: 'CO', population: 735000, medianIncome: 72000, tier: 2 },
  { name: 'Colorado Springs', slug: 'colorado-springs', state: 'Colorado', stateSlug: 'colorado', stateAbbr: 'CO', population: 482000, medianIncome: 62000, tier: 2 },
  { name: 'Fort Collins', slug: 'fort-collins', state: 'Colorado', stateSlug: 'colorado', stateAbbr: 'CO', population: 169000, medianIncome: 62000, tier: 3 },
  { name: 'Steamboat Springs', slug: 'steamboat-springs', state: 'Colorado', stateSlug: 'colorado', stateAbbr: 'CO', population: 13000, medianIncome: 72000, tier: 2 },

  // ─────────────────────────────────────────────
  // WASHINGTON
  // ─────────────────────────────────────────────
  { name: 'Bellevue', slug: 'bellevue', state: 'Washington', stateSlug: 'washington', stateAbbr: 'WA', population: 148000, medianIncome: 120000, tier: 1, region: 'Greater Seattle' },
  { name: 'Mercer Island', slug: 'mercer-island', state: 'Washington', stateSlug: 'washington', stateAbbr: 'WA', population: 25000, medianIncome: 175000, tier: 1, region: 'Greater Seattle' },
  { name: 'Medina', slug: 'medina', state: 'Washington', stateSlug: 'washington', stateAbbr: 'WA', population: 3100, medianIncome: 220000, tier: 1, region: 'Greater Seattle' },
  { name: 'Kirkland', slug: 'kirkland', state: 'Washington', stateSlug: 'washington', stateAbbr: 'WA', population: 93000, medianIncome: 95000, tier: 2, region: 'Greater Seattle' },
  { name: 'Redmond', slug: 'redmond', state: 'Washington', stateSlug: 'washington', stateAbbr: 'WA', population: 69000, medianIncome: 100000, tier: 2, region: 'Greater Seattle' },
  { name: 'Sammamish', slug: 'sammamish', state: 'Washington', stateSlug: 'washington', stateAbbr: 'WA', population: 69000, medianIncome: 145000, tier: 1, region: 'Greater Seattle' },
  { name: 'Issaquah', slug: 'issaquah', state: 'Washington', stateSlug: 'washington', stateAbbr: 'WA', population: 40000, medianIncome: 105000, tier: 2, region: 'Greater Seattle' },
  { name: 'Seattle', slug: 'seattle', state: 'Washington', stateSlug: 'washington', stateAbbr: 'WA', population: 737000, medianIncome: 102000, tier: 1 },
  { name: 'Spokane', slug: 'spokane', state: 'Washington', stateSlug: 'washington', stateAbbr: 'WA', population: 228000, medianIncome: 55000, tier: 3 },
  { name: 'Tacoma', slug: 'tacoma', state: 'Washington', stateSlug: 'washington', stateAbbr: 'WA', population: 218000, medianIncome: 58000, tier: 3 },

  // ─────────────────────────────────────────────
  // NEVADA
  // ─────────────────────────────────────────────
  { name: 'Henderson', slug: 'henderson', state: 'Nevada', stateSlug: 'nevada', stateAbbr: 'NV', population: 320000, medianIncome: 72000, tier: 2, region: 'Greater Las Vegas' },
  { name: 'Summerlin', slug: 'summerlin', state: 'Nevada', stateSlug: 'nevada', stateAbbr: 'NV', population: 100000, medianIncome: 90000, tier: 2, region: 'Greater Las Vegas' },
  { name: 'Las Vegas', slug: 'las-vegas', state: 'Nevada', stateSlug: 'nevada', stateAbbr: 'NV', population: 641000, medianIncome: 58000, tier: 2 },
  { name: 'Reno', slug: 'reno', state: 'Nevada', stateSlug: 'nevada', stateAbbr: 'NV', population: 264000, medianIncome: 58000, tier: 3 },

  // ─────────────────────────────────────────────
  // NEW JERSEY
  // ─────────────────────────────────────────────
  { name: 'Short Hills', slug: 'short-hills', state: 'New Jersey', stateSlug: 'new-jersey', stateAbbr: 'NJ', population: 14000, medianIncome: 225000, tier: 1 },
  { name: 'Summit', slug: 'summit', state: 'New Jersey', stateSlug: 'new-jersey', stateAbbr: 'NJ', population: 22000, medianIncome: 165000, tier: 1 },
  { name: 'Ridgewood', slug: 'ridgewood', state: 'New Jersey', stateSlug: 'new-jersey', stateAbbr: 'NJ', population: 26000, medianIncome: 145000, tier: 1 },
  { name: 'Princeton', slug: 'princeton', state: 'New Jersey', stateSlug: 'new-jersey', stateAbbr: 'NJ', population: 29000, medianIncome: 110000, tier: 1 },
  { name: 'Cherry Hill', slug: 'cherry-hill', state: 'New Jersey', stateSlug: 'new-jersey', stateAbbr: 'NJ', population: 72000, medianIncome: 80000, tier: 2 },
  { name: 'Edison', slug: 'edison', state: 'New Jersey', stateSlug: 'new-jersey', stateAbbr: 'NJ', population: 107000, medianIncome: 85000, tier: 2 },
  { name: 'Parsippany', slug: 'parsippany', state: 'New Jersey', stateSlug: 'new-jersey', stateAbbr: 'NJ', population: 57000, medianIncome: 78000, tier: 2 },
  { name: 'Newark', slug: 'newark', state: 'New Jersey', stateSlug: 'new-jersey', stateAbbr: 'NJ', population: 307000, medianIncome: 40000, tier: 3 },
  { name: 'Jersey City', slug: 'jersey-city', state: 'New Jersey', stateSlug: 'new-jersey', stateAbbr: 'NJ', population: 292000, medianIncome: 68000, tier: 3 },

  // ─────────────────────────────────────────────
  // MASSACHUSETTS
  // ─────────────────────────────────────────────
  { name: 'Wellesley', slug: 'wellesley', state: 'Massachusetts', stateSlug: 'massachusetts', stateAbbr: 'MA', population: 29000, medianIncome: 185000, tier: 1, region: 'Greater Boston' },
  { name: 'Weston', slug: 'weston', state: 'Massachusetts', stateSlug: 'massachusetts', stateAbbr: 'MA', population: 12000, medianIncome: 230000, tier: 1, region: 'Greater Boston' },
  { name: 'Lexington', slug: 'lexington', state: 'Massachusetts', stateSlug: 'massachusetts', stateAbbr: 'MA', population: 34000, medianIncome: 160000, tier: 1, region: 'Greater Boston' },
  { name: 'Newton', slug: 'newton', state: 'Massachusetts', stateSlug: 'massachusetts', stateAbbr: 'MA', population: 89000, medianIncome: 145000, tier: 1, region: 'Greater Boston' },
  { name: 'Needham', slug: 'needham', state: 'Massachusetts', stateSlug: 'massachusetts', stateAbbr: 'MA', population: 30000, medianIncome: 138000, tier: 1, region: 'Greater Boston' },
  { name: 'Brookline', slug: 'brookline', state: 'Massachusetts', stateSlug: 'massachusetts', stateAbbr: 'MA', population: 60000, medianIncome: 105000, tier: 2, region: 'Greater Boston' },
  { name: 'Cambridge', slug: 'cambridge', state: 'Massachusetts', stateSlug: 'massachusetts', stateAbbr: 'MA', population: 118000, medianIncome: 100000, tier: 2, region: 'Greater Boston' },
  { name: 'Boston', slug: 'boston', state: 'Massachusetts', stateSlug: 'massachusetts', stateAbbr: 'MA', population: 685000, medianIncome: 78000, tier: 1 },
  { name: 'Worcester', slug: 'worcester', state: 'Massachusetts', stateSlug: 'massachusetts', stateAbbr: 'MA', population: 200000, medianIncome: 48000, tier: 3 },
  { name: 'Springfield', slug: 'springfield', state: 'Massachusetts', stateSlug: 'massachusetts', stateAbbr: 'MA', population: 155000, medianIncome: 40000, tier: 3 },

  // ─────────────────────────────────────────────
  // VIRGINIA
  // ─────────────────────────────────────────────
  { name: 'McLean', slug: 'mclean', state: 'Virginia', stateSlug: 'virginia', stateAbbr: 'VA', population: 48000, medianIncome: 200000, tier: 1, region: 'Greater Washington DC' },
  { name: 'Great Falls', slug: 'great-falls', state: 'Virginia', stateSlug: 'virginia', stateAbbr: 'VA', population: 15000, medianIncome: 218000, tier: 1, region: 'Greater Washington DC' },
  { name: 'Reston', slug: 'reston', state: 'Virginia', stateSlug: 'virginia', stateAbbr: 'VA', population: 61000, medianIncome: 107000, tier: 2, region: 'Greater Washington DC' },
  { name: 'Tysons', slug: 'tysons', state: 'Virginia', stateSlug: 'virginia', stateAbbr: 'VA', population: 24000, medianIncome: 105000, tier: 2, region: 'Greater Washington DC' },
  { name: 'Arlington', slug: 'arlington', state: 'Virginia', stateSlug: 'virginia', stateAbbr: 'VA', population: 238000, medianIncome: 110000, tier: 2, region: 'Greater Washington DC' },
  { name: 'Alexandria', slug: 'alexandria', state: 'Virginia', stateSlug: 'virginia', stateAbbr: 'VA', population: 161000, medianIncome: 92000, tier: 2, region: 'Greater Washington DC' },
  { name: 'Ashburn', slug: 'ashburn', state: 'Virginia', stateSlug: 'virginia', stateAbbr: 'VA', population: 48000, medianIncome: 130000, tier: 2, region: 'Greater Washington DC' },
  { name: 'Virginia Beach', slug: 'virginia-beach', state: 'Virginia', stateSlug: 'virginia', stateAbbr: 'VA', population: 459000, medianIncome: 70000, tier: 2 },
  { name: 'Richmond', slug: 'richmond', state: 'Virginia', stateSlug: 'virginia', stateAbbr: 'VA', population: 226000, medianIncome: 50000, tier: 3 },
  { name: 'Norfolk', slug: 'norfolk', state: 'Virginia', stateSlug: 'virginia', stateAbbr: 'VA', population: 242000, medianIncome: 50000, tier: 3 },

  // ─────────────────────────────────────────────
  // MARYLAND
  // ─────────────────────────────────────────────
  { name: 'Potomac', slug: 'potomac', state: 'Maryland', stateSlug: 'maryland', stateAbbr: 'MD', population: 46000, medianIncome: 180000, tier: 1, region: 'Greater Washington DC' },
  { name: 'Chevy Chase', slug: 'chevy-chase', state: 'Maryland', stateSlug: 'maryland', stateAbbr: 'MD', population: 10000, medianIncome: 210000, tier: 1, region: 'Greater Washington DC' },
  { name: 'Bethesda', slug: 'bethesda', state: 'Maryland', stateSlug: 'maryland', stateAbbr: 'MD', population: 60000, medianIncome: 155000, tier: 1, region: 'Greater Washington DC' },
  { name: 'Rockville', slug: 'rockville', state: 'Maryland', stateSlug: 'maryland', stateAbbr: 'MD', population: 68000, medianIncome: 95000, tier: 2, region: 'Greater Washington DC' },
  { name: 'Gaithersburg', slug: 'gaithersburg', state: 'Maryland', stateSlug: 'maryland', stateAbbr: 'MD', population: 68000, medianIncome: 80000, tier: 2, region: 'Greater Washington DC' },
  { name: 'Baltimore', slug: 'baltimore', state: 'Maryland', stateSlug: 'maryland', stateAbbr: 'MD', population: 585000, medianIncome: 52000, tier: 3 },
  { name: 'Columbia', slug: 'columbia', state: 'Maryland', stateSlug: 'maryland', stateAbbr: 'MD', population: 99000, medianIncome: 100000, tier: 2 },
  { name: 'Annapolis', slug: 'annapolis', state: 'Maryland', stateSlug: 'maryland', stateAbbr: 'MD', population: 40000, medianIncome: 72000, tier: 2 },

  // ─────────────────────────────────────────────
  // PENNSYLVANIA
  // ─────────────────────────────────────────────
  { name: 'Wayne', slug: 'wayne', state: 'Pennsylvania', stateSlug: 'pennsylvania', stateAbbr: 'PA', population: 19000, medianIncome: 110000, tier: 1, region: 'Greater Philadelphia' },
  { name: 'Villanova', slug: 'villanova', state: 'Pennsylvania', stateSlug: 'pennsylvania', stateAbbr: 'PA', population: 9500, medianIncome: 175000, tier: 1, region: 'Greater Philadelphia' },
  { name: 'Radnor', slug: 'radnor', state: 'Pennsylvania', stateSlug: 'pennsylvania', stateAbbr: 'PA', population: 32000, medianIncome: 115000, tier: 1, region: 'Greater Philadelphia' },
  { name: 'King of Prussia', slug: 'king-of-prussia', state: 'Pennsylvania', stateSlug: 'pennsylvania', stateAbbr: 'PA', population: 25000, medianIncome: 88000, tier: 2, region: 'Greater Philadelphia' },
  { name: 'Philadelphia', slug: 'philadelphia', state: 'Pennsylvania', stateSlug: 'pennsylvania', stateAbbr: 'PA', population: 1584000, medianIncome: 48000, tier: 2 },
  { name: 'Pittsburgh', slug: 'pittsburgh', state: 'Pennsylvania', stateSlug: 'pennsylvania', stateAbbr: 'PA', population: 303000, medianIncome: 53000, tier: 3 },
  { name: 'Allentown', slug: 'allentown', state: 'Pennsylvania', stateSlug: 'pennsylvania', stateAbbr: 'PA', population: 125000, medianIncome: 42000, tier: 3 },

  // ─────────────────────────────────────────────
  // OHIO
  // ─────────────────────────────────────────────
  { name: 'Dublin', slug: 'dublin', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 50000, medianIncome: 105000, tier: 2, region: 'Greater Columbus' },
  { name: 'New Albany', slug: 'new-albany', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 11000, medianIncome: 140000, tier: 1, region: 'Greater Columbus' },
  { name: 'Westerville', slug: 'westerville', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 41000, medianIncome: 82000, tier: 2, region: 'Greater Columbus' },
  { name: 'Columbus', slug: 'columbus', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 905000, medianIncome: 55000, tier: 2 },
  { name: 'Cleveland', slug: 'cleveland', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 372000, medianIncome: 32000, tier: 3 },
  { name: 'Cincinnati', slug: 'cincinnati', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 309000, medianIncome: 43000, tier: 3 },
  { name: 'Dayton', slug: 'dayton', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 137000, medianIncome: 38000, tier: 3 },
  { name: 'Toledo', slug: 'toledo', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 270000, medianIncome: 40000, tier: 3 },

  // ─────────────────────────────────────────────
  // MICHIGAN
  // ─────────────────────────────────────────────
  { name: 'Bloomfield Hills', slug: 'bloomfield-hills', state: 'Michigan', stateSlug: 'michigan', stateAbbr: 'MI', population: 4000, medianIncome: 200000, tier: 1, region: 'Greater Detroit' },
  { name: 'Birmingham', slug: 'birmingham', state: 'Michigan', stateSlug: 'michigan', stateAbbr: 'MI', population: 21000, medianIncome: 120000, tier: 1, region: 'Greater Detroit' },
  { name: 'Grosse Pointe', slug: 'grosse-pointe', state: 'Michigan', stateSlug: 'michigan', stateAbbr: 'MI', population: 5000, medianIncome: 125000, tier: 1, region: 'Greater Detroit' },
  { name: 'Troy', slug: 'troy', state: 'Michigan', stateSlug: 'michigan', stateAbbr: 'MI', population: 87000, medianIncome: 90000, tier: 2, region: 'Greater Detroit' },
  { name: 'Ann Arbor', slug: 'ann-arbor', state: 'Michigan', stateSlug: 'michigan', stateAbbr: 'MI', population: 124000, medianIncome: 65000, tier: 2 },
  { name: 'Detroit', slug: 'detroit', state: 'Michigan', stateSlug: 'michigan', stateAbbr: 'MI', population: 633000, medianIncome: 33000, tier: 3 },
  { name: 'Grand Rapids', slug: 'grand-rapids', state: 'Michigan', stateSlug: 'michigan', stateAbbr: 'MI', population: 198000, medianIncome: 52000, tier: 3 },
  { name: 'Lansing', slug: 'lansing', state: 'Michigan', stateSlug: 'michigan', stateAbbr: 'MI', population: 112000, medianIncome: 44000, tier: 3 },

  // ─────────────────────────────────────────────
  // MINNESOTA
  // ─────────────────────────────────────────────
  { name: 'Edina', slug: 'edina', state: 'Minnesota', stateSlug: 'minnesota', stateAbbr: 'MN', population: 53000, medianIncome: 100000, tier: 1, region: 'Greater Minneapolis' },
  { name: 'Minnetonka', slug: 'minnetonka', state: 'Minnesota', stateSlug: 'minnesota', stateAbbr: 'MN', population: 54000, medianIncome: 87000, tier: 2, region: 'Greater Minneapolis' },
  { name: 'Eden Prairie', slug: 'eden-prairie', state: 'Minnesota', stateSlug: 'minnesota', stateAbbr: 'MN', population: 67000, medianIncome: 95000, tier: 2, region: 'Greater Minneapolis' },
  { name: 'Minneapolis', slug: 'minneapolis', state: 'Minnesota', stateSlug: 'minnesota', stateAbbr: 'MN', population: 430000, medianIncome: 62000, tier: 2 },
  { name: 'Saint Paul', slug: 'saint-paul', state: 'Minnesota', stateSlug: 'minnesota', stateAbbr: 'MN', population: 311000, medianIncome: 52000, tier: 3 },
  { name: 'Rochester', slug: 'rochester', state: 'Minnesota', stateSlug: 'minnesota', stateAbbr: 'MN', population: 121000, medianIncome: 70000, tier: 3 },

  // ─────────────────────────────────────────────
  // NORTH CAROLINA
  // ─────────────────────────────────────────────
  { name: 'Cary', slug: 'cary', state: 'North Carolina', stateSlug: 'north-carolina', stateAbbr: 'NC', population: 183000, medianIncome: 100000, tier: 2, region: 'Research Triangle' },
  { name: 'Apex', slug: 'apex', state: 'North Carolina', stateSlug: 'north-carolina', stateAbbr: 'NC', population: 64000, medianIncome: 97000, tier: 2, region: 'Research Triangle' },
  { name: 'Chapel Hill', slug: 'chapel-hill', state: 'North Carolina', stateSlug: 'north-carolina', stateAbbr: 'NC', population: 63000, medianIncome: 67000, tier: 2, region: 'Research Triangle' },
  { name: 'Raleigh', slug: 'raleigh', state: 'North Carolina', stateSlug: 'north-carolina', stateAbbr: 'NC', population: 467000, medianIncome: 68000, tier: 2 },
  { name: 'Charlotte', slug: 'charlotte', state: 'North Carolina', stateSlug: 'north-carolina', stateAbbr: 'NC', population: 875000, medianIncome: 62000, tier: 2 },
  { name: 'Durham', slug: 'durham', state: 'North Carolina', stateSlug: 'north-carolina', stateAbbr: 'NC', population: 287000, medianIncome: 55000, tier: 3 },
  { name: 'Greensboro', slug: 'greensboro', state: 'North Carolina', stateSlug: 'north-carolina', stateAbbr: 'NC', population: 296000, medianIncome: 50000, tier: 3 },
  { name: 'Winston-Salem', slug: 'winston-salem', state: 'North Carolina', stateSlug: 'north-carolina', stateAbbr: 'NC', population: 249000, medianIncome: 48000, tier: 3 },

  // ─────────────────────────────────────────────
  // TENNESSEE
  // ─────────────────────────────────────────────
  { name: 'Brentwood', slug: 'brentwood', state: 'Tennessee', stateSlug: 'tennessee', stateAbbr: 'TN', population: 45000, medianIncome: 145000, tier: 1, region: 'Greater Nashville' },
  { name: 'Franklin', slug: 'franklin', state: 'Tennessee', stateSlug: 'tennessee', stateAbbr: 'TN', population: 88000, medianIncome: 90000, tier: 2, region: 'Greater Nashville' },
  { name: 'Nashville', slug: 'nashville', state: 'Tennessee', stateSlug: 'tennessee', stateAbbr: 'TN', population: 689000, medianIncome: 58000, tier: 2 },
  { name: 'Memphis', slug: 'memphis', state: 'Tennessee', stateSlug: 'tennessee', stateAbbr: 'TN', population: 628000, medianIncome: 42000, tier: 3 },
  { name: 'Knoxville', slug: 'knoxville', state: 'Tennessee', stateSlug: 'tennessee', stateAbbr: 'TN', population: 190000, medianIncome: 45000, tier: 3 },
  { name: 'Chattanooga', slug: 'chattanooga', state: 'Tennessee', stateSlug: 'tennessee', stateAbbr: 'TN', population: 181000, medianIncome: 48000, tier: 3 },

  // ─────────────────────────────────────────────
  // KANSAS / MISSOURI
  // ─────────────────────────────────────────────
  { name: 'Overland Park', slug: 'overland-park', state: 'Kansas', stateSlug: 'kansas', stateAbbr: 'KS', population: 200000, medianIncome: 80000, tier: 2, region: 'Greater Kansas City' },
  { name: 'Leawood', slug: 'leawood', state: 'Kansas', stateSlug: 'kansas', stateAbbr: 'KS', population: 35000, medianIncome: 130000, tier: 1, region: 'Greater Kansas City' },
  { name: 'Lenexa', slug: 'lenexa', state: 'Kansas', stateSlug: 'kansas', stateAbbr: 'KS', population: 58000, medianIncome: 80000, tier: 2, region: 'Greater Kansas City' },
  { name: 'Kansas City', slug: 'kansas-city', state: 'Missouri', stateSlug: 'missouri', stateAbbr: 'MO', population: 497000, medianIncome: 53000, tier: 3, region: 'Greater Kansas City' },
  { name: 'St. Louis', slug: 'st-louis', state: 'Missouri', stateSlug: 'missouri', stateAbbr: 'MO', population: 301000, medianIncome: 42000, tier: 3, region: 'Greater St. Louis' },
  { name: 'Clayton', slug: 'clayton', state: 'Missouri', stateSlug: 'missouri', stateAbbr: 'MO', population: 17000, medianIncome: 105000, tier: 2, region: 'Greater St. Louis' },

  // ─────────────────────────────────────────────
  // INDIANA
  // ─────────────────────────────────────────────
  { name: 'Carmel', slug: 'carmel', state: 'Indiana', stateSlug: 'indiana', stateAbbr: 'IN', population: 100000, medianIncome: 105000, tier: 2, region: 'Greater Indianapolis' },
  { name: 'Zionsville', slug: 'zionsville', state: 'Indiana', stateSlug: 'indiana', stateAbbr: 'IN', population: 29000, medianIncome: 120000, tier: 2, region: 'Greater Indianapolis' },
  { name: 'Indianapolis', slug: 'indianapolis', state: 'Indiana', stateSlug: 'indiana', stateAbbr: 'IN', population: 887000, medianIncome: 52000, tier: 2 },
  { name: 'Fort Wayne', slug: 'fort-wayne', state: 'Indiana', stateSlug: 'indiana', stateAbbr: 'IN', population: 268000, medianIncome: 50000, tier: 3 },

  // ─────────────────────────────────────────────
  // UTAH
  // ─────────────────────────────────────────────
  { name: 'Park City', slug: 'park-city', state: 'Utah', stateSlug: 'utah', stateAbbr: 'UT', population: 8500, medianIncome: 105000, tier: 1 },
  { name: 'Draper', slug: 'draper', state: 'Utah', stateSlug: 'utah', stateAbbr: 'UT', population: 50000, medianIncome: 100000, tier: 2, region: 'Greater Salt Lake City' },
  { name: 'South Jordan', slug: 'south-jordan', state: 'Utah', stateSlug: 'utah', stateAbbr: 'UT', population: 75000, medianIncome: 92000, tier: 2, region: 'Greater Salt Lake City' },
  { name: 'Salt Lake City', slug: 'salt-lake-city', state: 'Utah', stateSlug: 'utah', stateAbbr: 'UT', population: 200000, medianIncome: 58000, tier: 2 },
  { name: 'Provo', slug: 'provo', state: 'Utah', stateSlug: 'utah', stateAbbr: 'UT', population: 117000, medianIncome: 48000, tier: 3 },

  // ─────────────────────────────────────────────
  // OREGON
  // ─────────────────────────────────────────────
  { name: 'Lake Oswego', slug: 'lake-oswego', state: 'Oregon', stateSlug: 'oregon', stateAbbr: 'OR', population: 40000, medianIncome: 100000, tier: 2, region: 'Greater Portland' },
  { name: 'West Linn', slug: 'west-linn', state: 'Oregon', stateSlug: 'oregon', stateAbbr: 'OR', population: 27000, medianIncome: 102000, tier: 2, region: 'Greater Portland' },
  { name: 'Beaverton', slug: 'beaverton', state: 'Oregon', stateSlug: 'oregon', stateAbbr: 'OR', population: 100000, medianIncome: 62000, tier: 2, region: 'Greater Portland' },
  { name: 'Portland', slug: 'portland', state: 'Oregon', stateSlug: 'oregon', stateAbbr: 'OR', population: 652000, medianIncome: 68000, tier: 2 },
  { name: 'Eugene', slug: 'eugene', state: 'Oregon', stateSlug: 'oregon', stateAbbr: 'OR', population: 176000, medianIncome: 47000, tier: 3 },
  { name: 'Bend', slug: 'bend', state: 'Oregon', stateSlug: 'oregon', stateAbbr: 'OR', population: 102000, medianIncome: 67000, tier: 2 },

  // ─────────────────────────────────────────────
  // WISCONSIN
  // ─────────────────────────────────────────────
  { name: 'Whitefish Bay', slug: 'whitefish-bay', state: 'Wisconsin', stateSlug: 'wisconsin', stateAbbr: 'WI', population: 14000, medianIncome: 120000, tier: 2, region: 'Greater Milwaukee' },
  { name: 'Milwaukee', slug: 'milwaukee', state: 'Wisconsin', stateSlug: 'wisconsin', stateAbbr: 'WI', population: 577000, medianIncome: 40000, tier: 3 },
  { name: 'Madison', slug: 'madison', state: 'Wisconsin', stateSlug: 'wisconsin', stateAbbr: 'WI', population: 269000, medianIncome: 58000, tier: 3 },
  { name: 'Green Bay', slug: 'green-bay', state: 'Wisconsin', stateSlug: 'wisconsin', stateAbbr: 'WI', population: 107000, medianIncome: 50000, tier: 3 },

  // ─────────────────────────────────────────────
  // SOUTH CAROLINA
  // ─────────────────────────────────────────────
  { name: 'Hilton Head', slug: 'hilton-head', state: 'South Carolina', stateSlug: 'south-carolina', stateAbbr: 'SC', population: 40000, medianIncome: 72000, tier: 2 },
  { name: 'Mount Pleasant', slug: 'mount-pleasant', state: 'South Carolina', stateSlug: 'south-carolina', stateAbbr: 'SC', population: 95000, medianIncome: 87000, tier: 2, region: 'Greater Charleston' },
  { name: 'Charleston', slug: 'charleston', state: 'South Carolina', stateSlug: 'south-carolina', stateAbbr: 'SC', population: 150000, medianIncome: 60000, tier: 2, region: 'Greater Charleston' },
  { name: 'Columbia', slug: 'columbia', state: 'South Carolina', stateSlug: 'south-carolina', stateAbbr: 'SC', population: 136000, medianIncome: 48000, tier: 3 },

  // ─────────────────────────────────────────────
  // LOUISIANA
  // ─────────────────────────────────────────────
  { name: 'Metairie', slug: 'metairie', state: 'Louisiana', stateSlug: 'louisiana', stateAbbr: 'LA', population: 140000, medianIncome: 58000, tier: 3, region: 'Greater New Orleans' },
  { name: 'New Orleans', slug: 'new-orleans', state: 'Louisiana', stateSlug: 'louisiana', stateAbbr: 'LA', population: 383000, medianIncome: 40000, tier: 3, region: 'Greater New Orleans' },
  { name: 'Baton Rouge', slug: 'baton-rouge', state: 'Louisiana', stateSlug: 'louisiana', stateAbbr: 'LA', population: 228000, medianIncome: 44000, tier: 3 },

  // ─────────────────────────────────────────────
  // ALABAMA
  // ─────────────────────────────────────────────
  { name: 'Mountain Brook', slug: 'mountain-brook', state: 'Alabama', stateSlug: 'alabama', stateAbbr: 'AL', population: 21000, medianIncome: 155000, tier: 1, region: 'Greater Birmingham' },
  { name: 'Vestavia Hills', slug: 'vestavia-hills', state: 'Alabama', stateSlug: 'alabama', stateAbbr: 'AL', population: 35000, medianIncome: 95000, tier: 2, region: 'Greater Birmingham' },
  { name: 'Birmingham', slug: 'birmingham', state: 'Alabama', stateSlug: 'alabama', stateAbbr: 'AL', population: 212000, medianIncome: 42000, tier: 3, region: 'Greater Birmingham' },
  { name: 'Huntsville', slug: 'huntsville', state: 'Alabama', stateSlug: 'alabama', stateAbbr: 'AL', population: 214000, medianIncome: 60000, tier: 3 },

  // ─────────────────────────────────────────────
  // NEBRASKA / IOWA
  // ─────────────────────────────────────────────
  { name: 'Omaha', slug: 'omaha', state: 'Nebraska', stateSlug: 'nebraska', stateAbbr: 'NE', population: 487000, medianIncome: 60000, tier: 3 },
  { name: 'Lincoln', slug: 'lincoln', state: 'Nebraska', stateSlug: 'nebraska', stateAbbr: 'NE', population: 295000, medianIncome: 55000, tier: 3 },
  { name: 'Des Moines', slug: 'des-moines', state: 'Iowa', stateSlug: 'iowa', stateAbbr: 'IA', population: 214000, medianIncome: 55000, tier: 3 },

  // ─────────────────────────────────────────────
  // OKLAHOMA
  // ─────────────────────────────────────────────
  { name: 'Edmond', slug: 'edmond', state: 'Oklahoma', stateSlug: 'oklahoma', stateAbbr: 'OK', population: 100000, medianIncome: 80000, tier: 2, region: 'Greater Oklahoma City' },
  { name: 'Oklahoma City', slug: 'oklahoma-city', state: 'Oklahoma', stateSlug: 'oklahoma', stateAbbr: 'OK', population: 680000, medianIncome: 54000, tier: 3, region: 'Greater Oklahoma City' },
  { name: 'Tulsa', slug: 'tulsa', state: 'Oklahoma', stateSlug: 'oklahoma', stateAbbr: 'OK', population: 413000, medianIncome: 50000, tier: 3 },

  // ─────────────────────────────────────────────
  // ARKANSAS
  // ─────────────────────────────────────────────
  { name: 'Bentonville', slug: 'bentonville', state: 'Arkansas', stateSlug: 'arkansas', stateAbbr: 'AR', population: 57000, medianIncome: 78000, tier: 2 },
  { name: 'Little Rock', slug: 'little-rock', state: 'Arkansas', stateSlug: 'arkansas', stateAbbr: 'AR', population: 202000, medianIncome: 50000, tier: 3 },

  // ─────────────────────────────────────────────
  // NEW MEXICO
  // ─────────────────────────────────────────────
  { name: 'Santa Fe', slug: 'santa-fe', state: 'New Mexico', stateSlug: 'new-mexico', stateAbbr: 'NM', population: 84000, medianIncome: 52000, tier: 2 },
  { name: 'Albuquerque', slug: 'albuquerque', state: 'New Mexico', stateSlug: 'new-mexico', stateAbbr: 'NM', population: 562000, medianIncome: 52000, tier: 3 },

  // ─────────────────────────────────────────────
  // HAWAII
  // ─────────────────────────────────────────────
  { name: 'Honolulu', slug: 'honolulu', state: 'Hawaii', stateSlug: 'hawaii', stateAbbr: 'HI', population: 345000, medianIncome: 82000, tier: 2 },
  { name: 'Kailua', slug: 'kailua', state: 'Hawaii', stateSlug: 'hawaii', stateAbbr: 'HI', population: 50000, medianIncome: 90000, tier: 2 },
];

// ─── Content versioning ───────────────────────────────────────────────────────────────────
/**
 * Bump this date ONLY when city page content materially changes (copy, FAQs,
 * schema, layout). It feeds sitemap <lastmod> and schema dateModified. Do NOT
 * use `new Date()` for lastmod — stamping every build teaches crawlers to
 * ignore the signal.
 */
export const CITY_CONTENT_UPDATED = new Date('2026-07-07');

// ─── Helpers ─────────────────────────────────────────────────────────────────────────────────

/** Returns all unique state slugs present in the city data */
export function getStatesSlugs(): string[] {
  return [...new Set(CITIES.map((c) => c.stateSlug))].sort();
}

/** Returns all cities for a given state slug */
export function getCitiesByState(stateSlug: string): City[] {
  return CITIES.filter((c) => c.stateSlug === stateSlug);
}

/** Returns a single city by state + city slug pair */
export function getCity(stateSlug: string, citySlug: string): City | undefined {
  return CITIES.find((c) => c.stateSlug === stateSlug && c.slug === citySlug);
}

/** Returns all Tier 1 cities sorted by median income descending */
export function getTier1Cities(): City[] {
  return CITIES.filter((c) => c.tier === 1).sort((a, b) => b.medianIncome - a.medianIncome);
}

/** Returns cities grouped by state slug */
export function getCitiesGroupedByState(): Record<string, City[]> {
  return CITIES.reduce<Record<string, City[]>>((acc, city) => {
    if (!acc[city.stateSlug]) acc[city.stateSlug] = [];
    acc[city.stateSlug].push(city);
    return acc;
  }, {});
}

/** State display name from slug */
export function getStateName(stateSlug: string): string {
  const city = CITIES.find((c) => c.stateSlug === stateSlug);
  return city?.state ?? stateSlug;
}
