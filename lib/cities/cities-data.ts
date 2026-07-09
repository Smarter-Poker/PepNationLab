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
  { name: 'Beverly Hills', slug: 'beverly-hills', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 34000, medianIncome: 120000, tier: 1, region: 'Greater Los Angeles', county: 'Los Angeles', zips: ['90210', '90211'], localBlurb: 'From the Golden Triangle to Trousdale Estates, top research laboratories in Beverly Hills rely on our research-grade peptides for advanced cellular studies.' },
  { name: 'Newport Beach', slug: 'newport-beach', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 85000, medianIncome: 130000, tier: 1, region: 'Orange County', county: 'Orange', zips: ['92660', '92661', '92662', '92663'], localBlurb: 'Researchers in Newport Beach and Corona del Mar demand the highest purity. Our cold-chained fulfillment ensures maximum stability upon arrival.' },
  { name: 'Palo Alto', slug: 'palo-alto', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 68000, medianIncome: 150000, tier: 1, region: 'Silicon Valley', county: 'Santa Clara', zips: ['94301', '94303', '94304', '94306'], localBlurb: 'Located in the heart of Silicon Valley, Palo Alto\'s biotech researchers depend on our strict batch-testing and third-party COAs for reproducible results.' },
  { name: 'Malibu', slug: 'malibu', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 13000, medianIncome: 145000, tier: 1, region: 'Greater Los Angeles', county: 'Los Angeles', zips: ['90265'], localBlurb: 'Serving private research facilities along the Pacific Coast Highway, we provide discreet, fast delivery of premium research compounds to Malibu.' },
  { name: 'Atherton', slug: 'atherton', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 7000, medianIncome: 250000, tier: 1, region: 'Silicon Valley', county: 'San Mateo', zips: ['94027'], localBlurb: 'Private laboratories in Atherton require uncompromising quality. Our research peptides are synthesized in state-of-the-art facilities to high-purity standards with full COA documentation.' },
  { name: 'Menlo Park', slug: 'menlo-park', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 34000, medianIncome: 160000, tier: 1, region: 'Silicon Valley', county: 'San Mateo', zips: ['94025'], localBlurb: 'As a hub for scientific innovation, Menlo Park research institutions trust our rigorous analytical testing and consistent supply chain.' },
  { name: 'Los Altos', slug: 'los-altos', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 31000, medianIncome: 185000, tier: 1, region: 'Silicon Valley', county: 'Santa Clara', zips: ['94022', '94024'], localBlurb: 'Supporting the cutting-edge biotech ecosystem of Los Altos, our comprehensive catalog covers both established and emerging research peptides.' },
  { name: 'Saratoga', slug: 'saratoga', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 31000, medianIncome: 175000, tier: 1, region: 'Silicon Valley', county: 'Santa Clara', zips: ['95070'], localBlurb: 'We provide Saratoga\'s scientific community with wholesale access to specialized peptides, backed by comprehensive analytical data.' },
  { name: 'Laguna Beach', slug: 'laguna-beach', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 23000, medianIncome: 120000, tier: 1, region: 'Orange County', county: 'Orange', zips: ['92651'], localBlurb: 'Serving the specialized research needs of Laguna Beach, we ensure all shipments are climate-controlled to preserve peptide integrity.' },
  { name: 'Rancho Santa Fe', slug: 'rancho-santa-fe', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 3100, medianIncome: 210000, tier: 1, region: 'Greater San Diego', county: 'San Diego', zips: ['92067'], localBlurb: 'Exclusive research facilities in Rancho Santa Fe partner with us for guaranteed purity and priority fulfillment on all bulk orders.' },
  { name: 'San Francisco', slug: 'san-francisco', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 874000, medianIncome: 130000, tier: 1, region: 'Bay Area', county: 'San Francisco', zips: ['94102', '94103', '94104', '94105'], localBlurb: 'From SoMa to Mission Bay, San Francisco\'s premier biomedical research teams utilize our compounds for advanced cellular and metabolic modeling.' },
  { name: 'Los Angeles', slug: 'los-angeles', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 3990000, medianIncome: 70000, tier: 1, region: 'Greater Los Angeles', county: 'Los Angeles', zips: ['90001', '90012', '90013', '90014'], localBlurb: 'We supply Los Angeles\'s vast network of academic and private research institutions with the highest grade peptides for pre-clinical studies.' },
  { name: 'San Diego', slug: 'san-diego', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 1423000, medianIncome: 85000, tier: 1, region: 'Greater San Diego', county: 'San Diego', zips: ['92101', '92102', '92103', '92104'], localBlurb: 'As a global biotechnology powerhouse, San Diego researchers demand the best. Our compounds meet the rigorous standards of La Jolla and Torrey Pines labs.' },
  { name: 'Irvine', slug: 'irvine', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 310000, medianIncome: 100000, tier: 1, region: 'Orange County', county: 'Orange', zips: ['92602', '92603', '92604', '92612'], localBlurb: 'Supporting the rapidly growing life sciences sector in Irvine, we deliver wholesale research peptides with unmatched analytical transparency.' },
  { name: 'Santa Monica', slug: 'santa-monica', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 93000, medianIncome: 95000, tier: 1, region: 'Greater Los Angeles', county: 'Los Angeles', zips: ['90401', '90402', '90403'], localBlurb: 'Research facilities in Santa Monica and Silicon Beach rely on our catalog for exploring novel mechanisms in cellular repair and regeneration.' },
  {
    name: 'Pasadena', slug: 'pasadena', state: 'California', stateSlug: 'california', stateAbbr: 'CA',
    population: 138000, medianIncome: 80000, tier: 2, region: 'Greater Los Angeles', county: 'Los Angeles',
    zips: ['91101', '91103', '91106'],
    localBlurb: 'Home to Caltech and the Jet Propulsion Laboratory, Pasadena hosts one of the densest scientific-research communities in California.',
  },
  {
    name: 'Walnut Creek', slug: 'walnut-creek', state: 'California', stateSlug: 'california', stateAbbr: 'CA',
    population: 70000, medianIncome: 100000, tier: 2, region: 'Bay Area', county: 'Contra Costa',
    zips: ['94595', '94596', '94598'],
    localBlurb: 'An affluent East Bay hub anchored by John Muir Medical Center and a well-educated professional base.',
  },
  {
    name: 'Pleasanton', slug: 'pleasanton', state: 'California', stateSlug: 'california', stateAbbr: 'CA',
    population: 82000, medianIncome: 130000, tier: 2, region: 'Bay Area', county: 'Alameda',
    zips: ['94566', '94588'],
    localBlurb: 'A prosperous Tri-Valley city with corporate campuses and a high-income, highly educated workforce.',
  },
  {
    name: 'Dublin', slug: 'dublin', state: 'California', stateSlug: 'california', stateAbbr: 'CA',
    population: 72000, medianIncome: 125000, tier: 2, region: 'Bay Area', county: 'Alameda',
    zips: ['94568'],
    localBlurb: 'A fast-growing Tri-Valley city in Alameda County with strong demand for advanced healthcare services.',
  },
  {
    name: 'San Jose', slug: 'san-jose', state: 'California', stateSlug: 'california', stateAbbr: 'CA',
    population: 1013000, medianIncome: 110000, tier: 2, region: 'Silicon Valley', county: 'Santa Clara',
    zips: ['95110', '95112', '95126'],
    localBlurb: 'The capital of Silicon Valley, anchoring an enormous biotech and life-science research economy.',
  },
  { name: 'Cupertino', slug: 'cupertino', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 60000, medianIncome: 155000, tier: 1, region: 'Silicon Valley', county: 'Santa Clara', zips: ['95014'], localBlurb: 'Innovators in Cupertino\'s tech and biotech sectors partner with us for our commitment to precision, purity, and rapid local fulfillment.' },
  {
    name: 'Sunnyvale', slug: 'sunnyvale', state: 'California', stateSlug: 'california', stateAbbr: 'CA',
    population: 155000, medianIncome: 130000, tier: 2, region: 'Silicon Valley', county: 'Santa Clara',
    zips: ['94085', '94086', '94087'],
    localBlurb: 'A core Silicon Valley city with dense tech and biotech R&D and a highly educated population.',
  },
  {
    name: 'Santa Barbara', slug: 'santa-barbara', state: 'California', stateSlug: 'california', stateAbbr: 'CA',
    population: 91000, medianIncome: 72000, tier: 2, region: 'Central Coast', county: 'Santa Barbara',
    zips: ['93101', '93103', '93105'],
    localBlurb: 'A coastal research city home to UC Santa Barbara and Cottage Health’s flagship hospital.',
  },
  {
    name: 'Thousand Oaks', slug: 'thousand-oaks', state: 'California', stateSlug: 'california', stateAbbr: 'CA',
    population: 128000, medianIncome: 100000, tier: 2, region: 'Greater Los Angeles', county: 'Ventura',
    zips: ['91360', '91362'],
    localBlurb: 'Headquarters of Amgen, one of the world’s largest biotech companies, with a deep life-science workforce.',
  },
  {
    name: 'Carlsbad', slug: 'carlsbad', state: 'California', stateSlug: 'california', stateAbbr: 'CA',
    population: 118000, medianIncome: 100000, tier: 2, region: 'Greater San Diego', county: 'San Diego',
    zips: ['92008', '92009', '92011'],
    localBlurb: 'A coastal North County city with a strong life-science and medical-device cluster.',
  },
  {
    name: 'Encinitas', slug: 'encinitas', state: 'California', stateSlug: 'california', stateAbbr: 'CA',
    population: 62000, medianIncome: 95000, tier: 2, region: 'Greater San Diego', county: 'San Diego',
    zips: ['92024'],
    localBlurb: 'An affluent North County coastal city with a health-conscious, well-educated resident base.',
  },
  {
    name: 'Rancho Cucamonga', slug: 'rancho-cucamonga', state: 'California', stateSlug: 'california', stateAbbr: 'CA',
    population: 178000, medianIncome: 82000, tier: 2, region: 'Inland Empire', county: 'San Bernardino',
    zips: ['91701', '91730', '91739'],
    localBlurb: 'A large Inland Empire city with major logistics activity and a growing healthcare sector.',
  },
  {
    name: 'Roseville', slug: 'roseville', state: 'California', stateSlug: 'california', stateAbbr: 'CA',
    population: 145000, medianIncome: 87000, tier: 2, region: 'Greater Sacramento', county: 'Placer',
    zips: ['95661', '95678', '95747'],
    localBlurb: 'The largest city in Placer County, a Sacramento-area hub anchored by major Kaiser and Sutter campuses.',
  },
  {
    name: 'Folsom', slug: 'folsom', state: 'California', stateSlug: 'california', stateAbbr: 'CA',
    population: 82000, medianIncome: 107000, tier: 2, region: 'Greater Sacramento', county: 'Sacramento',
    zips: ['95630'],
    localBlurb: 'An affluent Sacramento-area city with a strong tech and professional workforce.',
  },
  {
    name: 'Fresno', slug: 'fresno', state: 'California', stateSlug: 'california', stateAbbr: 'CA',
    population: 545000, medianIncome: 50000, tier: 3, region: 'Central Valley', county: 'Fresno',
    zips: ['93701', '93710', '93720'],
    localBlurb: 'The largest city in the Central Valley and a regional medical hub anchored by UCSF Fresno.',
  },
  {
    name: 'Sacramento', slug: 'sacramento', state: 'California', stateSlug: 'california', stateAbbr: 'CA',
    population: 524000, medianIncome: 60000, tier: 3, region: 'Greater Sacramento', county: 'Sacramento',
    zips: ['95814', '95818', '95825'],
    localBlurb: 'The state capital, home to UC Davis Health and a large public-sector research and medical community.',
  },

  // ─────────────────────────────────────────────
  // ARIZONA
  // ─────────────────────────────────────────────
  { name: 'Scottsdale', slug: 'scottsdale', state: 'Arizona', stateSlug: 'arizona', stateAbbr: 'AZ', population: 258000, medianIncome: 85000, tier: 1, region: 'Greater Phoenix', county: 'Maricopa', zips: ['85250', '85251', '85253', '85255'], localBlurb: 'From North Scottsdale to the Airpark, advanced research laboratories use our high-purity peptides to study tissue recovery and longevity pathways.' },
  { name: 'Paradise Valley', slug: 'paradise-valley', state: 'Arizona', stateSlug: 'arizona', stateAbbr: 'AZ', population: 14000, medianIncome: 225000, tier: 1, region: 'Greater Phoenix', county: 'Maricopa', zips: ['85253'], localBlurb: 'Private and independent researchers in Paradise Valley select our compounds for their guaranteed stability and comprehensive COA documentation.' },
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
  {
    name: 'Miami', slug: 'miami', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 470000, medianIncome: 45000, tier: 2, region: 'Greater Miami', county: 'Miami-Dade',
    zips: ['33101', '33130', '33137'],
    localBlurb: 'From Brickell and Downtown to the Health District around Jackson Memorial and the University of Miami Miller School of Medicine, Miami anchors one of the Southeast’s largest clinical-research corridors.',
  },
  {
    name: 'Miami Beach', slug: 'miami-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 82000, medianIncome: 60000, tier: 1, region: 'Greater Miami', county: 'Miami-Dade',
    zips: ['33139', '33140', '33141'],
    localBlurb: 'An affluent barrier-island city from South Beach to Mid-Beach with a dense concentration of private practices and independent research offices.',
  },
  {
    name: 'Coral Gables', slug: 'coral-gables', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 50000, medianIncome: 120000, tier: 1, region: 'Greater Miami', county: 'Miami-Dade',
    zips: ['33134', '33146', '33156'],
    localBlurb: 'Home to the University of Miami main campus, the City Beautiful hosts a highly educated research community and numerous biomedical firms.',
  },
  {
    name: 'Aventura', slug: 'aventura', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 40000, medianIncome: 75000, tier: 1, region: 'Greater Miami', county: 'Miami-Dade',
    zips: ['33180'],
    localBlurb: 'A dense, high-income enclave in northeast Miami-Dade with a cluster of medical and specialty-practice offices.',
  },
  {
    name: 'Doral', slug: 'doral', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 75000, medianIncome: 90000, tier: 1, region: 'Greater Miami', county: 'Miami-Dade',
    zips: ['33122', '33166', '33178'],
    localBlurb: 'A fast-growing business hub near Miami International Airport with extensive logistics and life-science trade activity.',
  },
  {
    name: 'Hialeah', slug: 'hialeah', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 223000, medianIncome: 40000, tier: 3, region: 'Greater Miami', county: 'Miami-Dade',
    zips: ['33010', '33012', '33016'],
    localBlurb: 'One of Florida’s largest cities and a major light-industrial and medical-services center in the heart of Miami-Dade.',
  },
  {
    name: 'Homestead', slug: 'homestead', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 80000, medianIncome: 48000, tier: 3, region: 'Greater Miami', county: 'Miami-Dade',
    zips: ['33030', '33033', '33035'],
    localBlurb: 'A South Dade agricultural and residential hub near Everglades and Biscayne national parks with growing healthcare demand.',
  },
  {
    name: 'Pinecrest', slug: 'pinecrest', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 19000, medianIncome: 160000, tier: 1, region: 'Greater Miami', county: 'Miami-Dade',
    zips: ['33156', '33158'],
    localBlurb: 'An affluent, leafy village south of Coral Gables known for large estates and a highly educated professional population.',
  },
  {
    name: 'Palmetto Bay', slug: 'palmetto-bay', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 24000, medianIncome: 130000, tier: 1, region: 'Greater Miami', county: 'Miami-Dade',
    zips: ['33157', '33158'],
    localBlurb: 'A quiet, upscale bayfront village in South Miami-Dade favored by physicians and research professionals.',
  },
  {
    name: 'Cutler Bay', slug: 'cutler-bay', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 45000, medianIncome: 70000, tier: 2, region: 'Greater Miami', county: 'Miami-Dade',
    zips: ['33157', '33189', '33190'],
    localBlurb: 'A planned coastal town in South Dade with steadily rising demand for clinical and laboratory services.',
  },
  {
    name: 'Key Biscayne', slug: 'key-biscayne', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 14000, medianIncome: 175000, tier: 1, region: 'Greater Miami', county: 'Miami-Dade',
    zips: ['33149'],
    localBlurb: 'An island village off the Rickenbacker Causeway with one of the highest household-income profiles in the county.',
  },
  {
    name: 'Miami Lakes', slug: 'miami-lakes', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 31000, medianIncome: 85000, tier: 2, region: 'Greater Miami', county: 'Miami-Dade',
    zips: ['33014', '33016', '33018'],
    localBlurb: 'A master-planned town in northwest Miami-Dade with a strong base of professional and medical offices.',
  },
  {
    name: 'North Miami', slug: 'north-miami', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 60000, medianIncome: 45000, tier: 3, region: 'Greater Miami', county: 'Miami-Dade',
    zips: ['33161', '33181'],
    localBlurb: 'Home to a Florida International University campus and a diverse, growing research and healthcare workforce.',
  },
  {
    name: 'North Miami Beach', slug: 'north-miami-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 43000, medianIncome: 47000, tier: 3, region: 'Greater Miami', county: 'Miami-Dade',
    zips: ['33160', '33162', '33179'],
    localBlurb: 'A dense northeast Miami-Dade city with expanding outpatient and diagnostic services.',
  },
  {
    name: 'Sunny Isles Beach', slug: 'sunny-isles-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 22000, medianIncome: 75000, tier: 1, region: 'Greater Miami', county: 'Miami-Dade',
    zips: ['33160'],
    localBlurb: 'A high-rise oceanfront city between Miami and Fort Lauderdale with an affluent international resident base.',
  },
  {
    name: 'Miami Gardens', slug: 'miami-gardens', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 111000, medianIncome: 47000, tier: 3, region: 'Greater Miami', county: 'Miami-Dade',
    zips: ['33056', '33169', '33055'],
    localBlurb: 'The largest majority-Black city in Florida and home to Hard Rock Stadium and a growing healthcare sector.',
  },
  {
    name: 'South Miami', slug: 'south-miami', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 12000, medianIncome: 80000, tier: 2, region: 'Greater Miami', county: 'Miami-Dade',
    zips: ['33143', '33146'],
    localBlurb: 'A compact city adjacent to the University of Miami and South Miami Hospital with a dense medical-office footprint.',
  },
  {
    name: 'Kendall', slug: 'kendall', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 75000, medianIncome: 75000, tier: 2, region: 'Greater Miami', county: 'Miami-Dade',
    zips: ['33156', '33176', '33183'],
    localBlurb: 'A large suburban district in southwest Miami-Dade anchored by Baptist Hospital and numerous specialty clinics.',
  },
  {
    name: 'Fort Lauderdale', slug: 'fort-lauderdale', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 183000, medianIncome: 58000, tier: 2, region: 'Greater Fort Lauderdale', county: 'Broward',
    zips: ['33301', '33304', '33308'],
    localBlurb: 'Broward’s coastal hub, home to Broward Health Medical Center and a dense corridor of clinics and research offices.',
  },
  {
    name: 'Hollywood', slug: 'hollywood', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 153000, medianIncome: 52000, tier: 3, region: 'Greater Fort Lauderdale', county: 'Broward',
    zips: ['33019', '33020', '33021'],
    localBlurb: 'A large beachfront city between Miami and Fort Lauderdale anchored by Memorial Regional Hospital.',
  },
  {
    name: 'Pembroke Pines', slug: 'pembroke-pines', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 171000, medianIncome: 75000, tier: 2, region: 'Greater Fort Lauderdale', county: 'Broward',
    zips: ['33024', '33026', '33028'],
    localBlurb: 'One of Broward’s largest suburbs with a broad base of family medicine and outpatient research practices.',
  },
  {
    name: 'Miramar', slug: 'miramar', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 135000, medianIncome: 80000, tier: 2, region: 'Greater Fort Lauderdale', county: 'Broward',
    zips: ['33023', '33025', '33027'],
    localBlurb: 'A rapidly grown south Broward city hosting corporate campuses and a rising life-science workforce.',
  },
  {
    name: 'Coral Springs', slug: 'coral-springs', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 134000, medianIncome: 78000, tier: 2, region: 'Greater Fort Lauderdale', county: 'Broward',
    zips: ['33065', '33071', '33076'],
    localBlurb: 'A master-planned northwest Broward city known for strong schools and a well-educated professional population.',
  },
  {
    name: 'Pompano Beach', slug: 'pompano-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 115000, medianIncome: 52000, tier: 3, region: 'Greater Fort Lauderdale', county: 'Broward',
    zips: ['33060', '33062', '33069'],
    localBlurb: 'A revitalizing beach city in north Broward with growing outpatient and diagnostic capacity.',
  },
  {
    name: 'Davie', slug: 'davie', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 106000, medianIncome: 75000, tier: 2, region: 'Greater Fort Lauderdale', county: 'Broward',
    zips: ['33314', '33324', '33328'],
    localBlurb: 'Home to Nova Southeastern University and the South Florida Education Center, a genuine research and academic-medical cluster.',
  },
  {
    name: 'Plantation', slug: 'plantation', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 95000, medianIncome: 78000, tier: 2, region: 'Greater Fort Lauderdale', county: 'Broward',
    zips: ['33317', '33322', '33324'],
    localBlurb: 'A central Broward city with a large hospital campus and dense corridor of medical and professional offices.',
  },
  {
    name: 'Sunrise', slug: 'sunrise', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 97000, medianIncome: 62000, tier: 2, region: 'Greater Fort Lauderdale', county: 'Broward',
    zips: ['33322', '33323', '33351'],
    localBlurb: 'A west Broward city anchored by the Sawgrass corporate corridor and expanding healthcare services.',
  },
  {
    name: 'Weston', slug: 'weston', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 72000, medianIncome: 100000, tier: 2, region: 'Greater Fort Lauderdale', county: 'Broward',
    zips: ['33326', '33327', '33331'],
    localBlurb: 'An affluent master-planned city on the edge of the Everglades with one of Broward’s highest income profiles.',
  },
  {
    name: 'Parkland', slug: 'parkland', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 35000, medianIncome: 130000, tier: 1, region: 'Greater Fort Lauderdale', county: 'Broward',
    zips: ['33067', '33076'],
    localBlurb: 'A gated, high-income north Broward suburb with a highly educated resident base and strong demand for specialty care.',
  },
  {
    name: 'Coconut Creek', slug: 'coconut-creek', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 61000, medianIncome: 68000, tier: 2, region: 'Greater Fort Lauderdale', county: 'Broward',
    zips: ['33063', '33066', '33073'],
    localBlurb: 'A planned "Butterfly Capital" city in north Broward with steady growth in outpatient services.',
  },
  {
    name: 'Deerfield Beach', slug: 'deerfield-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 87000, medianIncome: 52000, tier: 3, region: 'Greater Fort Lauderdale', county: 'Broward',
    zips: ['33441', '33442'],
    localBlurb: 'A coastal north Broward city bordering Boca Raton with a growing base of clinics and labs.',
  },
  {
    name: 'Tamarac', slug: 'tamarac', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 71000, medianIncome: 55000, tier: 3, region: 'Greater Fort Lauderdale', county: 'Broward',
    zips: ['33319', '33321'],
    localBlurb: 'A central Broward city with a large senior population and expanding healthcare footprint.',
  },
  {
    name: 'Cooper City', slug: 'cooper-city', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 36000, medianIncome: 110000, tier: 1, region: 'Greater Fort Lauderdale', county: 'Broward',
    zips: ['33024', '33026', '33330'],
    localBlurb: 'A small, affluent, family-oriented suburb consistently ranked among Broward’s best places to live.',
  },
  {
    name: 'West Palm Beach', slug: 'west-palm-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 117000, medianIncome: 52000, tier: 2, region: 'Palm Beaches', county: 'Palm Beach',
    zips: ['33401', '33405', '33407'],
    localBlurb: 'The county seat and downtown core of the Palm Beaches, anchored by St. Mary’s and Good Samaritan medical centers.',
  },
  {
    name: 'Boca Raton', slug: 'boca-raton', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 99000, medianIncome: 80000, tier: 1, region: 'Palm Beaches', county: 'Palm Beach',
    zips: ['33431', '33432', '33433'],
    localBlurb: 'Home to Florida Atlantic University, the Max Planck Florida Institute for Neuroscience, and Scripps-linked research firms.',
  },
  {
    name: 'Boynton Beach', slug: 'boynton-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 81000, medianIncome: 55000, tier: 3, region: 'Palm Beaches', county: 'Palm Beach',
    zips: ['33426', '33435', '33436'],
    localBlurb: 'A growing coastal city in central Palm Beach County with expanding hospital and outpatient capacity.',
  },
  {
    name: 'Delray Beach', slug: 'delray-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 69000, medianIncome: 60000, tier: 2, region: 'Palm Beaches', county: 'Palm Beach',
    zips: ['33444', '33445', '33483'],
    localBlurb: 'A walkable coastal city known for its Atlantic Avenue district and a dense concentration of wellness and medical practices.',
  },
  {
    name: 'Palm Beach Gardens', slug: 'palm-beach-gardens', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 60000, medianIncome: 95000, tier: 1, region: 'Palm Beaches', county: 'Palm Beach',
    zips: ['33410', '33418'],
    localBlurb: 'An affluent north-county city home to the Scripps-anchored Florida biotech corridor and major hospital campuses.',
  },
  {
    name: 'Jupiter', slug: 'jupiter', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 66000, medianIncome: 92000, tier: 1, region: 'Palm Beaches', county: 'Palm Beach',
    zips: ['33458', '33469', '33477'],
    localBlurb: 'A coastal town hosting the FAU/Max Planck/Scripps Florida research cluster and a high-income professional base.',
  },
  {
    name: 'Wellington', slug: 'wellington', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 68000, medianIncome: 82000, tier: 2, region: 'Palm Beaches', county: 'Palm Beach',
    zips: ['33414', '33449'],
    localBlurb: 'An affluent equestrian village west of West Palm Beach with strong demand for specialty and sports-medicine research.',
  },
  {
    name: 'Palm Beach', slug: 'palm-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 9000, medianIncome: 200000, tier: 1, region: 'Palm Beaches', county: 'Palm Beach',
    zips: ['33480'],
    localBlurb: 'One of the wealthiest communities in the United States, a barrier-island town of private practices and discreet research clients.',
  },
  {
    name: 'Lake Worth Beach', slug: 'lake-worth-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 43000, medianIncome: 48000, tier: 3, region: 'Palm Beaches', county: 'Palm Beach',
    zips: ['33460', '33461', '33463'],
    localBlurb: 'An eclectic coastal city just south of West Palm Beach with a growing independent-practice community.',
  },
  {
    name: 'Royal Palm Beach', slug: 'royal-palm-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 40000, medianIncome: 78000, tier: 2, region: 'Palm Beaches', county: 'Palm Beach',
    zips: ['33411', '33414'],
    localBlurb: 'A planned western-communities village with steady suburban growth and expanding outpatient services.',
  },
  {
    name: 'Greenacres', slug: 'greenacres', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 45000, medianIncome: 52000, tier: 3, region: 'Palm Beaches', county: 'Palm Beach',
    zips: ['33413', '33463', '33467'],
    localBlurb: 'A central Palm Beach County city with a diverse population and growing primary-care demand.',
  },
  {
    name: 'Naples', slug: 'naples', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 22000, medianIncome: 110000, tier: 1, region: 'Southwest Florida', county: 'Collier',
    zips: ['34102', '34103', '34104'],
    localBlurb: 'A wealthy Gulf-front city and Collier County seat with a high concentration of concierge medicine and private research clients.',
  },
  {
    name: 'Marco Island', slug: 'marco-island', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 18000, medianIncome: 95000, tier: 1, region: 'Southwest Florida', county: 'Collier',
    zips: ['34145'],
    localBlurb: 'An upscale barrier-island city south of Naples requiring reliable, climate-controlled logistics for temperature-sensitive shipments.',
  },
  {
    name: 'Bonita Springs', slug: 'bonita-springs', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 55000, medianIncome: 73000, tier: 2, region: 'Southwest Florida', county: 'Lee',
    zips: ['34134', '34135'],
    localBlurb: 'A coastal Lee County city between Naples and Fort Myers with a fast-growing retiree and healthcare population.',
  },
  {
    name: 'Fort Myers', slug: 'fort-myers', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 92000, medianIncome: 50000, tier: 3, region: 'Southwest Florida', county: 'Lee',
    zips: ['33901', '33907', '33916'],
    localBlurb: 'The Lee County seat and regional medical hub anchored by Lee Health’s hospital system.',
  },
  {
    name: 'Cape Coral', slug: 'cape-coral', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 216000, medianIncome: 62000, tier: 2, region: 'Southwest Florida', county: 'Lee',
    zips: ['33904', '33914', '33990'],
    localBlurb: 'One of Florida’s fastest-growing cities, a sprawling canal community with rapidly expanding healthcare demand.',
  },
  {
    name: 'Estero', slug: 'estero', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 38000, medianIncome: 78000, tier: 2, region: 'Southwest Florida', county: 'Lee',
    zips: ['33928', '33967', '34135'],
    localBlurb: 'A planned village between Fort Myers and Naples near Florida Gulf Coast University and Hertz Arena.',
  },
  {
    name: 'Sanibel', slug: 'sanibel', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 6500, medianIncome: 100000, tier: 1, region: 'Southwest Florida', county: 'Lee',
    zips: ['33957'],
    localBlurb: 'An affluent barrier island known for its wildlife refuge and a small, high-income seasonal-resident base.',
  },
  {
    name: 'Punta Gorda', slug: 'punta-gorda', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 20000, medianIncome: 60000, tier: 2, region: 'Southwest Florida', county: 'Charlotte',
    zips: ['33950', '33955', '33982'],
    localBlurb: 'The Charlotte County seat, a harborfront city with a growing retiree healthcare market.',
  },
  {
    name: 'Port Charlotte', slug: 'port-charlotte', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 60000, medianIncome: 52000, tier: 3, region: 'Southwest Florida', county: 'Charlotte',
    zips: ['33948', '33952', '33980'],
    localBlurb: 'A large Gulf-coast community anchored by regional hospitals serving Charlotte County.',
  },
  {
    name: 'Sarasota', slug: 'sarasota', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 57000, medianIncome: 60000, tier: 2, region: 'Sarasota-Bradenton', county: 'Sarasota',
    zips: ['34236', '34237', '34239'],
    localBlurb: 'A cultural Gulf-coast city home to Sarasota Memorial Hospital and a strong arts-and-sciences professional community.',
  },
  {
    name: 'Venice', slug: 'venice', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 25000, medianIncome: 65000, tier: 2, region: 'Sarasota-Bradenton', county: 'Sarasota',
    zips: ['34285', '34292', '34293'],
    localBlurb: 'A coastal island city south of Sarasota with a large retiree base and expanding hospital services.',
  },
  {
    name: 'North Port', slug: 'north-port', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 80000, medianIncome: 62000, tier: 3, region: 'Sarasota-Bradenton', county: 'Sarasota',
    zips: ['34286', '34287', '34288'],
    localBlurb: 'One of the fastest-growing cities in Southwest Florida with rapidly rising demand for healthcare and labs.',
  },
  {
    name: 'Bradenton', slug: 'bradenton', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 60000, medianIncome: 50000, tier: 3, region: 'Sarasota-Bradenton', county: 'Manatee',
    zips: ['34205', '34207', '34208'],
    localBlurb: 'The Manatee County seat, home to Manatee Memorial and a growing riverfront medical district.',
  },
  {
    name: 'Lakewood Ranch', slug: 'lakewood-ranch', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 55000, medianIncome: 105000, tier: 1, region: 'Sarasota-Bradenton', county: 'Manatee',
    zips: ['34202', '34211', '34240'],
    localBlurb: 'A large, affluent master-planned community straddling Manatee and Sarasota counties with a rapidly growing medical park.',
  },
  {
    name: 'Tampa', slug: 'tampa', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 399000, medianIncome: 57000, tier: 2, region: 'Tampa Bay', county: 'Hillsborough',
    zips: ['33602', '33606', '33609'],
    localBlurb: 'A major metro anchored by USF Health, Tampa General, and Moffitt Cancer Center’s expanding research campuses.',
  },
  {
    name: 'St. Petersburg', slug: 'st-petersburg', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 259000, medianIncome: 55000, tier: 2, region: 'Tampa Bay', county: 'Pinellas',
    zips: ['33701', '33704', '33710'],
    localBlurb: 'A waterfront city with Johns Hopkins All Children’s Hospital and a growing life-science and marine-science sector.',
  },
  {
    name: 'Clearwater', slug: 'clearwater', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 117000, medianIncome: 52000, tier: 3, region: 'Tampa Bay', county: 'Pinellas',
    zips: ['33755', '33759', '33763'],
    localBlurb: 'A Gulf-beach city and Pinellas hub with Morton Plant Hospital and a dense corridor of clinics.',
  },
  {
    name: 'Brandon', slug: 'brandon', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 115000, medianIncome: 65000, tier: 3, region: 'Tampa Bay', county: 'Hillsborough',
    zips: ['33510', '33511'],
    localBlurb: 'A large suburban community east of Tampa anchored by a regional hospital and outpatient centers.',
  },
  {
    name: 'Riverview', slug: 'riverview', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 100000, medianIncome: 78000, tier: 2, region: 'Tampa Bay', county: 'Hillsborough',
    zips: ['33569', '33578', '33579'],
    localBlurb: 'One of Hillsborough County’s fastest-growing suburbs with surging demand for medical services.',
  },
  {
    name: 'Wesley Chapel', slug: 'wesley-chapel', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 65000, medianIncome: 85000, tier: 2, region: 'Tampa Bay', county: 'Pasco',
    zips: ['33543', '33544', '33545'],
    localBlurb: 'A booming Pasco County suburb north of Tampa with major new hospital and medical-office growth.',
  },
  {
    name: 'Largo', slug: 'largo', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 84000, medianIncome: 50000, tier: 3, region: 'Tampa Bay', county: 'Pinellas',
    zips: ['33770', '33771', '33773'],
    localBlurb: 'A central Pinellas city with a large medical district around Largo Medical Center.',
  },
  {
    name: 'Palm Harbor', slug: 'palm-harbor', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 60000, medianIncome: 78000, tier: 2, region: 'Tampa Bay', county: 'Pinellas',
    zips: ['34683', '34684', '34685'],
    localBlurb: 'An affluent unincorporated community in north Pinellas with a well-educated professional population.',
  },
  {
    name: 'Dunedin', slug: 'dunedin', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 36000, medianIncome: 62000, tier: 2, region: 'Tampa Bay', county: 'Pinellas',
    zips: ['34698'],
    localBlurb: 'A coastal north Pinellas city with a walkable downtown and steady healthcare growth.',
  },
  {
    name: 'Pinellas Park', slug: 'pinellas-park', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 53000, medianIncome: 50000, tier: 3, region: 'Tampa Bay', county: 'Pinellas',
    zips: ['33781', '33782'],
    localBlurb: 'A centrally located Pinellas city with light-industrial and medical-services activity.',
  },
  {
    name: 'Tarpon Springs', slug: 'tarpon-springs', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 26000, medianIncome: 58000, tier: 2, region: 'Tampa Bay', county: 'Pinellas',
    zips: ['34689'],
    localBlurb: 'A historic Gulf-coast city known for its sponge docks and a tight-knit medical community.',
  },
  {
    name: 'New Port Richey', slug: 'new-port-richey', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 16000, medianIncome: 45000, tier: 3, region: 'Tampa Bay', county: 'Pasco',
    zips: ['34652', '34653', '34655'],
    localBlurb: 'A west Pasco city anchored by regional hospitals serving a large retiree population.',
  },
  {
    name: 'Plant City', slug: 'plant-city', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 40000, medianIncome: 52000, tier: 3, region: 'Tampa Bay', county: 'Hillsborough',
    zips: ['33563', '33565', '33566'],
    localBlurb: 'An agricultural hub between Tampa and Lakeland famous for strawberries and a growing regional medical center.',
  },
  {
    name: 'Zephyrhills', slug: 'zephyrhills', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 18000, medianIncome: 40000, tier: 3, region: 'Tampa Bay', county: 'Pasco',
    zips: ['33540', '33541', '33542'],
    localBlurb: 'An east Pasco city with a large retiree base and expanding outpatient care.',
  },
  {
    name: 'Orlando', slug: 'orlando', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 307000, medianIncome: 50000, tier: 2, region: 'Greater Orlando', county: 'Orange',
    zips: ['32801', '32803', '32806'],
    localBlurb: 'Home to the Lake Nona Medical City cluster — UCF College of Medicine, Nemours, and the VA hospital — a fast-rising research metro.',
  },
  {
    name: 'Winter Park', slug: 'winter-park', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 30000, medianIncome: 95000, tier: 1, region: 'Greater Orlando', county: 'Orange',
    zips: ['32789', '32792'],
    localBlurb: 'An affluent city just north of Orlando home to Rollins College and AdventHealth’s flagship campus nearby.',
  },
  {
    name: 'Winter Garden', slug: 'winter-garden', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 47000, medianIncome: 82000, tier: 2, region: 'Greater Orlando', county: 'Orange',
    zips: ['34787'],
    localBlurb: 'A fast-growing west Orange County city with a revitalized downtown and expanding medical offices.',
  },
  {
    name: 'Apopka', slug: 'apopka', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 55000, medianIncome: 70000, tier: 3, region: 'Greater Orlando', county: 'Orange',
    zips: ['32703', '32712'],
    localBlurb: 'A growing northwest Orange County city with rising suburban healthcare demand.',
  },
  {
    name: 'Ocoee', slug: 'ocoee', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 48000, medianIncome: 72000, tier: 2, region: 'Greater Orlando', county: 'Orange',
    zips: ['34761'],
    localBlurb: 'A west Orange County suburb near the 429 corridor with steady residential and medical growth.',
  },
  {
    name: 'Maitland', slug: 'maitland', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 20000, medianIncome: 90000, tier: 1, region: 'Greater Orlando', county: 'Orange',
    zips: ['32751'],
    localBlurb: 'An affluent office-park city just north of Orlando with a concentration of professional and medical firms.',
  },
  {
    name: 'Sanford', slug: 'sanford', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 61000, medianIncome: 50000, tier: 3, region: 'Greater Orlando', county: 'Seminole',
    zips: ['32771', '32773'],
    localBlurb: 'The Seminole County seat on Lake Monroe with a historic downtown and growing healthcare sector.',
  },
  {
    name: 'Altamonte Springs', slug: 'altamonte-springs', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 46000, medianIncome: 60000, tier: 2, region: 'Greater Orlando', county: 'Seminole',
    zips: ['32701', '32714'],
    localBlurb: 'A commercial hub in south Seminole County anchored by AdventHealth Altamonte.',
  },
  {
    name: 'Lake Mary', slug: 'lake-mary', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 17000, medianIncome: 95000, tier: 1, region: 'Greater Orlando', county: 'Seminole',
    zips: ['32746'],
    localBlurb: 'An affluent corporate-office city in Seminole County with a highly educated professional base.',
  },
  {
    name: 'Oviedo', slug: 'oviedo', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 41000, medianIncome: 92000, tier: 2, region: 'Greater Orlando', county: 'Seminole',
    zips: ['32765', '32766'],
    localBlurb: 'A well-off Seminole County suburb near UCF with strong demand for specialty care.',
  },
  {
    name: 'Winter Springs', slug: 'winter-springs', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 38000, medianIncome: 85000, tier: 2, region: 'Greater Orlando', county: 'Seminole',
    zips: ['32708'],
    localBlurb: 'A green, family-oriented Seminole County city with steady suburban healthcare growth.',
  },
  {
    name: 'Kissimmee', slug: 'kissimmee', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 80000, medianIncome: 45000, tier: 3, region: 'Greater Orlando', county: 'Osceola',
    zips: ['34741', '34744', '34746'],
    localBlurb: 'The Osceola County seat near the theme-park corridor with a rapidly growing, diverse population.',
  },
  {
    name: 'St. Cloud', slug: 'st-cloud', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 60000, medianIncome: 62000, tier: 3, region: 'Greater Orlando', county: 'Osceola',
    zips: ['34769', '34771', '34772'],
    localBlurb: 'A fast-growing Osceola County city southeast of Orlando with expanding medical services.',
  },
  {
    name: 'Clermont', slug: 'clermont', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 43000, medianIncome: 68000, tier: 2, region: 'Greater Orlando', county: 'Lake',
    zips: ['34711', '34714', '34715'],
    localBlurb: 'A hilly Lake County city known for endurance-sports training and rapid suburban growth.',
  },
  {
    name: 'Melbourne', slug: 'melbourne', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 84000, medianIncome: 55000, tier: 3, region: 'Space Coast', county: 'Brevard',
    zips: ['32901', '32904', '32935'],
    localBlurb: 'A Space Coast city with a strong aerospace-engineering workforce and Health First’s flagship hospital.',
  },
  {
    name: 'Palm Bay', slug: 'palm-bay', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 120000, medianIncome: 55000, tier: 3, region: 'Space Coast', county: 'Brevard',
    zips: ['32907', '32908', '32909'],
    localBlurb: 'Brevard’s largest city, a fast-growing residential and light-industrial community south of Melbourne.',
  },
  {
    name: 'Titusville', slug: 'titusville', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 48000, medianIncome: 48000, tier: 3, region: 'Space Coast', county: 'Brevard',
    zips: ['32780', '32796'],
    localBlurb: 'A Space Coast city adjacent to Kennedy Space Center with a technical, engineering-heavy workforce.',
  },
  {
    name: 'Merritt Island', slug: 'merritt-island', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 36000, medianIncome: 62000, tier: 2, region: 'Space Coast', county: 'Brevard',
    zips: ['32952', '32953'],
    localBlurb: 'A barrier-island community next to Kennedy Space Center with a skilled aerospace population.',
  },
  {
    name: 'Rockledge', slug: 'rockledge', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 28000, medianIncome: 68000, tier: 2, region: 'Space Coast', county: 'Brevard',
    zips: ['32955', '32956'],
    localBlurb: 'A riverfront Brevard city home to a major regional medical center.',
  },
  {
    name: 'Viera', slug: 'viera', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 20000, medianIncome: 90000, tier: 1, region: 'Space Coast', county: 'Brevard',
    zips: ['32940', '32955'],
    localBlurb: 'A master-planned Brevard community with a growing medical city and an affluent professional base.',
  },
  {
    name: 'Stuart', slug: 'stuart', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 17000, medianIncome: 55000, tier: 2, region: 'Treasure Coast', county: 'Martin',
    zips: ['34994', '34996', '34997'],
    localBlurb: 'The Martin County seat and Treasure Coast hub anchored by Cleveland Clinic Martin Health.',
  },
  {
    name: 'Palm City', slug: 'palm-city', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 24000, medianIncome: 90000, tier: 1, region: 'Treasure Coast', county: 'Martin',
    zips: ['34990'],
    localBlurb: 'An affluent, low-density Martin County community with strong demand for concierge and specialty care.',
  },
  {
    name: 'Port St. Lucie', slug: 'port-st-lucie', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 231000, medianIncome: 60000, tier: 2, region: 'Treasure Coast', county: 'St. Lucie',
    zips: ['34952', '34953', '34984'],
    localBlurb: 'One of Florida’s fastest-growing cities and home to the Torrey Pines and Cleveland Clinic research presence on the Treasure Coast.',
  },
  {
    name: 'Fort Pierce', slug: 'fort-pierce', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 47000, medianIncome: 40000, tier: 3, region: 'Treasure Coast', county: 'St. Lucie',
    zips: ['34946', '34947', '34950'],
    localBlurb: 'The St. Lucie County seat, a historic port city home to Harbor Branch Oceanographic research.',
  },
  {
    name: 'Vero Beach', slug: 'vero-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 17000, medianIncome: 55000, tier: 2, region: 'Treasure Coast', county: 'Indian River',
    zips: ['32960', '32962', '32963'],
    localBlurb: 'An upscale coastal city and Indian River County seat with a well-off retiree and professional community.',
  },
  {
    name: 'Sebastian', slug: 'sebastian', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 26000, medianIncome: 55000, tier: 3, region: 'Treasure Coast', county: 'Indian River',
    zips: ['32958', '32976'],
    localBlurb: 'A riverfront Indian River County city with a growing residential and healthcare base.',
  },
  {
    name: 'Jacksonville', slug: 'jacksonville', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 949000, medianIncome: 55000, tier: 2, region: 'Jacksonville / First Coast', county: 'Duval',
    zips: ['32202', '32207', '32256'],
    localBlurb: 'Florida’s largest city by population, home to Mayo Clinic Jacksonville, UF Health, and a deep clinical-research base.',
  },
  {
    name: 'Jacksonville Beach', slug: 'jacksonville-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 24000, medianIncome: 72000, tier: 2, region: 'Jacksonville / First Coast', county: 'Duval',
    zips: ['32250'],
    localBlurb: 'An oceanfront Duval County city with an affluent, active professional population.',
  },
  {
    name: 'Atlantic Beach', slug: 'atlantic-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 14000, medianIncome: 80000, tier: 1, region: 'Jacksonville / First Coast', county: 'Duval',
    zips: ['32233'],
    localBlurb: 'A small, well-off beach city at the north end of Jacksonville’s coastal communities.',
  },
  {
    name: 'Ponte Vedra Beach', slug: 'ponte-vedra-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 35000, medianIncome: 120000, tier: 1, region: 'Jacksonville / First Coast', county: 'St. Johns',
    zips: ['32082'],
    localBlurb: 'An affluent St. Johns County coastal community, home to the PGA Tour and a high-income resident base.',
  },
  {
    name: 'St. Augustine', slug: 'st-augustine', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 15000, medianIncome: 55000, tier: 2, region: 'Jacksonville / First Coast', county: 'St. Johns',
    zips: ['32080', '32084', '32086'],
    localBlurb: 'The nation’s oldest city and St. Johns County seat with a growing regional medical presence.',
  },
  {
    name: 'Nocatee', slug: 'nocatee', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 20000, medianIncome: 130000, tier: 1, region: 'Jacksonville / First Coast', county: 'St. Johns',
    zips: ['32081'],
    localBlurb: 'A rapidly growing, high-income master-planned community in St. Johns County south of Jacksonville.',
  },
  {
    name: 'Orange Park', slug: 'orange-park', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 8500, medianIncome: 55000, tier: 3, region: 'Jacksonville / First Coast', county: 'Clay',
    zips: ['32065', '32073'],
    localBlurb: 'A Clay County town southwest of Jacksonville anchored by a regional medical center.',
  },
  {
    name: 'Fleming Island', slug: 'fleming-island', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 30000, medianIncome: 95000, tier: 1, region: 'Jacksonville / First Coast', county: 'Clay',
    zips: ['32003'],
    localBlurb: 'An affluent Clay County community on the St. Johns River with a highly educated professional base.',
  },
  {
    name: 'Fernandina Beach', slug: 'fernandina-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 13000, medianIncome: 65000, tier: 2, region: 'Jacksonville / First Coast', county: 'Nassau',
    zips: ['32034'],
    localBlurb: 'A historic Amelia Island city and Nassau County seat with a growing coastal healthcare market.',
  },
  {
    name: 'Gainesville', slug: 'gainesville', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 141000, medianIncome: 40000, tier: 3, region: 'North Central Florida', county: 'Alachua',
    zips: ['32601', '32605', '32608'],
    localBlurb: 'Home to the University of Florida and UF Health Shands — one of the largest academic-medical and research centers in the Southeast.',
  },
  {
    name: 'Ocala', slug: 'ocala', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 63000, medianIncome: 45000, tier: 3, region: 'North Central Florida', county: 'Marion',
    zips: ['34470', '34471', '34474'],
    localBlurb: 'The Marion County seat and "Horse Capital of the World," with a large regional hospital system.',
  },
  {
    name: 'Lakeland', slug: 'lakeland', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 112000, medianIncome: 52000, tier: 3, region: 'Central Florida', county: 'Polk',
    zips: ['33801', '33803', '33809'],
    localBlurb: 'The largest city in Polk County, anchored by Lakeland Regional Health between Tampa and Orlando.',
  },
  {
    name: 'Winter Haven', slug: 'winter-haven', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 50000, medianIncome: 50000, tier: 3, region: 'Central Florida', county: 'Polk',
    zips: ['33880', '33881', '33884'],
    localBlurb: 'A chain-of-lakes city in Polk County home to a major regional hospital and steady growth.',
  },
  {
    name: 'Sebring', slug: 'sebring', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 11000, medianIncome: 40000, tier: 3, region: 'Central Florida', county: 'Highlands',
    zips: ['33870', '33872'],
    localBlurb: 'The Highlands County seat, a lakeside city with a regional medical center serving south-central Florida.',
  },
  {
    name: 'Daytona Beach', slug: 'daytona-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 73000, medianIncome: 42000, tier: 3, region: 'Daytona Beach / Volusia', county: 'Volusia',
    zips: ['32114', '32117', '32118'],
    localBlurb: 'A coastal Volusia city home to Embry-Riddle Aeronautical University and Halifax Health.',
  },
  {
    name: 'Port Orange', slug: 'port-orange', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 63000, medianIncome: 62000, tier: 2, region: 'Daytona Beach / Volusia', county: 'Volusia',
    zips: ['32127', '32128', '32129'],
    localBlurb: 'A growing suburban Volusia city just south of Daytona Beach with expanding outpatient services.',
  },
  {
    name: 'Ormond Beach', slug: 'ormond-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 44000, medianIncome: 60000, tier: 2, region: 'Daytona Beach / Volusia', county: 'Volusia',
    zips: ['32174', '32176'],
    localBlurb: 'A historic coastal city north of Daytona with an affluent, active retiree population.',
  },
  {
    name: 'Deltona', slug: 'deltona', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 94000, medianIncome: 58000, tier: 3, region: 'Daytona Beach / Volusia', county: 'Volusia',
    zips: ['32725', '32738'],
    localBlurb: 'Volusia County’s largest city, a fast-grown bedroom community between Orlando and Daytona.',
  },
  {
    name: 'New Smyrna Beach', slug: 'new-smyrna-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 30000, medianIncome: 60000, tier: 2, region: 'Daytona Beach / Volusia', county: 'Volusia',
    zips: ['32168', '32169'],
    localBlurb: 'A coastal Volusia city popular with an affluent, health-conscious resident base.',
  },
  {
    name: 'DeLand', slug: 'deland', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 40000, medianIncome: 48000, tier: 3, region: 'Daytona Beach / Volusia', county: 'Volusia',
    zips: ['32720', '32724'],
    localBlurb: 'The Volusia County seat and home to Stetson University with a walkable historic downtown.',
  },
  {
    name: 'Tallahassee', slug: 'tallahassee', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 197000, medianIncome: 48000, tier: 3, region: 'Tallahassee / Big Bend', county: 'Leon',
    zips: ['32301', '32303', '32308'],
    localBlurb: 'The state capital, home to Florida State and Florida A&M universities and a growing academic-research base.',
  },
  {
    name: 'Pensacola', slug: 'pensacola', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 54000, medianIncome: 50000, tier: 3, region: 'Florida Panhandle', county: 'Escambia',
    zips: ['32501', '32503', '32505'],
    localBlurb: 'The westernmost city in Florida, a Gulf-coast hub anchored by Baptist and Ascension Sacred Heart hospitals.',
  },
  {
    name: 'Destin', slug: 'destin', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 14000, medianIncome: 75000, tier: 1, region: 'Emerald Coast', county: 'Okaloosa',
    zips: ['32541'],
    localBlurb: 'An upscale Emerald Coast resort city with an affluent seasonal and second-home population.',
  },
  {
    name: 'Fort Walton Beach', slug: 'fort-walton-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 22000, medianIncome: 55000, tier: 2, region: 'Emerald Coast', county: 'Okaloosa',
    zips: ['32547', '32548'],
    localBlurb: 'An Emerald Coast city near Eglin Air Force Base with a strong military-medical and engineering community.',
  },
  {
    name: 'Niceville', slug: 'niceville', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 16000, medianIncome: 72000, tier: 2, region: 'Emerald Coast', county: 'Okaloosa',
    zips: ['32578'],
    localBlurb: 'An affluent Okaloosa County city on Boggy Bayou near Eglin AFB with a well-educated workforce.',
  },
  {
    name: 'Crestview', slug: 'crestview', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 28000, medianIncome: 58000, tier: 3, region: 'Emerald Coast', county: 'Okaloosa',
    zips: ['32536', '32539'],
    localBlurb: 'The Okaloosa County seat and fast-growing inland hub of the Emerald Coast.',
  },
  {
    name: 'Panama City', slug: 'panama-city', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 36000, medianIncome: 48000, tier: 3, region: 'Florida Panhandle', county: 'Bay',
    zips: ['32401', '32404', '32405'],
    localBlurb: 'The Bay County seat and Panhandle medical hub anchored by Ascension Sacred Heart and HCA Gulf Coast.',
  },
  {
    name: 'Panama City Beach', slug: 'panama-city-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 18000, medianIncome: 60000, tier: 2, region: 'Emerald Coast', county: 'Bay',
    zips: ['32407', '32408', '32413'],
    localBlurb: 'A Gulf-front resort city with a rapidly growing year-round population and healthcare demand.',
  },
  {
    name: 'Gulf Breeze', slug: 'gulf-breeze', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 6500, medianIncome: 90000, tier: 1, region: 'Emerald Coast', county: 'Santa Rosa',
    zips: ['32561', '32563'],
    localBlurb: 'An affluent Santa Rosa County peninsula city between Pensacola and Pensacola Beach.',
  },
  {
    name: 'Santa Rosa Beach', slug: 'santa-rosa-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 5000, medianIncome: 95000, tier: 1, region: 'Emerald Coast', county: 'Walton',
    zips: ['32459'],
    localBlurb: 'An upscale South Walton community along the 30A corridor with a high-income second-home base.',
  },
  {
    name: 'Key West', slug: 'key-west', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 26000, medianIncome: 65000, tier: 1, region: 'Florida Keys', county: 'Monroe',
    zips: ['33040'],
    localBlurb: 'The southernmost city in the continental U.S., a Monroe County hub requiring careful cold-chain logistics.',
  },
  {
    name: 'Key Largo', slug: 'key-largo', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 10000, medianIncome: 62000, tier: 2, region: 'Florida Keys', county: 'Monroe',
    zips: ['33037'],
    localBlurb: 'The first of the Florida Keys, a diving and marine-science community in northern Monroe County.',
  },
  {
    name: 'Marathon', slug: 'marathon', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 8500, medianIncome: 58000, tier: 2, region: 'Florida Keys', county: 'Monroe',
    zips: ['33050'],
    localBlurb: 'A Middle Keys city anchored by Fishermen’s Community Hospital and a marine-research presence.',
  },
  {
    name: 'Spring Hill', slug: 'spring-hill', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL',
    population: 113000, medianIncome: 55000, tier: 3, region: 'Nature Coast', county: 'Hernando',
    zips: ['34606', '34608', '34609'],
    localBlurb: 'A large Hernando County community north of Tampa Bay with a substantial retiree healthcare market.',
  },

  // ─────────────────────────────────────────────
  // TEXAS
  // ─────────────────────────────────────────────
  {
    name: 'Plano', slug: 'plano', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 290000, medianIncome: 90000, tier: 1, region: 'Greater Dallas', county: 'Collin',
    zips: ['75023', '75024', '75025'],
    localBlurb: 'A corporate headquarters hub in Collin County with a highly educated workforce and major medical campuses.',
  },
  {
    name: 'Frisco', slug: 'frisco', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 220000, medianIncome: 115000, tier: 1, region: 'Greater Dallas', county: 'Collin',
    zips: ['75033', '75034', '75035'],
    localBlurb: 'One of the fastest-growing affluent cities in America, anchoring the north Collin County growth corridor.',
  },
  {
    name: 'McKinney', slug: 'mckinney', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 206000, medianIncome: 92000, tier: 2, region: 'Greater Dallas', county: 'Collin',
    zips: ['75069', '75070', '75071'],
    localBlurb: 'The Collin County seat, a fast-growing city with a historic downtown and expanding hospital system.',
  },
  {
    name: 'Allen', slug: 'allen', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 108000, medianIncome: 97000, tier: 2, region: 'Greater Dallas', county: 'Collin',
    zips: ['75002', '75013'],
    localBlurb: 'An affluent Collin County suburb known for strong schools and a well-educated professional base.',
  },
  {
    name: 'Southlake', slug: 'southlake', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 32000, medianIncome: 200000, tier: 1, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76092'],
    localBlurb: 'One of the wealthiest suburbs in Texas, a Tarrant County enclave with a high concentration of executives and physicians.',
  },
  {
    name: 'Colleyville', slug: 'colleyville', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 27000, medianIncome: 155000, tier: 1, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76034'],
    localBlurb: 'An upscale, low-density Tarrant County suburb between Dallas and Fort Worth with a high-income resident base.',
  },
  {
    name: 'Keller', slug: 'keller', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 52000, medianIncome: 108000, tier: 2, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76244', '76248'],
    localBlurb: 'A family-oriented northeast Tarrant County suburb with strong schools and rising healthcare demand.',
  },
  {
    name: 'Sugar Land', slug: 'sugar-land', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 118000, medianIncome: 102000, tier: 2, region: 'Greater Houston', county: 'Fort Bend',
    zips: ['77478', '77479', '77498'],
    localBlurb: 'An affluent, diverse master-planned city in Fort Bend County anchored by a large Houston Methodist campus.',
  },
  {
    name: 'The Woodlands', slug: 'the-woodlands', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 115000, medianIncome: 112000, tier: 1, region: 'Greater Houston', county: 'Montgomery',
    zips: ['77380', '77381', '77382'],
    localBlurb: 'A high-income master-planned community north of Houston with a major medical center and corporate campuses.',
  },
  {
    name: 'Katy', slug: 'katy', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 22000, medianIncome: 90000, tier: 2, region: 'Greater Houston', county: 'Harris',
    zips: ['77449', '77450', '77494'],
    localBlurb: 'A fast-growing west Houston suburb with a booming Energy Corridor healthcare and residential market.',
  },
  {
    name: 'Pearland', slug: 'pearland', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 130000, medianIncome: 88000, tier: 2, region: 'Greater Houston', county: 'Brazoria',
    zips: ['77581', '77584'],
    localBlurb: 'A rapidly grown Brazoria County suburb south of Houston with expanding hospital and clinic networks.',
  },
  {
    name: 'Round Rock', slug: 'round-rock', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 139000, medianIncome: 80000, tier: 2, region: 'Greater Austin', county: 'Williamson',
    zips: ['78664', '78665', '78681'],
    localBlurb: 'A tech-driven Williamson County city north of Austin anchored by Dell’s headquarters and a growing medical district.',
  },
  {
    name: 'Cedar Park', slug: 'cedar-park', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 87000, medianIncome: 95000, tier: 2, region: 'Greater Austin', county: 'Williamson',
    zips: ['78613'],
    localBlurb: 'An affluent, fast-growing northwest Austin suburb in Williamson County with strong healthcare demand.',
  },
  {
    name: 'Leander', slug: 'leander', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 72000, medianIncome: 88000, tier: 2, region: 'Greater Austin', county: 'Williamson',
    zips: ['78641', '78645'],
    localBlurb: 'One of the fastest-growing cities in the nation, a Williamson County suburb on Austin’s northwest edge.',
  },
  {
    name: 'Houston', slug: 'houston', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 2304000, medianIncome: 52000, tier: 2, region: 'Greater Houston', county: 'Harris',
    zips: ['77002', '77007', '77030'],
    localBlurb: 'Home to the Texas Medical Center — the largest medical complex in the world — anchoring an enormous clinical-research economy.',
  },
  {
    name: 'Dallas', slug: 'dallas', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 1304000, medianIncome: 54000, tier: 2, region: 'Greater Dallas', county: 'Dallas',
    zips: ['75201', '75204', '75219'],
    localBlurb: 'A major metro anchored by UT Southwestern Medical Center and a deep base of hospitals and biomedical research.',
  },
  {
    name: 'Austin', slug: 'austin', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 979000, medianIncome: 75000, tier: 2, region: 'Greater Austin', county: 'Travis',
    zips: ['78701', '78704', '78745'],
    localBlurb: 'The state capital and a fast-rising life-science hub anchored by the Dell Medical School at UT Austin.',
  },
  {
    name: 'San Antonio', slug: 'san-antonio', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 1434000, medianIncome: 52000, tier: 2, region: 'Greater San Antonio', county: 'Bexar',
    zips: ['78205', '78209', '78229'],
    localBlurb: 'Home to the South Texas Medical Center and UT Health San Antonio, one of the largest research-medical clusters in the state.',
  },
  {
    name: 'Fort Worth', slug: 'fort-worth', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 920000, medianIncome: 57000, tier: 2, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76102', '76107', '76109'],
    localBlurb: 'A large metro anchored by the growing TCU/UNTHSC medical school and a broad hospital network.',
  },
  {
    name: 'El Paso', slug: 'el-paso', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 678000, medianIncome: 48000, tier: 3, region: 'West Texas', county: 'El Paso',
    zips: ['79901', '79902', '79912'],
    localBlurb: 'A major border metro anchored by Texas Tech University Health Sciences Center El Paso.',
  },
  {
    name: 'Arlington', slug: 'arlington', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 394000, medianIncome: 58000, tier: 3, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76010', '76013', '76017'],
    localBlurb: 'A mid-cities hub between Dallas and Fort Worth home to UT Arlington and a large hospital presence.',
  },
  {
    name: 'Corpus Christi', slug: 'corpus-christi', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 317000, medianIncome: 52000, tier: 3, region: 'Gulf Coast', county: 'Nueces',
    zips: ['78401', '78411', '78414'],
    localBlurb: 'A Gulf-coast city and Nueces County seat with a regional medical center and marine-science institutions.',
  },
  {
    name: 'Lubbock', slug: 'lubbock', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 258000, medianIncome: 50000, tier: 3, region: 'West Texas', county: 'Lubbock',
    zips: ['79401', '79410', '79424'],
    localBlurb: 'The hub of the South Plains, home to Texas Tech University and its Health Sciences Center.',
  },
  {
    name: 'Irving', slug: 'irving', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 256000, medianIncome: 55000, tier: 2, region: 'Greater Dallas', county: 'Dallas',
    zips: ['75038', '75039', '75061'],
    localBlurb: 'A corporate-heavy Dallas County city home to Las Colinas and numerous headquarters campuses.',
  },
  {
    name: 'Garland', slug: 'garland', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 246000, medianIncome: 58000, tier: 3, region: 'Greater Dallas', county: 'Dallas',
    zips: ['75040', '75041', '75042'],
    localBlurb: 'A large, diverse northeast Dallas County city with a solid manufacturing and healthcare base.',
  },
  {
    name: 'Grand Prairie', slug: 'grand-prairie', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 196000, medianIncome: 62000, tier: 3, region: 'Greater Dallas', county: 'Dallas',
    zips: ['75050', '75052', '75054'],
    localBlurb: 'A mid-cities city spanning Dallas and Tarrant counties with steady residential and industrial growth.',
  },
  {
    name: 'Mesquite', slug: 'mesquite', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 150000, medianIncome: 55000, tier: 3, region: 'Greater Dallas', county: 'Dallas',
    zips: ['75149', '75150', '75181'],
    localBlurb: 'An established east Dallas County suburb with a regional medical center and growing outpatient care.',
  },
  {
    name: 'Carrollton', slug: 'carrollton', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 133000, medianIncome: 78000, tier: 2, region: 'Greater Dallas', county: 'Denton',
    zips: ['75006', '75007', '75010'],
    localBlurb: 'A well-off, diverse north Dallas suburb straddling Denton and Dallas counties.',
  },
  {
    name: 'Richardson', slug: 'richardson', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 120000, medianIncome: 82000, tier: 2, region: 'Greater Dallas', county: 'Dallas',
    zips: ['75080', '75081', '75082'],
    localBlurb: 'The "Telecom Corridor" city home to UT Dallas and a highly educated technical workforce.',
  },
  {
    name: 'Denton', slug: 'denton', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 148000, medianIncome: 55000, tier: 3, region: 'Greater Dallas', county: 'Denton',
    zips: ['76201', '76205', '76210'],
    localBlurb: 'A university city and Denton County seat home to UNT and Texas Woman’s University.',
  },
  {
    name: 'Flower Mound', slug: 'flower-mound', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 78000, medianIncome: 130000, tier: 1, region: 'Greater Dallas', county: 'Denton',
    zips: ['75022', '75028'],
    localBlurb: 'An affluent Denton County suburb consistently ranked among the best places to live in Texas.',
  },
  {
    name: 'Grapevine', slug: 'grapevine', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 50000, medianIncome: 95000, tier: 2, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76051'],
    localBlurb: 'A prosperous mid-cities city near DFW Airport with a historic Main Street and strong professional base.',
  },
  {
    name: 'Mansfield', slug: 'mansfield', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 73000, medianIncome: 95000, tier: 2, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76063'],
    localBlurb: 'A growing, affluent southeast Tarrant County suburb with expanding medical services.',
  },
  {
    name: 'Prosper', slug: 'prosper', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 30000, medianIncome: 150000, tier: 1, region: 'Greater Dallas', county: 'Collin',
    zips: ['75078'],
    localBlurb: 'One of the wealthiest and fastest-growing towns in Collin County’s northern growth corridor.',
  },
  {
    name: 'Wylie', slug: 'wylie', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 57000, medianIncome: 92000, tier: 2, region: 'Greater Dallas', county: 'Collin',
    zips: ['75098'],
    localBlurb: 'A fast-growing Collin County suburb east of Plano with a strong family demographic.',
  },
  {
    name: 'Rockwall', slug: 'rockwall', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 47000, medianIncome: 100000, tier: 2, region: 'Greater Dallas', county: 'Rockwall',
    zips: ['75032', '75087'],
    localBlurb: 'An affluent lakeside city and Rockwall County seat on the eastern edge of the Metroplex.',
  },
  {
    name: 'Missouri City', slug: 'missouri-city', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 75000, medianIncome: 90000, tier: 2, region: 'Greater Houston', county: 'Fort Bend',
    zips: ['77459', '77489'],
    localBlurb: 'A diverse, well-off Fort Bend County suburb southwest of Houston.',
  },
  {
    name: 'League City', slug: 'league-city', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 114000, medianIncome: 100000, tier: 2, region: 'Greater Houston', county: 'Galveston',
    zips: ['77573', '77574'],
    localBlurb: 'A large, affluent bay-area suburb between Houston and Galveston near the Johnson Space Center.',
  },
  {
    name: 'Friendswood', slug: 'friendswood', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 41000, medianIncome: 120000, tier: 1, region: 'Greater Houston', county: 'Galveston',
    zips: ['77546'],
    localBlurb: 'An upscale, family-oriented suburb south of Houston with a highly educated professional population.',
  },
  {
    name: 'Conroe', slug: 'conroe', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 98000, medianIncome: 60000, tier: 3, region: 'Greater Houston', county: 'Montgomery',
    zips: ['77301', '77302', '77304'],
    localBlurb: 'The Montgomery County seat and one of the fastest-growing cities in the Houston metro.',
  },
  {
    name: 'Cypress', slug: 'cypress', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 45000, medianIncome: 95000, tier: 2, region: 'Greater Houston', county: 'Harris',
    zips: ['77429', '77433'],
    localBlurb: 'A rapidly growing northwest Harris County community with expanding hospital campuses.',
  },
  {
    name: 'Spring', slug: 'spring', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 62000, medianIncome: 70000, tier: 3, region: 'Greater Houston', county: 'Harris',
    zips: ['77373', '77379', '77386'],
    localBlurb: 'A large north Houston community near the Woodlands and ExxonMobil campus with strong healthcare demand.',
  },
  {
    name: 'Georgetown', slug: 'georgetown', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 86000, medianIncome: 82000, tier: 2, region: 'Greater Austin', county: 'Williamson',
    zips: ['78626', '78628', '78633'],
    localBlurb: 'The Williamson County seat and one of the fastest-growing cities in the U.S., anchored by a growing medical center.',
  },
  {
    name: 'Pflugerville', slug: 'pflugerville', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 68000, medianIncome: 85000, tier: 2, region: 'Greater Austin', county: 'Travis',
    zips: ['78660'],
    localBlurb: 'A fast-growing, diverse Travis County suburb northeast of Austin.',
  },
  {
    name: 'San Marcos', slug: 'san-marcos', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 68000, medianIncome: 40000, tier: 3, region: 'Greater Austin', county: 'Hays',
    zips: ['78666'],
    localBlurb: 'A university city home to Texas State between Austin and San Antonio along the I-35 corridor.',
  },
  {
    name: 'New Braunfels', slug: 'new-braunfels', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 104000, medianIncome: 72000, tier: 2, region: 'Greater San Antonio', county: 'Comal',
    zips: ['78130', '78132'],
    localBlurb: 'A fast-growing Comal County city between Austin and San Antonio with a strong regional hospital.',
  },
  {
    name: 'Waco', slug: 'waco', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 140000, medianIncome: 45000, tier: 3, region: 'Central Texas', county: 'McLennan',
    zips: ['76701', '76706', '76710'],
    localBlurb: 'A Central Texas city home to Baylor University and two major hospital systems.',
  },
  {
    name: 'Tyler', slug: 'tyler', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 106000, medianIncome: 52000, tier: 3, region: 'East Texas', county: 'Smith',
    zips: ['75701', '75703'],
    localBlurb: 'The medical and commercial hub of East Texas, anchored by UT Health East Texas.',
  },
  {
    name: 'College Station', slug: 'college-station', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 120000, medianIncome: 42000, tier: 3, region: 'Central Texas', county: 'Brazos',
    zips: ['77840', '77845'],
    localBlurb: 'Home to Texas A&M University and its health-science and veterinary research programs.',
  },
  {
    name: 'Amarillo', slug: 'amarillo', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 200000, medianIncome: 55000, tier: 3, region: 'Texas Panhandle', county: 'Potter',
    zips: ['79101', '79106', '79109'],
    localBlurb: 'The economic hub of the Texas Panhandle with a major regional medical center.',
  },
  {
    name: 'Midland', slug: 'midland', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 132000, medianIncome: 80000, tier: 2, region: 'West Texas', county: 'Midland',
    zips: ['79701', '79705', '79707'],
    localBlurb: 'A high-income Permian Basin energy city with a growing hospital and healthcare footprint.',
  },

  {
    name: 'University Park', slug: 'university-park', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 25000, medianIncome: 200000, tier: 1, region: 'Greater Dallas', county: 'Dallas',
    zips: ['75205', '75225'],
    localBlurb: 'An affluent enclave surrounding SMU, one of the wealthiest and most educated communities in North Texas.',
  },
  {
    name: 'Highland Park', slug: 'highland-park', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 9000, medianIncome: 210000, tier: 1, region: 'Greater Dallas', county: 'Dallas',
    zips: ['75205'],
    localBlurb: 'A prestigious residential town north of downtown Dallas with among the highest household incomes in Texas.',
  },
  {
    name: 'Coppell', slug: 'coppell', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 42000, medianIncome: 130000, tier: 1, region: 'Greater Dallas', county: 'Dallas',
    zips: ['75019'],
    localBlurb: 'An affluent, top-schools suburb between DFW Airport and Dallas with a highly educated workforce.',
  },
  {
    name: 'Farmers Branch', slug: 'farmers-branch', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 36000, medianIncome: 65000, tier: 2, region: 'Greater Dallas', county: 'Dallas',
    zips: ['75234', '75244'],
    localBlurb: 'A close-in Dallas County city with a dense business-park economy and growing medical services.',
  },
  {
    name: 'Addison', slug: 'addison', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 16000, medianIncome: 75000, tier: 2, region: 'Greater Dallas', county: 'Dallas',
    zips: ['75001'],
    localBlurb: 'A compact business-and-dining district in north Dallas with a large daytime professional population.',
  },
  {
    name: 'DeSoto', slug: 'desoto', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 56000, medianIncome: 65000, tier: 2, region: 'Greater Dallas', county: 'Dallas',
    zips: ['75115'],
    localBlurb: 'A growing southern Dallas County suburb with expanding healthcare and retail.',
  },
  {
    name: 'Cedar Hill', slug: 'cedar-hill', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 49000, medianIncome: 72000, tier: 2, region: 'Greater Dallas', county: 'Dallas',
    zips: ['75104'],
    localBlurb: 'A hilly southwest Dallas County city near Joe Pool Lake with steady suburban growth.',
  },
  {
    name: 'Duncanville', slug: 'duncanville', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 40000, medianIncome: 58000, tier: 3, region: 'Greater Dallas', county: 'Dallas',
    zips: ['75116', '75137'],
    localBlurb: 'An established southwest Dallas County suburb with a diverse, family-oriented population.',
  },
  {
    name: 'Lancaster', slug: 'lancaster', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 41000, medianIncome: 55000, tier: 3, region: 'Greater Dallas', county: 'Dallas',
    zips: ['75134', '75146'],
    localBlurb: 'A southern Dallas County city with a growing logistics and distribution base.',
  },
  {
    name: 'Rowlett', slug: 'rowlett', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 68000, medianIncome: 95000, tier: 2, region: 'Greater Dallas', county: 'Dallas',
    zips: ['75088', '75089'],
    localBlurb: 'A lakeside suburb on Lake Ray Hubbard northeast of Dallas with a strong family demographic.',
  },
  {
    name: 'Sachse', slug: 'sachse', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 28000, medianIncome: 100000, tier: 2, region: 'Greater Dallas', county: 'Dallas',
    zips: ['75048'],
    localBlurb: 'A fast-growing suburb straddling Dallas and Collin counties with rising healthcare demand.',
  },
  {
    name: 'Balch Springs', slug: 'balch-springs', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 27000, medianIncome: 50000, tier: 3, region: 'Greater Dallas', county: 'Dallas',
    zips: ['75180'],
    localBlurb: 'A southeastern Dallas County city with steady residential growth.',
  },
  {
    name: 'Seagoville', slug: 'seagoville', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 18000, medianIncome: 55000, tier: 3, region: 'Greater Dallas', county: 'Dallas',
    zips: ['75159'],
    localBlurb: 'A southeastern Dallas County city with a small-town feel and expanding outskirts.',
  },
  {
    name: 'Celina', slug: 'celina', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 30000, medianIncome: 140000, tier: 1, region: 'Greater Dallas', county: 'Collin',
    zips: ['75009', '75078'],
    localBlurb: 'One of the fastest-growing affluent towns in the country on Collin County’s northern edge.',
  },
  {
    name: 'Melissa', slug: 'melissa', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 18000, medianIncome: 110000, tier: 1, region: 'Greater Dallas', county: 'Collin',
    zips: ['75454'],
    localBlurb: 'A rapidly growing, high-income Collin County town north of McKinney.',
  },
  {
    name: 'Anna', slug: 'anna', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 25000, medianIncome: 90000, tier: 2, region: 'Greater Dallas', county: 'Collin',
    zips: ['75409'],
    localBlurb: 'A fast-growing Collin County city along the US-75 corridor north of Melissa.',
  },
  {
    name: 'Princeton', slug: 'princeton', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 28000, medianIncome: 80000, tier: 3, region: 'Greater Dallas', county: 'Collin',
    zips: ['75407'],
    localBlurb: 'One of the fastest-growing small cities in Texas, east of McKinney in Collin County.',
  },
  {
    name: 'Fairview', slug: 'fairview', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 11000, medianIncome: 150000, tier: 1, region: 'Greater Dallas', county: 'Collin',
    zips: ['75069'],
    localBlurb: 'An affluent, low-density Collin County town known for large lots and top schools.',
  },
  {
    name: 'Murphy', slug: 'murphy', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 21000, medianIncome: 130000, tier: 1, region: 'Greater Dallas', county: 'Collin',
    zips: ['75094'],
    localBlurb: 'A prosperous, family-oriented Collin County suburb between Plano and Wylie.',
  },
  {
    name: 'Lucas', slug: 'lucas', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 9000, medianIncome: 160000, tier: 1, region: 'Greater Dallas', county: 'Collin',
    zips: ['75002'],
    localBlurb: 'A rural-flavored, high-income Collin County city with acreage estates near Lavon Lake.',
  },
  {
    name: 'Parker', slug: 'parker', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 6000, medianIncome: 175000, tier: 1, region: 'Greater Dallas', county: 'Collin',
    zips: ['75002'],
    localBlurb: 'A small, affluent Collin County city of country estates east of Plano.',
  },
  {
    name: 'Farmersville', slug: 'farmersville', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 4000, medianIncome: 60000, tier: 3, region: 'Greater Dallas', county: 'Collin',
    zips: ['75442'],
    localBlurb: 'A historic small city on Collin County’s eastern edge with a preserved downtown.',
  },
  {
    name: 'Lewisville', slug: 'lewisville', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 133000, medianIncome: 68000, tier: 2, region: 'Greater Dallas', county: 'Denton',
    zips: ['75057', '75067', '75077'],
    localBlurb: 'A large Denton County city on Lewisville Lake with a revitalized old town and major retail.',
  },
  {
    name: 'Little Elm', slug: 'little-elm', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 55000, medianIncome: 95000, tier: 2, region: 'Greater Dallas', county: 'Denton',
    zips: ['75068'],
    localBlurb: 'A fast-growing lakeside Denton County suburb on Lewisville Lake.',
  },
  {
    name: 'The Colony', slug: 'the-colony', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 45000, medianIncome: 85000, tier: 2, region: 'Greater Dallas', county: 'Denton',
    zips: ['75056'],
    localBlurb: 'A lakeside Denton County city anchored by the Grandscape entertainment district.',
  },
  {
    name: 'Highland Village', slug: 'highland-village', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 16000, medianIncome: 140000, tier: 1, region: 'Greater Dallas', county: 'Denton',
    zips: ['75077'],
    localBlurb: 'An affluent lakeside Denton County suburb with top-rated schools.',
  },
  {
    name: 'Corinth', slug: 'corinth', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 22000, medianIncome: 100000, tier: 2, region: 'Greater Dallas', county: 'Denton',
    zips: ['76208', '76210'],
    localBlurb: 'A quiet, well-off Denton County suburb south of Denton.',
  },
  {
    name: 'Sanger', slug: 'sanger', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 10000, medianIncome: 70000, tier: 3, region: 'Greater Dallas', county: 'Denton',
    zips: ['76266'],
    localBlurb: 'A growing small city on I-35 in northern Denton County.',
  },
  {
    name: 'Aubrey', slug: 'aubrey', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 6000, medianIncome: 90000, tier: 2, region: 'Greater Dallas', county: 'Denton',
    zips: ['76227'],
    localBlurb: 'A fast-growing far-north Denton County town in the US-380 corridor.',
  },
  {
    name: 'Roanoke', slug: 'roanoke', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 12000, medianIncome: 110000, tier: 1, region: 'Greater Dallas', county: 'Denton',
    zips: ['76262'],
    localBlurb: 'A dining-destination Denton County city known as the "Unique Dining Capital of Texas."',
  },
  {
    name: 'Argyle', slug: 'argyle', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 5000, medianIncome: 160000, tier: 1, region: 'Greater Dallas', county: 'Denton',
    zips: ['76226'],
    localBlurb: 'An affluent equestrian community in southern Denton County.',
  },
  {
    name: 'Justin', slug: 'justin', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 5000, medianIncome: 90000, tier: 3, region: 'Greater Dallas', county: 'Denton',
    zips: ['76247'],
    localBlurb: 'A small, growing town in northwest Denton County near Texas Motor Speedway.',
  },
  {
    name: 'Northlake', slug: 'northlake', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 6000, medianIncome: 120000, tier: 2, region: 'Greater Dallas', county: 'Denton',
    zips: ['76226', '76247'],
    localBlurb: 'A rapidly growing Denton County town along the I-35W corridor.',
  },
  {
    name: 'Trophy Club', slug: 'trophy-club', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 13000, medianIncome: 150000, tier: 1, region: 'Greater Dallas', county: 'Denton',
    zips: ['76262'],
    localBlurb: 'An affluent master-planned town built around a namesake country club.',
  },
  {
    name: 'North Richland Hills', slug: 'north-richland-hills', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 70000, medianIncome: 78000, tier: 2, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76180', '76182'],
    localBlurb: 'A mid-cities Tarrant County suburb between Fort Worth and the airport with strong services.',
  },
  {
    name: 'Bedford', slug: 'bedford', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 49000, medianIncome: 72000, tier: 2, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76021', '76022'],
    localBlurb: 'A central mid-cities suburb in the heart of the DFW area.',
  },
  {
    name: 'Euless', slug: 'euless', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 61000, medianIncome: 65000, tier: 2, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76039', '76040'],
    localBlurb: 'A diverse mid-cities city adjacent to DFW Airport.',
  },
  {
    name: 'Hurst', slug: 'hurst', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 40000, medianIncome: 68000, tier: 2, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76053', '76054'],
    localBlurb: 'A mid-cities Tarrant County suburb anchored by a major regional mall and hospital.',
  },
  {
    name: 'Haltom City', slug: 'haltom-city', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 46000, medianIncome: 55000, tier: 3, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76117', '76137'],
    localBlurb: 'A working-class Tarrant County city just northeast of Fort Worth.',
  },
  {
    name: 'Watauga', slug: 'watauga', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 24000, medianIncome: 72000, tier: 2, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76148'],
    localBlurb: 'A compact, family-oriented northeast Tarrant County suburb.',
  },
  {
    name: 'Saginaw', slug: 'saginaw', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 24000, medianIncome: 75000, tier: 2, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76179'],
    localBlurb: 'A growing northern Tarrant County suburb along the US-287 corridor.',
  },
  {
    name: 'Benbrook', slug: 'benbrook', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 24000, medianIncome: 85000, tier: 2, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76126'],
    localBlurb: 'An affluent southwest Tarrant County suburb near Benbrook Lake.',
  },
  {
    name: 'White Settlement', slug: 'white-settlement', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 18000, medianIncome: 55000, tier: 3, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76108'],
    localBlurb: 'A small city just west of Fort Worth near NAS Fort Worth JRB.',
  },
  {
    name: 'Crowley', slug: 'crowley', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 19000, medianIncome: 70000, tier: 3, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76036'],
    localBlurb: 'A growing suburb on Fort Worth’s southern edge.',
  },
  {
    name: 'Kennedale', slug: 'kennedale', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 8000, medianIncome: 80000, tier: 2, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76060'],
    localBlurb: 'A small, growing city southeast of Fort Worth.',
  },
  {
    name: 'Haslet', slug: 'haslet', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 3000, medianIncome: 130000, tier: 2, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76052'],
    localBlurb: 'A small, affluent, fast-growing town in far north Tarrant County.',
  },
  {
    name: 'Azle', slug: 'azle', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 14000, medianIncome: 70000, tier: 3, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76020'],
    localBlurb: 'A lakeside city on Eagle Mountain Lake northwest of Fort Worth.',
  },
  {
    name: 'Forest Hill', slug: 'forest-hill', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 13000, medianIncome: 50000, tier: 3, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76119', '76140'],
    localBlurb: 'A small city on the southeast edge of Fort Worth.',
  },
  {
    name: 'Richland Hills', slug: 'richland-hills', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 8000, medianIncome: 60000, tier: 3, region: 'Greater Fort Worth', county: 'Tarrant',
    zips: ['76118'],
    localBlurb: 'A compact mid-cities suburb between Fort Worth and Hurst.',
  },
  {
    name: 'Burleson', slug: 'burleson', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 51000, medianIncome: 80000, tier: 2, region: 'Greater Fort Worth', county: 'Johnson',
    zips: ['76028'],
    localBlurb: 'A fast-growing suburb spanning Johnson and Tarrant counties south of Fort Worth.',
  },
  {
    name: 'Cleburne', slug: 'cleburne', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 32000, medianIncome: 58000, tier: 3, region: 'Greater Fort Worth', county: 'Johnson',
    zips: ['76031', '76033'],
    localBlurb: 'The Johnson County seat south of Fort Worth with a historic downtown.',
  },
  {
    name: 'Joshua', slug: 'joshua', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 8000, medianIncome: 70000, tier: 3, region: 'Greater Fort Worth', county: 'Johnson',
    zips: ['76058'],
    localBlurb: 'A growing Johnson County town south of Burleson.',
  },
  {
    name: 'Weatherford', slug: 'weatherford', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 32000, medianIncome: 68000, tier: 2, region: 'Greater Fort Worth', county: 'Parker',
    zips: ['76086', '76087'],
    localBlurb: 'The Parker County seat west of Fort Worth known as the "Cutting Horse Capital."',
  },
  {
    name: 'Aledo', slug: 'aledo', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 5000, medianIncome: 130000, tier: 1, region: 'Greater Fort Worth', county: 'Parker',
    zips: ['76008'],
    localBlurb: 'An affluent, fast-growing Parker County town west of Fort Worth with acclaimed schools.',
  },
  {
    name: 'Willow Park', slug: 'willow-park', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 6000, medianIncome: 110000, tier: 2, region: 'Greater Fort Worth', county: 'Parker',
    zips: ['76087'],
    localBlurb: 'A small, well-off Parker County city along I-20 west of Fort Worth.',
  },
  {
    name: 'Waxahachie', slug: 'waxahachie', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 43000, medianIncome: 68000, tier: 2, region: 'Greater Dallas', county: 'Ellis',
    zips: ['75165', '75167'],
    localBlurb: 'The historic Ellis County seat south of Dallas with a landmark courthouse and growing industry.',
  },
  {
    name: 'Midlothian', slug: 'midlothian', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 40000, medianIncome: 95000, tier: 2, region: 'Greater Dallas', county: 'Ellis',
    zips: ['76065'],
    localBlurb: 'A fast-growing Ellis County city known for cement production and new residential growth.',
  },
  {
    name: 'Ennis', slug: 'ennis', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 22000, medianIncome: 58000, tier: 3, region: 'Greater Dallas', county: 'Ellis',
    zips: ['75119'],
    localBlurb: 'An Ellis County city known for its bluebonnet trails and motorsports park.',
  },
  {
    name: 'Red Oak', slug: 'red-oak', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 15000, medianIncome: 80000, tier: 2, region: 'Greater Dallas', county: 'Ellis',
    zips: ['75154'],
    localBlurb: 'A growing Ellis County suburb along I-35E south of Dallas.',
  },
  {
    name: 'Forney', slug: 'forney', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 27000, medianIncome: 90000, tier: 2, region: 'Greater Dallas', county: 'Kaufman',
    zips: ['75126'],
    localBlurb: 'One of the fastest-growing Kaufman County cities east of Dallas.',
  },
  {
    name: 'Terrell', slug: 'terrell', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 18000, medianIncome: 55000, tier: 3, region: 'Greater Dallas', county: 'Kaufman',
    zips: ['75160'],
    localBlurb: 'A historic Kaufman County city on US-80 with a regional medical center.',
  },
  {
    name: 'Kaufman', slug: 'kaufman', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 8000, medianIncome: 55000, tier: 3, region: 'Greater Dallas', county: 'Kaufman',
    zips: ['75142'],
    localBlurb: 'The Kaufman County seat southeast of Dallas.',
  },
  {
    name: 'Royse City', slug: 'royse-city', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 16000, medianIncome: 85000, tier: 2, region: 'Greater Dallas', county: 'Rockwall',
    zips: ['75189'],
    localBlurb: 'A fast-growing city on the eastern edge of the metroplex in Rockwall and Collin counties.',
  },
  {
    name: 'Fate', slug: 'fate', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 20000, medianIncome: 100000, tier: 2, region: 'Greater Dallas', county: 'Rockwall',
    zips: ['75087', '75189'],
    localBlurb: 'One of the fastest-growing small cities in Texas in Rockwall County.',
  },
  {
    name: 'Heath', slug: 'heath', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 9000, medianIncome: 160000, tier: 1, region: 'Greater Dallas', county: 'Rockwall',
    zips: ['75032'],
    localBlurb: 'An affluent lakeside city on Lake Ray Hubbard in Rockwall County.',
  },
  {
    name: 'Sherman', slug: 'sherman', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 46000, medianIncome: 55000, tier: 3, region: 'North Texas', county: 'Grayson',
    zips: ['75090', '75092'],
    localBlurb: 'The Grayson County seat, a growing semiconductor-manufacturing hub north of Dallas.',
  },
  {
    name: 'Denison', slug: 'denison', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 25000, medianIncome: 52000, tier: 3, region: 'North Texas', county: 'Grayson',
    zips: ['75020', '75021'],
    localBlurb: 'A historic Grayson County city on the Red River, birthplace of President Eisenhower.',
  },
  {
    name: 'Van Alstyne', slug: 'van-alstyne', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 5000, medianIncome: 90000, tier: 2, region: 'North Texas', county: 'Grayson',
    zips: ['75495'],
    localBlurb: 'A fast-growing small city in southern Grayson County along US-75.',
  },
  {
    name: 'Bonham', slug: 'bonham', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 10000, medianIncome: 50000, tier: 3, region: 'North Texas', county: 'Fannin',
    zips: ['75418'],
    localBlurb: 'The Fannin County seat in the Texoma region northeast of Dallas.',
  },
  {
    name: 'Paris', slug: 'paris', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 25000, medianIncome: 48000, tier: 3, region: 'North Texas', county: 'Lamar',
    zips: ['75460', '75462'],
    localBlurb: 'The Lamar County seat in northeast Texas, home to Paris Junior College.',
  },
  {
    name: 'Wichita Falls', slug: 'wichita-falls', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 102000, medianIncome: 50000, tier: 3, region: 'North Texas', county: 'Wichita',
    zips: ['76301', '76308', '76310'],
    localBlurb: 'A North Texas city home to Midwestern State University and Sheppard Air Force Base.',
  },
  {
    name: 'Pasadena', slug: 'pasadena', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 151000, medianIncome: 55000, tier: 2, region: 'Greater Houston', county: 'Harris',
    zips: ['77502', '77504', '77506'],
    localBlurb: 'A major industrial city southeast of Houston along the Ship Channel refining corridor.',
  },
  {
    name: 'Baytown', slug: 'baytown', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 83000, medianIncome: 58000, tier: 3, region: 'Greater Houston', county: 'Harris',
    zips: ['77520', '77521'],
    localBlurb: 'A Ship Channel city anchored by one of the nation’s largest petrochemical complexes.',
  },
  {
    name: 'Deer Park', slug: 'deer-park', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 34000, medianIncome: 85000, tier: 2, region: 'Greater Houston', county: 'Harris',
    zips: ['77536'],
    localBlurb: 'A petrochemical-industry city between Houston and the Ship Channel.',
  },
  {
    name: 'La Porte', slug: 'la-porte', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 35000, medianIncome: 70000, tier: 3, region: 'Greater Houston', county: 'Harris',
    zips: ['77571'],
    localBlurb: 'A bayfront Harris County city near the Bayport industrial complex.',
  },
  {
    name: 'Humble', slug: 'humble', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 16000, medianIncome: 60000, tier: 3, region: 'Greater Houston', county: 'Harris',
    zips: ['77338', '77396'],
    localBlurb: 'A northeast Harris County hub anchored by Deerbrook Mall and a large hospital.',
  },
  {
    name: 'Atascocita', slug: 'atascocita', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 90000, medianIncome: 90000, tier: 2, region: 'Greater Houston', county: 'Harris',
    zips: ['77346'],
    localBlurb: 'A large, affluent master-planned community on Lake Houston northeast of the city.',
  },
  {
    name: 'Tomball', slug: 'tomball', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 12000, medianIncome: 75000, tier: 2, region: 'Greater Houston', county: 'Harris',
    zips: ['77375', '77377'],
    localBlurb: 'A northwest Harris County city with a German-heritage downtown and growing medical campus.',
  },
  {
    name: 'Bellaire', slug: 'bellaire', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 17000, medianIncome: 200000, tier: 1, region: 'Greater Houston', county: 'Harris',
    zips: ['77401'],
    localBlurb: 'An affluent independent enclave surrounded by Houston, known for large homes and top schools.',
  },
  {
    name: 'West University Place', slug: 'west-university-place', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 15000, medianIncome: 250000, tier: 1, region: 'Greater Houston', county: 'Harris',
    zips: ['77005'],
    localBlurb: 'A wealthy enclave near Rice University and the Texas Medical Center, among Houston’s most educated.',
  },
  {
    name: 'Jersey Village', slug: 'jersey-village', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 8000, medianIncome: 90000, tier: 2, region: 'Greater Houston', county: 'Harris',
    zips: ['77040', '77064'],
    localBlurb: 'A small independent city in northwest Harris County along US-290.',
  },
  {
    name: 'Webster', slug: 'webster', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 12000, medianIncome: 60000, tier: 2, region: 'Greater Houston', county: 'Harris',
    zips: ['77598'],
    localBlurb: 'A Bay Area Houston city near the Johnson Space Center and a large medical corridor.',
  },
  {
    name: 'Seabrook', slug: 'seabrook', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 14000, medianIncome: 85000, tier: 2, region: 'Greater Houston', county: 'Harris',
    zips: ['77586'],
    localBlurb: 'A waterfront Clear Lake city near NASA with a maritime and tourism economy.',
  },
  {
    name: 'Nassau Bay', slug: 'nassau-bay', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 4000, medianIncome: 100000, tier: 1, region: 'Greater Houston', county: 'Harris',
    zips: ['77058'],
    localBlurb: 'An affluent waterfront city directly across from the Johnson Space Center.',
  },
  {
    name: 'Galena Park', slug: 'galena-park', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 10000, medianIncome: 48000, tier: 3, region: 'Greater Houston', county: 'Harris',
    zips: ['77547'],
    localBlurb: 'A small Ship Channel industrial city east of Houston.',
  },
  {
    name: 'Channelview', slug: 'channelview', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 43000, medianIncome: 58000, tier: 3, region: 'Greater Houston', county: 'Harris',
    zips: ['77530'],
    localBlurb: 'An east Harris County community along the San Jacinto River and Ship Channel.',
  },
  {
    name: 'Rosenberg', slug: 'rosenberg', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 40000, medianIncome: 65000, tier: 3, region: 'Greater Houston', county: 'Fort Bend',
    zips: ['77471'],
    localBlurb: 'A growing Fort Bend County city southwest of Houston along US-59.',
  },
  {
    name: 'Richmond', slug: 'richmond', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 12000, medianIncome: 70000, tier: 2, region: 'Greater Houston', county: 'Fort Bend',
    zips: ['77406', '77469'],
    localBlurb: 'The historic Fort Bend County seat on the Brazos River.',
  },
  {
    name: 'Stafford', slug: 'stafford', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 18000, medianIncome: 62000, tier: 2, region: 'Greater Houston', county: 'Fort Bend',
    zips: ['77477'],
    localBlurb: 'A small business-friendly city southwest of Houston with no city property tax.',
  },
  {
    name: 'Fulshear', slug: 'fulshear', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 42000, medianIncome: 160000, tier: 1, region: 'Greater Houston', county: 'Fort Bend',
    zips: ['77441'],
    localBlurb: 'One of the fastest-growing affluent cities in Texas in western Fort Bend County.',
  },
  {
    name: 'Sienna', slug: 'sienna', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 30000, medianIncome: 130000, tier: 1, region: 'Greater Houston', county: 'Fort Bend',
    zips: ['77459'],
    localBlurb: 'A large affluent master-planned community in Fort Bend County south of Houston.',
  },
  {
    name: 'Magnolia', slug: 'magnolia', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 3000, medianIncome: 75000, tier: 2, region: 'Greater Houston', county: 'Montgomery',
    zips: ['77354', '77355'],
    localBlurb: 'A fast-growing gateway city in western Montgomery County northwest of Houston.',
  },
  {
    name: 'Willis', slug: 'willis', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 8000, medianIncome: 55000, tier: 3, region: 'Greater Houston', county: 'Montgomery',
    zips: ['77378'],
    localBlurb: 'A growing Montgomery County city near Lake Conroe.',
  },
  {
    name: 'Montgomery', slug: 'montgomery', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 2000, medianIncome: 90000, tier: 2, region: 'Greater Houston', county: 'Montgomery',
    zips: ['77356'],
    localBlurb: 'The small historic namesake city of Montgomery County near Lake Conroe.',
  },
  {
    name: 'Shenandoah', slug: 'shenandoah', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 3000, medianIncome: 90000, tier: 2, region: 'Greater Houston', county: 'Montgomery',
    zips: ['77384'],
    localBlurb: 'A small commercial city adjacent to The Woodlands with a strong medical corridor.',
  },
  {
    name: 'Oak Ridge North', slug: 'oak-ridge-north', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 3000, medianIncome: 95000, tier: 2, region: 'Greater Houston', county: 'Montgomery',
    zips: ['77385'],
    localBlurb: 'A small affluent city bordering The Woodlands.',
  },
  {
    name: 'New Caney', slug: 'new-caney', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 5000, medianIncome: 60000, tier: 3, region: 'Greater Houston', county: 'Montgomery',
    zips: ['77357'],
    localBlurb: 'A fast-growing east Montgomery County community near the Grand Parkway.',
  },
  {
    name: 'Porter', slug: 'porter', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 30000, medianIncome: 70000, tier: 3, region: 'Greater Houston', county: 'Montgomery',
    zips: ['77365'],
    localBlurb: 'A growing community in southeast Montgomery County near Kingwood.',
  },
  {
    name: 'Alvin', slug: 'alvin', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 27000, medianIncome: 65000, tier: 3, region: 'Greater Houston', county: 'Brazoria',
    zips: ['77511'],
    localBlurb: 'A Brazoria County city south of Houston, hometown of Nolan Ryan.',
  },
  {
    name: 'Lake Jackson', slug: 'lake-jackson', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 28000, medianIncome: 80000, tier: 2, region: 'Greater Houston', county: 'Brazoria',
    zips: ['77566'],
    localBlurb: 'A planned Brazoria County city built by Dow Chemical with a strong engineering workforce.',
  },
  {
    name: 'Angleton', slug: 'angleton', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 19000, medianIncome: 62000, tier: 3, region: 'Greater Houston', county: 'Brazoria',
    zips: ['77515'],
    localBlurb: 'The Brazoria County seat south of Houston.',
  },
  {
    name: 'Manvel', slug: 'manvel', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 21000, medianIncome: 100000, tier: 2, region: 'Greater Houston', county: 'Brazoria',
    zips: ['77578'],
    localBlurb: 'A fast-growing Brazoria County city south of Pearland.',
  },
  {
    name: 'Clute', slug: 'clute', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 11000, medianIncome: 55000, tier: 3, region: 'Greater Houston', county: 'Brazoria',
    zips: ['77531'],
    localBlurb: 'A Brazoria County city in the Freeport industrial area.',
  },
  {
    name: 'Galveston', slug: 'galveston', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 53000, medianIncome: 55000, tier: 2, region: 'Gulf Coast', county: 'Galveston',
    zips: ['77550', '77551', '77554'],
    localBlurb: 'A historic Gulf island city home to the University of Texas Medical Branch, a major academic-research campus.',
  },
  {
    name: 'Texas City', slug: 'texas-city', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 51000, medianIncome: 58000, tier: 3, region: 'Gulf Coast', county: 'Galveston',
    zips: ['77590', '77591'],
    localBlurb: 'A Galveston Bay refining city with a large petrochemical complex.',
  },
  {
    name: 'Dickinson', slug: 'dickinson', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 21000, medianIncome: 70000, tier: 2, region: 'Greater Houston', county: 'Galveston',
    zips: ['77539'],
    localBlurb: 'A bayou city between Houston and Galveston with steady growth.',
  },
  {
    name: 'La Marque', slug: 'la-marque', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 18000, medianIncome: 52000, tier: 3, region: 'Greater Houston', county: 'Galveston',
    zips: ['77568'],
    localBlurb: 'A small Galveston County city along I-45 near Texas City.',
  },
  {
    name: 'Hempstead', slug: 'hempstead', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 8000, medianIncome: 50000, tier: 3, region: 'Greater Houston', county: 'Waller',
    zips: ['77445'],
    localBlurb: 'The Waller County seat northwest of Houston, the "Watermelon Capital."',
  },
  {
    name: 'Mont Belvieu', slug: 'mont-belvieu', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 8000, medianIncome: 100000, tier: 2, region: 'Greater Houston', county: 'Chambers',
    zips: ['77523', '77580'],
    localBlurb: 'A Chambers County city atop massive underground petrochemical storage domes.',
  },
  {
    name: 'Dayton', slug: 'dayton', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 8000, medianIncome: 60000, tier: 3, region: 'Greater Houston', county: 'Liberty',
    zips: ['77535'],
    localBlurb: 'A growing Liberty County city east of Houston along US-90.',
  },
  {
    name: 'Liberty', slug: 'liberty', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 9000, medianIncome: 55000, tier: 3, region: 'Southeast Texas', county: 'Liberty',
    zips: ['77575'],
    localBlurb: 'The historic Liberty County seat on the Trinity River.',
  },
  {
    name: 'Beaumont', slug: 'beaumont', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 114000, medianIncome: 48000, tier: 3, region: 'Southeast Texas', county: 'Jefferson',
    zips: ['77701', '77706', '77713'],
    localBlurb: 'A major Southeast Texas city and refining hub home to Lamar University and Baptist Hospitals.',
  },
  {
    name: 'Port Arthur', slug: 'port-arthur', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 55000, medianIncome: 45000, tier: 3, region: 'Southeast Texas', county: 'Jefferson',
    zips: ['77640', '77642'],
    localBlurb: 'A Gulf-coast refining city with one of the largest oil-refining complexes in the nation.',
  },
  {
    name: 'Nederland', slug: 'nederland', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 17000, medianIncome: 70000, tier: 2, region: 'Southeast Texas', county: 'Jefferson',
    zips: ['77627'],
    localBlurb: 'A Mid-County Jefferson city with Dutch heritage between Beaumont and Port Arthur.',
  },
  {
    name: 'Port Neches', slug: 'port-neches', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 13000, medianIncome: 72000, tier: 2, region: 'Southeast Texas', county: 'Jefferson',
    zips: ['77651'],
    localBlurb: 'A riverfront Mid-County city on the Neches River.',
  },
  {
    name: 'Groves', slug: 'groves', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 16000, medianIncome: 60000, tier: 3, region: 'Southeast Texas', county: 'Jefferson',
    zips: ['77619'],
    localBlurb: 'A small Mid-County Jefferson city in the Golden Triangle.',
  },
  {
    name: 'Orange', slug: 'orange', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 18000, medianIncome: 50000, tier: 3, region: 'Southeast Texas', county: 'Orange',
    zips: ['77630', '77632'],
    localBlurb: 'The Orange County seat on the Sabine River at the Louisiana border.',
  },
  {
    name: 'Vidor', slug: 'vidor', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 10000, medianIncome: 58000, tier: 3, region: 'Southeast Texas', county: 'Orange',
    zips: ['77662'],
    localBlurb: 'An Orange County city just east of Beaumont.',
  },
  {
    name: 'Lumberton', slug: 'lumberton', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 13000, medianIncome: 80000, tier: 2, region: 'Southeast Texas', county: 'Hardin',
    zips: ['77657'],
    localBlurb: 'A growing Hardin County suburb north of Beaumont.',
  },
  {
    name: 'Silsbee', slug: 'silsbee', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 7000, medianIncome: 55000, tier: 3, region: 'Southeast Texas', county: 'Hardin',
    zips: ['77656'],
    localBlurb: 'A Hardin County city in the Big Thicket region.',
  },
  {
    name: 'Jasper', slug: 'jasper', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 7000, medianIncome: 45000, tier: 3, region: 'East Texas', county: 'Jasper',
    zips: ['75951'],
    localBlurb: 'The "Jewel of the Forest" and Jasper County seat in the East Texas piney woods.',
  },
  {
    name: 'Kyle', slug: 'kyle', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 60000, medianIncome: 80000, tier: 2, region: 'Greater Austin', county: 'Hays',
    zips: ['78640'],
    localBlurb: 'One of the fastest-growing cities in Texas in Hays County south of Austin.',
  },
  {
    name: 'Buda', slug: 'buda', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 20000, medianIncome: 90000, tier: 2, region: 'Greater Austin', county: 'Hays',
    zips: ['78610'],
    localBlurb: 'A fast-growing Hays County city just south of Austin.',
  },
  {
    name: 'Dripping Springs', slug: 'dripping-springs', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 6000, medianIncome: 110000, tier: 1, region: 'Greater Austin', county: 'Hays',
    zips: ['78620'],
    localBlurb: 'An affluent Hill Country "Gateway" city west of Austin known for wineries and distilleries.',
  },
  {
    name: 'Wimberley', slug: 'wimberley', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 3000, medianIncome: 85000, tier: 2, region: 'Greater Austin', county: 'Hays',
    zips: ['78676'],
    localBlurb: 'A scenic Hill Country arts town on the Blanco River in Hays County.',
  },
  {
    name: 'Hutto', slug: 'hutto', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 35000, medianIncome: 90000, tier: 2, region: 'Greater Austin', county: 'Williamson',
    zips: ['78634'],
    localBlurb: 'A fast-growing Williamson County city east of Round Rock.',
  },
  {
    name: 'Taylor', slug: 'taylor', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 17000, medianIncome: 60000, tier: 2, region: 'Greater Austin', county: 'Williamson',
    zips: ['76574'],
    localBlurb: 'A Williamson County city transformed by Samsung’s massive semiconductor plant.',
  },
  {
    name: 'Liberty Hill', slug: 'liberty-hill', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 7000, medianIncome: 100000, tier: 2, region: 'Greater Austin', county: 'Williamson',
    zips: ['78642'],
    localBlurb: 'A rapidly growing Hill Country town northwest of Austin.',
  },
  {
    name: 'Lakeway', slug: 'lakeway', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 20000, medianIncome: 130000, tier: 1, region: 'Greater Austin', county: 'Travis',
    zips: ['78734', '78738'],
    localBlurb: 'An affluent Lake Travis resort city west of Austin.',
  },
  {
    name: 'Bee Cave', slug: 'bee-cave', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 8000, medianIncome: 160000, tier: 1, region: 'Greater Austin', county: 'Travis',
    zips: ['78738'],
    localBlurb: 'An upscale Hill Country city west of Austin anchored by the Hill Country Galleria.',
  },
  {
    name: 'West Lake Hills', slug: 'west-lake-hills', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 3000, medianIncome: 250000, tier: 1, region: 'Greater Austin', county: 'Travis',
    zips: ['78746'],
    localBlurb: 'One of the wealthiest communities in Central Texas in the hills west of downtown Austin.',
  },
  {
    name: 'Lago Vista', slug: 'lago-vista', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 9000, medianIncome: 90000, tier: 2, region: 'Greater Austin', county: 'Travis',
    zips: ['78645'],
    localBlurb: 'A Lake Travis waterfront community northwest of Austin.',
  },
  {
    name: 'Manor', slug: 'manor', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 16000, medianIncome: 75000, tier: 3, region: 'Greater Austin', county: 'Travis',
    zips: ['78653'],
    localBlurb: 'A fast-growing city east of Austin in Travis County.',
  },
  {
    name: 'Bastrop', slug: 'bastrop', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 12000, medianIncome: 65000, tier: 2, region: 'Greater Austin', county: 'Bastrop',
    zips: ['78602'],
    localBlurb: 'A historic Colorado River city southeast of Austin near a growing film-and-tech corridor.',
  },
  {
    name: 'Elgin', slug: 'elgin', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 10000, medianIncome: 62000, tier: 3, region: 'Greater Austin', county: 'Bastrop',
    zips: ['78621'],
    localBlurb: 'A Bastrop County city known as the "Sausage Capital of Texas."',
  },
  {
    name: 'Lockhart', slug: 'lockhart', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 14000, medianIncome: 58000, tier: 3, region: 'Greater Austin', county: 'Caldwell',
    zips: ['78644'],
    localBlurb: 'The Caldwell County seat and self-proclaimed "Barbecue Capital of Texas."',
  },
  {
    name: 'Schertz', slug: 'schertz', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 42000, medianIncome: 85000, tier: 2, region: 'Greater San Antonio', county: 'Guadalupe',
    zips: ['78154'],
    localBlurb: 'A fast-growing city northeast of San Antonio spanning three counties.',
  },
  {
    name: 'Cibolo', slug: 'cibolo', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 32000, medianIncome: 100000, tier: 2, region: 'Greater San Antonio', county: 'Guadalupe',
    zips: ['78108'],
    localBlurb: 'An affluent, fast-growing Guadalupe County suburb northeast of San Antonio.',
  },
  {
    name: 'Seguin', slug: 'seguin', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 32000, medianIncome: 55000, tier: 3, region: 'Greater San Antonio', county: 'Guadalupe',
    zips: ['78155'],
    localBlurb: 'The Guadalupe County seat on the Guadalupe River, home to Texas Lutheran University.',
  },
  {
    name: 'Universal City', slug: 'universal-city', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 21000, medianIncome: 68000, tier: 2, region: 'Greater San Antonio', county: 'Bexar',
    zips: ['78148'],
    localBlurb: 'A city adjacent to Randolph Air Force Base northeast of San Antonio.',
  },
  {
    name: 'Live Oak', slug: 'live-oak', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 16000, medianIncome: 70000, tier: 2, region: 'Greater San Antonio', county: 'Bexar',
    zips: ['78233'],
    localBlurb: 'A commercial suburb along I-35 in northeast Bexar County.',
  },
  {
    name: 'Converse', slug: 'converse', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 28000, medianIncome: 72000, tier: 2, region: 'Greater San Antonio', county: 'Bexar',
    zips: ['78109'],
    localBlurb: 'A fast-growing suburb east of San Antonio near Randolph AFB.',
  },
  {
    name: 'Helotes', slug: 'helotes', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 10000, medianIncome: 100000, tier: 2, region: 'Greater San Antonio', county: 'Bexar',
    zips: ['78023'],
    localBlurb: 'A Hill Country gateway city on the northwest edge of San Antonio.',
  },
  {
    name: 'Alamo Heights', slug: 'alamo-heights', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 8000, medianIncome: 130000, tier: 1, region: 'Greater San Antonio', county: 'Bexar',
    zips: ['78209'],
    localBlurb: 'A wealthy independent enclave surrounded by San Antonio with historic homes.',
  },
  {
    name: 'Fair Oaks Ranch', slug: 'fair-oaks-ranch', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 11000, medianIncome: 140000, tier: 1, region: 'Greater San Antonio', county: 'Bexar',
    zips: ['78015'],
    localBlurb: 'An affluent Hill Country community northwest of San Antonio.',
  },
  {
    name: 'Leon Valley', slug: 'leon-valley', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 12000, medianIncome: 60000, tier: 3, region: 'Greater San Antonio', county: 'Bexar',
    zips: ['78238'],
    localBlurb: 'A small independent city surrounded by northwest San Antonio.',
  },
  {
    name: 'Selma', slug: 'selma', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 11000, medianIncome: 80000, tier: 2, region: 'Greater San Antonio', county: 'Bexar',
    zips: ['78154'],
    localBlurb: 'A retail-heavy suburb at the junction of three counties northeast of San Antonio.',
  },
  {
    name: 'Boerne', slug: 'boerne', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 20000, medianIncome: 90000, tier: 2, region: 'Texas Hill Country', county: 'Kendall',
    zips: ['78006', '78015'],
    localBlurb: 'An affluent, fast-growing Hill Country city and Kendall County seat northwest of San Antonio.',
  },
  {
    name: 'Bulverde', slug: 'bulverde', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 6000, medianIncome: 110000, tier: 1, region: 'Texas Hill Country', county: 'Comal',
    zips: ['78163'],
    localBlurb: 'An affluent Hill Country city in Comal County north of San Antonio.',
  },
  {
    name: 'Canyon Lake', slug: 'canyon-lake', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 34000, medianIncome: 80000, tier: 2, region: 'Texas Hill Country', county: 'Comal',
    zips: ['78133'],
    localBlurb: 'A Hill Country lake community in Comal County popular for recreation.',
  },
  {
    name: 'Floresville', slug: 'floresville', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 8000, medianIncome: 55000, tier: 3, region: 'South Texas', county: 'Wilson',
    zips: ['78114'],
    localBlurb: 'The Wilson County seat southeast of San Antonio, the "Peanut Capital of Texas."',
  },
  {
    name: 'Castroville', slug: 'castroville', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 3000, medianIncome: 80000, tier: 2, region: 'Texas Hill Country', county: 'Medina',
    zips: ['78009'],
    localBlurb: 'A historic Alsatian-heritage town west of San Antonio on the Medina River.',
  },
  {
    name: 'Hondo', slug: 'hondo', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 9000, medianIncome: 55000, tier: 3, region: 'South Texas', county: 'Medina',
    zips: ['78861'],
    localBlurb: 'The Medina County seat west of San Antonio.',
  },
  {
    name: 'Fredericksburg', slug: 'fredericksburg', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 11000, medianIncome: 65000, tier: 2, region: 'Texas Hill Country', county: 'Gillespie',
    zips: ['78624'],
    localBlurb: 'A German-heritage Hill Country city and wine-country destination in Gillespie County.',
  },
  {
    name: 'Kerrville', slug: 'kerrville', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 24000, medianIncome: 58000, tier: 2, region: 'Texas Hill Country', county: 'Kerr',
    zips: ['78028'],
    localBlurb: 'The Kerr County seat on the Guadalupe River, a Hill Country retirement and medical hub.',
  },
  {
    name: 'Marble Falls', slug: 'marble-falls', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 7000, medianIncome: 65000, tier: 2, region: 'Texas Hill Country', county: 'Burnet',
    zips: ['78654'],
    localBlurb: 'A Highland Lakes city on the Colorado River in Burnet County.',
  },
  {
    name: 'Burnet', slug: 'burnet', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 6000, medianIncome: 60000, tier: 3, region: 'Texas Hill Country', county: 'Burnet',
    zips: ['78611'],
    localBlurb: 'The Burnet County seat and "Bluebonnet Capital of Texas" in the Highland Lakes.',
  },
  {
    name: 'Killeen', slug: 'killeen', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 158000, medianIncome: 52000, tier: 3, region: 'Central Texas', county: 'Bell',
    zips: ['76541', '76542', '76549'],
    localBlurb: 'A large city adjacent to Fort Cavazos (Fort Hood), one of the biggest U.S. military installations.',
  },
  {
    name: 'Temple', slug: 'temple', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 82000, medianIncome: 55000, tier: 2, region: 'Central Texas', county: 'Bell',
    zips: ['76502', '76504'],
    localBlurb: 'A Central Texas medical hub home to the flagship Baylor Scott & White Medical Center.',
  },
  {
    name: 'Belton', slug: 'belton', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 25000, medianIncome: 58000, tier: 3, region: 'Central Texas', county: 'Bell',
    zips: ['76513'],
    localBlurb: 'The Bell County seat, home to the University of Mary Hardin-Baylor.',
  },
  {
    name: 'Harker Heights', slug: 'harker-heights', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 33000, medianIncome: 68000, tier: 2, region: 'Central Texas', county: 'Bell',
    zips: ['76548'],
    localBlurb: 'A growing Bell County suburb next to Fort Cavazos.',
  },
  {
    name: 'Copperas Cove', slug: 'copperas-cove', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 37000, medianIncome: 55000, tier: 3, region: 'Central Texas', county: 'Coryell',
    zips: ['76522'],
    localBlurb: 'A Coryell County city on the western edge of Fort Cavazos.',
  },
  {
    name: 'Salado', slug: 'salado', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 3000, medianIncome: 90000, tier: 2, region: 'Central Texas', county: 'Bell',
    zips: ['76571'],
    localBlurb: 'An affluent Hill Country village between Austin and Waco known for its arts scene.',
  },
  {
    name: 'Bryan', slug: 'bryan', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 87000, medianIncome: 50000, tier: 3, region: 'Central Texas', county: 'Brazos',
    zips: ['77801', '77802', '77803'],
    localBlurb: 'The Brazos County seat adjoining College Station in the Texas A&M research region.',
  },
  {
    name: 'Hewitt', slug: 'hewitt', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 15000, medianIncome: 75000, tier: 2, region: 'Central Texas', county: 'McLennan',
    zips: ['76643'],
    localBlurb: 'A well-off suburb just south of Waco.',
  },
  {
    name: 'Woodway', slug: 'woodway', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 9000, medianIncome: 90000, tier: 2, region: 'Central Texas', county: 'McLennan',
    zips: ['76712'],
    localBlurb: 'An affluent McLennan County suburb west of Waco.',
  },
  {
    name: 'Robinson', slug: 'robinson', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 12000, medianIncome: 70000, tier: 3, region: 'Central Texas', county: 'McLennan',
    zips: ['76706'],
    localBlurb: 'A residential suburb south of Waco.',
  },
  {
    name: 'Gatesville', slug: 'gatesville', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 16000, medianIncome: 50000, tier: 3, region: 'Central Texas', county: 'Coryell',
    zips: ['76528'],
    localBlurb: 'The Coryell County seat west of Waco.',
  },
  {
    name: 'Brenham', slug: 'brenham', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 18000, medianIncome: 55000, tier: 2, region: 'Central Texas', county: 'Washington',
    zips: ['77833'],
    localBlurb: 'The Washington County seat, home of Blue Bell Creameries between Houston and Austin.',
  },
  {
    name: 'Longview', slug: 'longview', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 82000, medianIncome: 55000, tier: 3, region: 'East Texas', county: 'Gregg',
    zips: ['75601', '75604', '75605'],
    localBlurb: 'A regional East Texas hub anchored by Christus Good Shepherd and a strong energy economy.',
  },
  {
    name: 'Marshall', slug: 'marshall', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 23000, medianIncome: 45000, tier: 3, region: 'East Texas', county: 'Harrison',
    zips: ['75670', '75672'],
    localBlurb: 'The Harrison County seat, a historic East Texas city home to Wiley and East Texas Baptist universities.',
  },
  {
    name: 'Kilgore', slug: 'kilgore', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 15000, medianIncome: 55000, tier: 3, region: 'East Texas', county: 'Gregg',
    zips: ['75662'],
    localBlurb: 'An East Texas oil city home to Kilgore College and the famous Rangerettes.',
  },
  {
    name: 'Lufkin', slug: 'lufkin', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 34000, medianIncome: 48000, tier: 3, region: 'East Texas', county: 'Angelina',
    zips: ['75901', '75904'],
    localBlurb: 'The Angelina County seat and medical hub of deep East Texas.',
  },
  {
    name: 'Nacogdoches', slug: 'nacogdoches', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 32000, medianIncome: 40000, tier: 3, region: 'East Texas', county: 'Nacogdoches',
    zips: ['75961', '75965'],
    localBlurb: 'The oldest town in Texas, home to Stephen F. Austin State University.',
  },
  {
    name: 'Henderson', slug: 'henderson', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 14000, medianIncome: 50000, tier: 3, region: 'East Texas', county: 'Rusk',
    zips: ['75652', '75654'],
    localBlurb: 'The Rusk County seat in the East Texas oil-and-gas region.',
  },
  {
    name: 'Palestine', slug: 'palestine', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 18000, medianIncome: 48000, tier: 3, region: 'East Texas', county: 'Anderson',
    zips: ['75801', '75803'],
    localBlurb: 'The Anderson County seat known for its dogwood trails and historic railroad.',
  },
  {
    name: 'Athens', slug: 'athens', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 13000, medianIncome: 50000, tier: 3, region: 'East Texas', county: 'Henderson',
    zips: ['75751'],
    localBlurb: 'The Henderson County seat, home to the Texas Freshwater Fisheries Center.',
  },
  {
    name: 'Whitehouse', slug: 'whitehouse', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 9000, medianIncome: 80000, tier: 2, region: 'East Texas', county: 'Smith',
    zips: ['75791'],
    localBlurb: 'An affluent suburb just south of Tyler.',
  },
  {
    name: 'Lindale', slug: 'lindale', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 6000, medianIncome: 70000, tier: 2, region: 'East Texas', county: 'Smith',
    zips: ['75771'],
    localBlurb: 'A fast-growing Smith County city north of Tyler.',
  },
  {
    name: 'Mineola', slug: 'mineola', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 5000, medianIncome: 55000, tier: 3, region: 'East Texas', county: 'Wood',
    zips: ['75773'],
    localBlurb: 'A historic railroad town in Wood County.',
  },
  {
    name: 'Sulphur Springs', slug: 'sulphur-springs', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 16000, medianIncome: 52000, tier: 3, region: 'East Texas', county: 'Hopkins',
    zips: ['75482'],
    localBlurb: 'The Hopkins County seat known for its dairy industry and modern downtown.',
  },
  {
    name: 'Mount Pleasant', slug: 'mount-pleasant', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 16000, medianIncome: 50000, tier: 3, region: 'East Texas', county: 'Titus',
    zips: ['75455'],
    localBlurb: 'The Titus County seat in northeast Texas.',
  },
  {
    name: 'Texarkana', slug: 'texarkana', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 36000, medianIncome: 45000, tier: 3, region: 'East Texas', county: 'Bowie',
    zips: ['75501', '75503'],
    localBlurb: 'A twin-city on the Texas–Arkansas border and regional medical center.',
  },
  {
    name: 'Laredo', slug: 'laredo', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 256000, medianIncome: 48000, tier: 3, region: 'South Texas', county: 'Webb',
    zips: ['78040', '78041', '78045'],
    localBlurb: 'A major border city on the Rio Grande and the busiest inland port in the United States.',
  },
  {
    name: 'McAllen', slug: 'mcallen', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 143000, medianIncome: 50000, tier: 3, region: 'Rio Grande Valley', county: 'Hidalgo',
    zips: ['78501', '78503', '78504'],
    localBlurb: 'The commercial and medical hub of the Rio Grande Valley in Hidalgo County.',
  },
  {
    name: 'Edinburg', slug: 'edinburg', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 101000, medianIncome: 50000, tier: 3, region: 'Rio Grande Valley', county: 'Hidalgo',
    zips: ['78539', '78541', '78542'],
    localBlurb: 'The Hidalgo County seat, home to UT Rio Grande Valley and its School of Medicine.',
  },
  {
    name: 'Mission', slug: 'mission', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 85000, medianIncome: 48000, tier: 3, region: 'Rio Grande Valley', county: 'Hidalgo',
    zips: ['78572', '78573'],
    localBlurb: 'A Rio Grande Valley city known for citrus and the "Grapefruit Capital of Texas."',
  },
  {
    name: 'Pharr', slug: 'pharr', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 79000, medianIncome: 45000, tier: 3, region: 'Rio Grande Valley', county: 'Hidalgo',
    zips: ['78577'],
    localBlurb: 'A Rio Grande Valley city with a major international bridge and produce port.',
  },
  {
    name: 'Weslaco', slug: 'weslaco', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 41000, medianIncome: 45000, tier: 3, region: 'Rio Grande Valley', county: 'Hidalgo',
    zips: ['78596'],
    localBlurb: 'A Mid-Valley city home to a growing medical district.',
  },
  {
    name: 'Harlingen', slug: 'harlingen', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 71000, medianIncome: 48000, tier: 3, region: 'Rio Grande Valley', county: 'Cameron',
    zips: ['78550', '78552'],
    localBlurb: 'A Rio Grande Valley medical hub anchored by a large VA medical center.',
  },
  {
    name: 'Brownsville', slug: 'brownsville', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 187000, medianIncome: 42000, tier: 3, region: 'Rio Grande Valley', county: 'Cameron',
    zips: ['78520', '78521', '78526'],
    localBlurb: 'The southernmost city in Texas, home to UTRGV and the SpaceX Starbase region.',
  },
  {
    name: 'San Benito', slug: 'san-benito', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 24000, medianIncome: 40000, tier: 3, region: 'Rio Grande Valley', county: 'Cameron',
    zips: ['78586'],
    localBlurb: 'A Cameron County city between Harlingen and Brownsville.',
  },
  {
    name: 'Mercedes', slug: 'mercedes', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 16000, medianIncome: 40000, tier: 3, region: 'Rio Grande Valley', county: 'Hidalgo',
    zips: ['78570'],
    localBlurb: 'A Mid-Valley city known for its outlet shopping and livestock show.',
  },
  {
    name: 'San Juan', slug: 'san-juan', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 36000, medianIncome: 42000, tier: 3, region: 'Rio Grande Valley', county: 'Hidalgo',
    zips: ['78589'],
    localBlurb: 'A Hidalgo County city home to the Basilica of Our Lady of San Juan del Valle.',
  },
  {
    name: 'Rio Grande City', slug: 'rio-grande-city', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 14000, medianIncome: 40000, tier: 3, region: 'Rio Grande Valley', county: 'Starr',
    zips: ['78582'],
    localBlurb: 'The Starr County seat on the upper Rio Grande.',
  },
  {
    name: 'Victoria', slug: 'victoria', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 65000, medianIncome: 55000, tier: 3, region: 'Gulf Coast', county: 'Victoria',
    zips: ['77901', '77904'],
    localBlurb: 'The "Crossroads" city of the Coastal Bend anchored by DeTar and Citizens medical centers.',
  },
  {
    name: 'Kingsville', slug: 'kingsville', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 25000, medianIncome: 45000, tier: 3, region: 'South Texas', county: 'Kleberg',
    zips: ['78363'],
    localBlurb: 'Home to Texas A&M University-Kingsville and the historic King Ranch.',
  },
  {
    name: 'Alice', slug: 'alice', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 18000, medianIncome: 45000, tier: 3, region: 'South Texas', county: 'Jim Wells',
    zips: ['78332'],
    localBlurb: 'The Jim Wells County seat in the South Texas brush country.',
  },
  {
    name: 'Beeville', slug: 'beeville', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 12000, medianIncome: 42000, tier: 3, region: 'South Texas', county: 'Bee',
    zips: ['78102'],
    localBlurb: 'The Bee County seat in the Coastal Bend region.',
  },
  {
    name: 'Portland', slug: 'portland', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 20000, medianIncome: 75000, tier: 2, region: 'Gulf Coast', county: 'San Patricio',
    zips: ['78374'],
    localBlurb: 'A bayfront city on Nueces Bay across from Corpus Christi.',
  },
  {
    name: 'Robstown', slug: 'robstown', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 11000, medianIncome: 40000, tier: 3, region: 'Gulf Coast', county: 'Nueces',
    zips: ['78380'],
    localBlurb: 'A Nueces County city west of Corpus Christi near a large steel mill.',
  },
  {
    name: 'Rockport', slug: 'rockport', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 10000, medianIncome: 55000, tier: 2, region: 'Gulf Coast', county: 'Aransas',
    zips: ['78382'],
    localBlurb: 'A coastal arts-and-fishing town on Aransas Bay.',
  },
  {
    name: 'Del Rio', slug: 'del-rio', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 34000, medianIncome: 45000, tier: 3, region: 'South Texas', county: 'Val Verde',
    zips: ['78840'],
    localBlurb: 'A border city on the Rio Grande and Val Verde County seat near Laughlin AFB.',
  },
  {
    name: 'Eagle Pass', slug: 'eagle-pass', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 28000, medianIncome: 42000, tier: 3, region: 'South Texas', county: 'Maverick',
    zips: ['78852'],
    localBlurb: 'A Rio Grande border city and Maverick County seat.',
  },
  {
    name: 'Uvalde', slug: 'uvalde', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 15000, medianIncome: 45000, tier: 3, region: 'South Texas', county: 'Uvalde',
    zips: ['78801'],
    localBlurb: 'The Uvalde County seat in the South Texas Hill Country at the junction of US-90 and US-83.',
  },
  {
    name: 'Odessa', slug: 'odessa', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 114000, medianIncome: 62000, tier: 3, region: 'West Texas', county: 'Ector',
    zips: ['79761', '79762', '79765'],
    localBlurb: 'A Permian Basin oil city and home to the University of Texas Permian Basin.',
  },
  {
    name: 'San Angelo', slug: 'san-angelo', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 100000, medianIncome: 52000, tier: 3, region: 'West Texas', county: 'Tom Green',
    zips: ['76901', '76903', '76904'],
    localBlurb: 'A Concho Valley hub home to Angelo State University and Goodfellow Air Force Base.',
  },
  {
    name: 'Abilene', slug: 'abilene', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 125000, medianIncome: 52000, tier: 3, region: 'West Texas', county: 'Taylor',
    zips: ['79601', '79602', '79605'],
    localBlurb: 'The "Key City" of West Texas home to three universities and Dyess Air Force Base.',
  },
  {
    name: 'Canyon', slug: 'canyon', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 15000, medianIncome: 55000, tier: 2, region: 'Texas Panhandle', county: 'Randall',
    zips: ['79015'],
    localBlurb: 'A Panhandle city home to West Texas A&M University south of Amarillo.',
  },
  {
    name: 'Big Spring', slug: 'big-spring', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 26000, medianIncome: 48000, tier: 3, region: 'West Texas', county: 'Howard',
    zips: ['79720'],
    localBlurb: 'A Permian Basin city and Howard County seat with a state hospital and VA center.',
  },
  {
    name: 'Sweetwater', slug: 'sweetwater', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 10000, medianIncome: 45000, tier: 3, region: 'West Texas', county: 'Nolan',
    zips: ['79556'],
    localBlurb: 'A West Texas wind-energy hub and Nolan County seat.',
  },
  {
    name: 'Plainview', slug: 'plainview', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 20000, medianIncome: 45000, tier: 3, region: 'Texas Panhandle', county: 'Hale',
    zips: ['79072'],
    localBlurb: 'A South Plains agricultural city home to Wayland Baptist University.',
  },
  {
    name: 'Socorro', slug: 'socorro', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 34000, medianIncome: 45000, tier: 3, region: 'West Texas', county: 'El Paso',
    zips: ['79927'],
    localBlurb: 'A growing city in the Lower Valley of El Paso County along the Rio Grande.',
  },
  {
    name: 'Horizon City', slug: 'horizon-city', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 22000, medianIncome: 65000, tier: 2, region: 'West Texas', county: 'El Paso',
    zips: ['79928'],
    localBlurb: 'A fast-growing desert suburb east of El Paso.',
  },
  {
    name: 'Andrews', slug: 'andrews', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 14000, medianIncome: 70000, tier: 3, region: 'West Texas', county: 'Andrews',
    zips: ['79714'],
    localBlurb: 'A Permian Basin oil city and Andrews County seat.',
  },
  {
    name: 'Pecos', slug: 'pecos', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX',
    population: 12000, medianIncome: 55000, tier: 3, region: 'West Texas', county: 'Reeves',
    zips: ['79772'],
    localBlurb: 'A Permian Basin boomtown and Reeves County seat known as the home of the world’s first rodeo.',
  },

  // ─────────────────────────────────────────────
  // ILLINOIS - full state build-out, targeted by wealth + population.
  // County, ZIPs, and a unique localBlurb per city (doorway-page mitigation).
  // ─────────────────────────────────────────────

  // - Chicago Core -
  {
    name: 'Chicago', slug: 'chicago', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 2721000, medianIncome: 71000, tier: 1, region: 'Chicagoland area', county: 'Cook',
    zips: ['60601', '60611', '60614', '60657'],
    localBlurb: 'The third-largest city in the nation anchors one of the densest medical and research corridors in the country, home to the University of Chicago, Northwestern University Feinberg School of Medicine, UIC, and the Illinois Medical District on the Near West Side.',
  },

  // - North Shore And North Cook -
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

  // - Lake County -
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

  // - Barrington Area And Northwest Cook -
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

  // - McHenry County -
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

  // - Kane County And Fox Valley -
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

  // - DuPage County -
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

  // - West Cook -
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

  // - Southwest Cook -
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

  // - Will County And Southwest Corridor -
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

  // - Kendall County -
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

  // - Northern Illinois -
  {
    name: 'Rockford', slug: 'rockford', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 147000, medianIncome: 55000, tier: 3, region: 'Northern Illinois', county: 'Winnebago',
    zips: ['61101', '61107', '61108'],
    localBlurb: 'A northern Illinois manufacturing and aerospace hub served by three hospital systems and the University of Illinois College of Medicine Rockford.',
  },

  // - Central Illinois -
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

  // - Metro East And Quad Cities -
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
  {
    name: 'Cicero', slug: 'cicero', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 80000, medianIncome: 55000, tier: 2, region: 'Chicagoland area', county: 'Cook',
    zips: ['60804'],
    localBlurb: 'From the historic architecture along Cermak Road to the vibrant industrial parks, Pep Nation Lab provides Cicero research professionals with rapid access to 99%+ pure research peptides. Our secure fulfillment network ensures next-day processing for critical in vitro studies across Cook County.'
  },
  {
    name: 'Waukegan', slug: 'waukegan', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 87000, medianIncome: 60000, tier: 2, region: 'Chicagoland area', county: 'Lake',
    zips: ['60085', '60087'],
    localBlurb: 'Supporting the scientific community near the Lake County medical and bioscience corridor, Pep Nation Lab delivers third-party tested research peptides to Waukegan. Whether conducting trials near the harbor district or inland labs, researchers trust our verifiable COAs and consistent wholesale pricing.'
  },
  {
    name: 'DeKalb', slug: 'dekalb', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 40000, medianIncome: 45000, tier: 3, region: 'Northern Illinois', county: 'DeKalb',
    zips: ['60115'],
    localBlurb: 'Home to major academic and agricultural research institutions, DeKalb relies on Pep Nation Lab for premium analytical compounds. We supply Northern Illinois University affiliates and independent investigators with strictly regulated, high-purity peptides for advanced structural and binding assays.'
  },
  {
    name: 'Urbana', slug: 'urbana', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 38000, medianIncome: 50000, tier: 3, region: 'Central Illinois', county: 'Champaign',
    zips: ['61801', '61802'],
    localBlurb: 'As a global hub for scientific innovation and home to leading research parks, Urbana demands uncompromising quality. Pep Nation Lab provides Urbana researchers with lyophilized, synthesis-verified peptides perfectly suited for the rigorous analytical environments of the Silicon Prairie.'
  },
  {
    name: 'Quincy', slug: 'quincy', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 40000, medianIncome: 52000, tier: 3, region: 'Central Illinois', county: 'Adams',
    zips: ['62301'],
    localBlurb: 'Serving the "Gem City" and the broader Tri-State area, Pep Nation Lab is Quincy’s premier source for research peptides. We offer fast, discreet shipping along the Mississippi corridor, equipping local scientific teams with the reference materials needed for complex cellular research.'
  },
  {
    name: 'Rock Island', slug: 'rock-island', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 37000, medianIncome: 50000, tier: 3, region: 'Quad Cities', county: 'Rock Island',
    zips: ['61201'],
    localBlurb: 'Nestled in the Quad Cities, Rock Island’s clinical and environmental researchers trust Pep Nation Lab for domestic, USA-verified compounds. From the Arsenal district to Augustana’s academic labs, we provide BPC-157, TB-500, and more with guaranteed mass spectroscopy reports.'
  },
  {
    name: 'Carbondale', slug: 'carbondale', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 21000, medianIncome: 30000, tier: 3, region: 'Southern Illinois', county: 'Jackson',
    zips: ['62901'],
    localBlurb: 'As the educational and medical center of Little Egypt, Carbondale is a key hub for physiological research. Pep Nation Lab supplies investigators across the SIU corridor with premium research peptides, backed by transparent NMR testing for demanding in vitro applications.'
  },
  {
    name: 'Macomb', slug: 'macomb', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 15000, medianIncome: 35000, tier: 3, region: 'Western Illinois', county: 'McDonough',
    zips: ['61455'],
    localBlurb: 'Serving the academic and scientific communities of McDonough County, Pep Nation Lab is Macomb’s reliable supplier for research-grade peptides. We streamline procurement for Western Illinois University labs and private clinics conducting localized cellular receptor studies.'
  },
  {
    name: 'Alton', slug: 'alton', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 25000, medianIncome: 45000, tier: 3, region: 'Metro East', county: 'Madison',
    zips: ['62002'],
    localBlurb: 'Located along the historic Mississippi River bluffs, Alton’s medical and research facilities depend on Pep Nation Lab for fast, secure compound delivery. We provide the Riverbend region with third-party tested peptides designed explicitly for high-precision analytical research.'
  },
  {
    name: 'Galesburg', slug: 'galesburg', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 30000, medianIncome: 40000, tier: 3, region: 'Western Illinois', county: 'Knox',
    zips: ['61401'],
    localBlurb: 'From the Knox College campus to the thriving local medical districts, Galesburg researchers choose Pep Nation Lab for unparalleled peptide purity. Our strict US-based fulfillment ensures your lab receives stable, properly stored compounds ready for immediate reconstitution.'
  },
  {
    name: 'Marion', slug: 'marion', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 16000, medianIncome: 45000, tier: 3, region: 'Southern Illinois', county: 'Williamson',
    zips: ['62959'],
    localBlurb: 'As the retail and medical hub of Southern Illinois, Marion’s scientific investigators require dependable access to research chemicals. Pep Nation Lab offers Marion labs wholesale access to Semaglutide, Tirzepatide, and other peptides with verifiable certificates of analysis.'
  },
  {
    name: 'Mount Vernon', slug: 'mount-vernon', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 14000, medianIncome: 48000, tier: 3, region: 'Southern Illinois', county: 'Jefferson',
    zips: ['62864'],
    localBlurb: 'Situated at the crossroads of Southern Illinois, Mount Vernon is a strategic center for regional healthcare and bio-research. Pep Nation Lab equips Jefferson County facilities with research-grade peptides, guaranteeing fast logistics and uncompromising batch purity.'
  },
  {
    name: 'Effingham', slug: 'effingham', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 12000, medianIncome: 55000, tier: 3, region: 'Central Illinois', county: 'Effingham',
    zips: ['62401'],
    localBlurb: 'Known as the Crossroads of Opportunity, Effingham’s growing clinical research footprint relies on Pep Nation Lab. We supply specialized research peptides to local investigators, providing the crucial raw materials needed for advanced metabolic and regenerative tissue assays.'
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
  { name: 'Pittsburgh', slug: 'pittsburgh', state: 'Pennsylvania', stateSlug: 'pennsylvania', stateAbbr: 'PA', population: 303000, medianIncome: 53000, tier: 3, region: 'Greater Kansas City' },
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
 * use `new Date()` for lastmod - stamping every build teaches crawlers to
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
