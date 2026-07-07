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
  // ILLINOIS
  // ─────────────────────────────────────────────
  { name: 'Winnetka', slug: 'winnetka', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 12000, medianIncome: 195000, tier: 1, region: 'Chicagoland area' },
  { name: 'Kenilworth', slug: 'kenilworth', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 2600, medianIncome: 220000, tier: 1, region: 'Chicagoland area' },
  { name: 'Glencoe', slug: 'glencoe', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 9000, medianIncome: 175000, tier: 1, region: 'Chicagoland area' },
  { name: 'Highland Park', slug: 'highland-park', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 29000, medianIncome: 120000, tier: 1, region: 'Chicagoland area' },
  { name: 'Lake Forest', slug: 'lake-forest', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 19000, medianIncome: 160000, tier: 1, region: 'Chicagoland area' },
  { name: 'Hinsdale', slug: 'hinsdale', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 17000, medianIncome: 175000, tier: 1, region: 'Chicagoland area' },
  { name: 'Barrington', slug: 'barrington', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 10000, medianIncome: 115000, tier: 1, region: 'Chicagoland area' },
  { name: 'Wilmette', slug: 'wilmette', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 27000, medianIncome: 135000, tier: 1, region: 'Chicagoland area' },
  { name: 'Naperville', slug: 'naperville', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 149000, medianIncome: 108000, tier: 1, region: 'Chicagoland area' },
  { name: 'Oak Brook', slug: 'oak-brook', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 8000, medianIncome: 130000, tier: 1, region: 'Chicagoland area' },
  { name: 'Burr Ridge', slug: 'burr-ridge', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 11000, medianIncome: 145000, tier: 1, region: 'Chicagoland area' },
  { name: 'Oak Lawn', slug: 'oak-lawn', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 55000, medianIncome: 62000, tier: 2, region: 'Chicagoland area' },
  { name: 'Evanston', slug: 'evanston', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 78000, medianIncome: 78000, tier: 2, region: 'Chicagoland area' },
  { name: 'Schaumburg', slug: 'schaumburg', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 78000, medianIncome: 72000, tier: 2, region: 'Chicagoland area' },
  { name: 'Aurora', slug: 'aurora', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 180000, medianIncome: 65000, tier: 2, region: 'Chicagoland area' },
  { name: 'Joliet', slug: 'joliet', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 150000, medianIncome: 60000, tier: 3, region: 'Chicagoland area' },
  { name: 'Rockford', slug: 'rockford', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 147000, medianIncome: 45000, tier: 3 },
  { name: 'Chicago', slug: 'chicago', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 2696000, medianIncome: 60000, tier: 1 },
  { name: 'Springfield', slug: 'springfield', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 116000, medianIncome: 55000, tier: 3 },
  { name: 'Peoria', slug: 'peoria', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 113000, medianIncome: 50000, tier: 3 },
  { name: 'Elgin', slug: 'elgin', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 112000, medianIncome: 62000, tier: 3, region: 'Chicagoland area' },
  { name: 'Orland Park', slug: 'orland-park', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 58000, medianIncome: 85000, tier: 2, region: 'Chicagoland area' },
  { name: 'Tinley Park', slug: 'tinley-park', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 57000, medianIncome: 78000, tier: 2, region: 'Chicagoland area' },
  { name: 'Bolingbrook', slug: 'bolingbrook', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 74000, medianIncome: 80000, tier: 2, region: 'Chicagoland area' },
  { name: 'Downers Grove', slug: 'downers-grove', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 49000, medianIncome: 89000, tier: 2, region: 'Chicagoland area' },
  { name: 'Wheaton', slug: 'wheaton', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 53000, medianIncome: 85000, tier: 2, region: 'Chicagoland area' },
  { name: 'Glenview', slug: 'glenview', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL', population: 47000, medianIncome: 105000, tier: 2, region: 'Chicagoland area' },

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
  { name: 'Kansas City', slug: 'kansas-city', state: 'Missouri', stateSlug: 'missouri', stateAbbr: 'MO', population: 497000, medianIncome: 53000, tier: 3 },
  { name: 'St. Louis', slug: 'st-louis', state: 'Missouri', stateSlug: 'missouri', stateAbbr: 'MO', population: 301000, medianIncome: 42000, tier: 3 },
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
  { name: 'Charleston', slug: 'charleston', state: 'South Carolina', stateSlug: 'south-carolina', stateAbbr: 'SC', population: 150000, medianIncome: 60000, tier: 2 },
  { name: 'Columbia', slug: 'columbia', state: 'South Carolina', stateSlug: 'south-carolina', stateAbbr: 'SC', population: 136000, medianIncome: 48000, tier: 3 },

  // ─────────────────────────────────────────────
  // LOUISIANA
  // ─────────────────────────────────────────────
  { name: 'Metairie', slug: 'metairie', state: 'Louisiana', stateSlug: 'louisiana', stateAbbr: 'LA', population: 140000, medianIncome: 58000, tier: 3, region: 'Greater New Orleans' },
  { name: 'New Orleans', slug: 'new-orleans', state: 'Louisiana', stateSlug: 'louisiana', stateAbbr: 'LA', population: 383000, medianIncome: 40000, tier: 3 },
  { name: 'Baton Rouge', slug: 'baton-rouge', state: 'Louisiana', stateSlug: 'louisiana', stateAbbr: 'LA', population: 228000, medianIncome: 44000, tier: 3 },

  // ─────────────────────────────────────────────
  // ALABAMA
  // ─────────────────────────────────────────────
  { name: 'Mountain Brook', slug: 'mountain-brook', state: 'Alabama', stateSlug: 'alabama', stateAbbr: 'AL', population: 21000, medianIncome: 155000, tier: 1, region: 'Greater Birmingham' },
  { name: 'Vestavia Hills', slug: 'vestavia-hills', state: 'Alabama', stateSlug: 'alabama', stateAbbr: 'AL', population: 35000, medianIncome: 95000, tier: 2, region: 'Greater Birmingham' },
  { name: 'Birmingham', slug: 'birmingham', state: 'Alabama', stateSlug: 'alabama', stateAbbr: 'AL', population: 212000, medianIncome: 42000, tier: 3 },
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
  { name: 'Oklahoma City', slug: 'oklahoma-city', state: 'Oklahoma', stateSlug: 'oklahoma', stateAbbr: 'OK', population: 680000, medianIncome: 54000, tier: 3 },
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

// ─── Content versioning ─────────────────────────────────────────────────────
/**
 * Bump this date ONLY when city page content materially changes (copy, FAQs,
 * schema, layout). It feeds sitemap <lastmod> and schema dateModified. Do NOT
 * use `new Date()` for lastmod — stamping every build teaches crawlers to
 * ignore the signal.
 */
export const CITY_CONTENT_UPDATED = new Date('2026-07-07');

// ─── Helpers ───────────────────────────────────────────────────────────────

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
