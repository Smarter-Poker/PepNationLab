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
  { name: 'Pasadena', slug: 'pasadena', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 138000, medianIncome: 80000, tier: 2 },
  { name: 'Walnut Creek', slug: 'walnut-creek', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 70000, medianIncome: 100000, tier: 2, region: 'Bay Area' },
  { name: 'Pleasanton', slug: 'pleasanton', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 82000, medianIncome: 130000, tier: 2, region: 'Bay Area' },
  { name: 'Dublin', slug: 'dublin', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 72000, medianIncome: 125000, tier: 2, region: 'Bay Area' },
  { name: 'San Jose', slug: 'san-jose', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 1013000, medianIncome: 110000, tier: 2, region: 'Silicon Valley' },
  { name: 'Cupertino', slug: 'cupertino', state: 'California', stateSlug: 'california', stateAbbr: 'CA', population: 60000, medianIncome: 155000, tier: 1, region: 'Silicon Valley', county: 'Santa Clara', zips: ['95014'], localBlurb: 'Innovators in Cupertino\'s tech and biotech sectors partner with us for our commitment to precision, purity, and rapid local fulfillment.' },
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
  // FLORIDA - full state build-out, targeted by wealth + population.
  // County, ZIPs, and a unique localBlurb per city (doorway-page mitigation).
  // ─────────────────────────────────────────────
  // - Miami Metro: Miami-Dade And Broward -
  { name: 'Miami', slug: 'miami', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 442000, medianIncome: 54000, tier: 1, region: 'Miami Metro', county: 'Miami-Dade', zips: ['33130', '33131', '33136'], localBlurb: 'Miami is home to the University of Miami Miller School of Medicine and the Jackson Memorial medical campus, one of the largest hospital districts in the nation.' },
  { name: 'Miami Beach', slug: 'miami-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 80000, medianIncome: 65000, tier: 2, region: 'Miami Metro', county: 'Miami-Dade', zips: ['33139', '33140'], localBlurb: 'Miami Beach is anchored by Mount Sinai Medical Center, the largest private independent teaching hospital in South Florida.' },
  { name: 'Coral Gables', slug: 'coral-gables', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 49000, medianIncome: 115000, tier: 1, region: 'Miami Metro', county: 'Miami-Dade', zips: ['33134', '33146'], localBlurb: 'Coral Gables is home to the main University of Miami campus and Baptist Health Doctors Hospital.' },
  { name: 'Pinecrest', slug: 'pinecrest', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 18000, medianIncome: 170000, tier: 1, region: 'Miami Metro', county: 'Miami-Dade', zips: ['33156'], localBlurb: 'Pinecrest is a banyan-shaded village in south Miami-Dade, minutes from the Baptist Hospital of Miami medical campus.' },
  { name: 'Key Biscayne', slug: 'key-biscayne', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 14000, medianIncome: 160000, tier: 1, region: 'Miami Metro', county: 'Miami-Dade', zips: ['33149'], localBlurb: 'Key Biscayne sits beyond the Rickenbacker Causeway beside the University of Miami Rosenstiel marine research campus on Virginia Key.' },
  { name: 'Palmetto Bay', slug: 'palmetto-bay', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 24000, medianIncome: 120000, tier: 2, region: 'Miami Metro', county: 'Miami-Dade', zips: ['33157', '33158'], localBlurb: 'Palmetto Bay is a waterfront village along Biscayne Bay in the affluent south Miami-Dade suburban corridor.' },
  { name: 'South Miami', slug: 'south-miami', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 12000, medianIncome: 75000, tier: 2, region: 'Miami Metro', county: 'Miami-Dade', zips: ['33143'], localBlurb: 'South Miami is anchored by Baptist Health South Miami Hospital and borders the University of Miami campus.' },
  { name: 'Doral', slug: 'doral', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 80000, medianIncome: 80000, tier: 2, region: 'Miami Metro', county: 'Miami-Dade', zips: ['33122', '33166', '33178'], localBlurb: 'Doral is one of the fastest growing corporate hubs in Florida, packed with multinational headquarters west of Miami International Airport.' },
  { name: 'Aventura', slug: 'aventura', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 40000, medianIncome: 78000, tier: 1, region: 'Miami Metro', county: 'Miami-Dade', zips: ['33180'], localBlurb: 'Aventura is anchored by HCA Florida Aventura Hospital and the high-rise corridor around Aventura Mall in northeast Miami-Dade.' },
  { name: 'Sunny Isles Beach', slug: 'sunny-isles-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 22000, medianIncome: 62000, tier: 1, region: 'Miami Metro', county: 'Miami-Dade', zips: ['33160'], localBlurb: 'Sunny Isles Beach is a high-rise oceanfront city on the barrier island between the Intracoastal Waterway and the Atlantic.' },
  { name: 'Bal Harbour', slug: 'bal-harbour', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 3000, medianIncome: 130000, tier: 1, region: 'Miami Metro', county: 'Miami-Dade', zips: ['33154'], localBlurb: 'Bal Harbour is one of the most exclusive villages in South Florida, at the northern tip of the Miami Beach barrier island.' },
  { name: 'Miami Lakes', slug: 'miami-lakes', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 31000, medianIncome: 85000, tier: 2, region: 'Miami Metro', county: 'Miami-Dade', zips: ['33014', '33016'], localBlurb: 'Miami Lakes is a master-planned town in northwest Miami-Dade with a dense base of medical offices and corporate parks.' },
  { name: 'Kendall', slug: 'kendall', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 80000, medianIncome: 75000, tier: 2, region: 'Miami Metro', county: 'Miami-Dade', zips: ['33156', '33176'], localBlurb: 'Kendall is anchored by Baptist Hospital of Miami, the flagship campus of Baptist Health South Florida.' },
  { name: 'Hialeah', slug: 'hialeah', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 220000, medianIncome: 40000, tier: 3, region: 'Miami Metro', county: 'Miami-Dade', zips: ['33010', '33012'], localBlurb: 'Hialeah is one of the largest cities in Florida, served by Hialeah Hospital and the Palmetto General Hospital medical corridor.' },
  { name: 'Fort Lauderdale', slug: 'fort-lauderdale', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 185000, medianIncome: 70000, tier: 2, region: 'Miami Metro', county: 'Broward', zips: ['33301', '33308', '33316'], localBlurb: 'Fort Lauderdale is anchored by Broward Health Medical Center and Holy Cross Health along the Federal Highway hospital corridor.' },
  { name: 'Weston', slug: 'weston', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 71000, medianIncome: 110000, tier: 1, region: 'Miami Metro', county: 'Broward', zips: ['33326', '33327'], localBlurb: 'Weston is home to the flagship Cleveland Clinic Florida hospital and research campus on the western edge of Broward County.' },
  { name: 'Parkland', slug: 'parkland', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 36000, medianIncome: 155000, tier: 1, region: 'Miami Metro', county: 'Broward', zips: ['33067', '33076'], localBlurb: 'Parkland is one of the highest income cities in Broward County, a gated-community enclave north of Coral Springs.' },
  { name: 'Coral Springs', slug: 'coral-springs', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 134000, medianIncome: 85000, tier: 2, region: 'Miami Metro', county: 'Broward', zips: ['33065', '33071'], localBlurb: 'Coral Springs is served by Broward Health Coral Springs hospital in the heart of northwest Broward.' },
  { name: 'Plantation', slug: 'plantation', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 92000, medianIncome: 80000, tier: 2, region: 'Miami Metro', county: 'Broward', zips: ['33317', '33324'], localBlurb: 'Plantation hosts the Magic Leap technology headquarters and HCA Florida Westside Hospital.' },
  { name: 'Davie', slug: 'davie', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 106000, medianIncome: 75000, tier: 2, region: 'Miami Metro', county: 'Broward', zips: ['33314', '33328'], localBlurb: 'Davie is home to Nova Southeastern University and its colleges of medicine, pharmacy, and dental medicine.' },
  { name: 'Cooper City', slug: 'cooper-city', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 34000, medianIncome: 110000, tier: 2, region: 'Miami Metro', county: 'Broward', zips: ['33328', '33330'], localBlurb: 'Cooper City is a top-rated family suburb beside the Nova Southeastern University academic corridor in central Broward.' },
  { name: 'Southwest Ranches', slug: 'southwest-ranches', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 8000, medianIncome: 120000, tier: 1, region: 'Miami Metro', county: 'Broward', zips: ['33330', '33331'], localBlurb: 'Southwest Ranches preserves equestrian estates and ranch lots along the western edge of Broward County.' },
  { name: 'Pembroke Pines', slug: 'pembroke-pines', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 170000, medianIncome: 72000, tier: 2, region: 'Miami Metro', county: 'Broward', zips: ['33024', '33028'], localBlurb: 'Pembroke Pines is served by Memorial Hospital West, one of the busiest hospitals in the Memorial Healthcare System.' },
  { name: 'Hollywood', slug: 'hollywood', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 153000, medianIncome: 60000, tier: 2, region: 'Miami Metro', county: 'Broward', zips: ['33019', '33020', '33021'], localBlurb: 'Hollywood is anchored by Memorial Regional Hospital and Joe DiMaggio Children\'s Hospital, the flagship campuses of Memorial Healthcare System.' },
  { name: 'Lighthouse Point', slug: 'lighthouse-point', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 12000, medianIncome: 110000, tier: 1, region: 'Miami Metro', county: 'Broward', zips: ['33064'], localBlurb: 'Lighthouse Point is a deepwater canal community of boating estates between Pompano Beach and Deerfield Beach.' },
  { name: 'Pompano Beach', slug: 'pompano-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 112000, medianIncome: 55000, tier: 3, region: 'Miami Metro', county: 'Broward', zips: ['33060', '33062'], localBlurb: 'Pompano Beach anchors the northeast Broward coastline with a fast-redeveloping beachfront and marine industry base.' },
  { name: 'Deerfield Beach', slug: 'deerfield-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 87000, medianIncome: 55000, tier: 3, region: 'Miami Metro', county: 'Broward', zips: ['33441', '33442'], localBlurb: 'Deerfield Beach hosts Broward Health North hospital on the Broward and Palm Beach county line.' },

  // - Palm Beach Area -
  { name: 'Palm Beach', slug: 'palm-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 9000, medianIncome: 200000, tier: 1, region: 'Palm Beach Area', county: 'Palm Beach', zips: ['33480'], localBlurb: 'Palm Beach is the island town of landmark estates across the Intracoastal from the West Palm Beach medical district.' },
  { name: 'West Palm Beach', slug: 'west-palm-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 120000, medianIncome: 62000, tier: 2, region: 'Palm Beach Area', county: 'Palm Beach', zips: ['33401', '33407'], localBlurb: 'West Palm Beach is anchored by St. Mary\'s Medical Center and Good Samaritan Medical Center, plus a fast-growing downtown financial district.' },
  { name: 'Palm Beach Gardens', slug: 'palm-beach-gardens', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 60000, medianIncome: 95000, tier: 1, region: 'Palm Beach Area', county: 'Palm Beach', zips: ['33410', '33418'], localBlurb: 'Palm Beach Gardens is served by Palm Beach Gardens Medical Center and the Gardens Mall corporate corridor.' },
  { name: 'Jupiter', slug: 'jupiter', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 61000, medianIncome: 95000, tier: 1, region: 'Palm Beach Area', county: 'Palm Beach', zips: ['33458', '33477', '33478'], localBlurb: 'Jupiter is a national research hub, home to the UF Scripps biomedical research campus, the Max Planck Florida Institute for Neuroscience, and Jupiter Medical Center.' },
  { name: 'Juno Beach', slug: 'juno-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 4000, medianIncome: 110000, tier: 1, region: 'Palm Beach Area', county: 'Palm Beach', zips: ['33408'], localBlurb: 'Juno Beach is home to the NextEra Energy and Florida Power and Light corporate headquarters.' },
  { name: 'North Palm Beach', slug: 'north-palm-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 13000, medianIncome: 85000, tier: 2, region: 'Palm Beach Area', county: 'Palm Beach', zips: ['33408'], localBlurb: 'North Palm Beach is a village of waterways on the Lake Worth Lagoon, minutes south of the Jupiter research corridor.' },
  { name: 'Tequesta', slug: 'tequesta', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 6000, medianIncome: 100000, tier: 1, region: 'Palm Beach Area', county: 'Palm Beach', zips: ['33469'], localBlurb: 'Tequesta sits at the mouth of the Loxahatchee River at the northern tip of the Palm Beach County coastal estate corridor.' },
  { name: 'Wellington', slug: 'wellington', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 62000, medianIncome: 100000, tier: 2, region: 'Palm Beach Area', county: 'Palm Beach', zips: ['33414'], localBlurb: 'Wellington is the winter equestrian capital of the world, served by Wellington Regional Medical Center.' },
  { name: 'Boynton Beach', slug: 'boynton-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 80000, medianIncome: 60000, tier: 3, region: 'Palm Beach Area', county: 'Palm Beach', zips: ['33426', '33435', '33436'], localBlurb: 'Boynton Beach is served by Bethesda Hospital East, part of the Baptist Health South Florida network.' },
  { name: 'Delray Beach', slug: 'delray-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 67000, medianIncome: 70000, tier: 2, region: 'Palm Beach Area', county: 'Palm Beach', zips: ['33444', '33445', '33483'], localBlurb: 'Delray Beach pairs the Atlantic Avenue downtown with Delray Medical Center, a Level I trauma center.' },
  { name: 'Boca Raton', slug: 'boca-raton', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 97000, medianIncome: 95000, tier: 1, region: 'Palm Beach Area', county: 'Palm Beach', zips: ['33431', '33432', '33496'], localBlurb: 'Boca Raton is home to Florida Atlantic University and its Schmidt College of Medicine, plus Baptist Health Boca Raton Regional Hospital.' },
  { name: 'Highland Beach', slug: 'highland-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 4000, medianIncome: 130000, tier: 1, region: 'Palm Beach Area', county: 'Palm Beach', zips: ['33487'], localBlurb: 'Highland Beach is a three mile oceanfront town of condominium and villa estates between Delray Beach and Boca Raton.' },

  // - Greater Orlando -
  { name: 'Orlando', slug: 'orlando', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 310000, medianIncome: 60000, tier: 1, region: 'Greater Orlando', county: 'Orange', zips: ['32801', '32803', '32827'], localBlurb: 'Orlando is home to AdventHealth Orlando, Orlando Health ORMC, and the Lake Nona Medical City cluster anchored by the UCF College of Medicine.' },
  { name: 'Winter Park', slug: 'winter-park', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 30000, medianIncome: 85000, tier: 1, region: 'Greater Orlando', county: 'Orange', zips: ['32789', '32792'], localBlurb: 'Winter Park is home to Rollins College and AdventHealth Winter Park hospital just off the Park Avenue shopping district.' },
  { name: 'Windermere', slug: 'windermere', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 3400, medianIncome: 150000, tier: 1, region: 'Greater Orlando', county: 'Orange', zips: ['34786'], localBlurb: 'Windermere sits among the Butler Chain of Lakes, one of the most exclusive lakefront addresses in Central Florida.' },
  { name: 'Winter Garden', slug: 'winter-garden', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 47000, medianIncome: 90000, tier: 2, region: 'Greater Orlando', county: 'Orange', zips: ['34787'], localBlurb: 'Winter Garden anchors the Horizon West growth corridor and is served by Orlando Health Horizon West Hospital.' },
  { name: 'Dr. Phillips', slug: 'dr-phillips', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 12000, medianIncome: 110000, tier: 1, region: 'Greater Orlando', county: 'Orange', zips: ['32819'], localBlurb: 'Dr. Phillips is an upscale lakefront community along the Sand Lake Road corridor, served by Orlando Health Dr. P. Phillips Hospital.' },
  { name: 'Maitland', slug: 'maitland', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 20000, medianIncome: 90000, tier: 2, region: 'Greater Orlando', county: 'Orange', zips: ['32751'], localBlurb: 'Maitland pairs its chain of lakes with one of the largest suburban office corridors in the Orlando metro.' },
  { name: 'Lake Mary', slug: 'lake-mary', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 17000, medianIncome: 110000, tier: 1, region: 'Greater Orlando', county: 'Seminole', zips: ['32746'], localBlurb: 'Lake Mary anchors the I-4 corporate and technology corridor of Seminole County, one of the wealthiest business districts in Central Florida.' },
  { name: 'Longwood', slug: 'longwood', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 16000, medianIncome: 80000, tier: 2, region: 'Greater Orlando', county: 'Seminole', zips: ['32750', '32779'], localBlurb: 'Longwood includes the Sweetwater and Wekiva estate communities beside Wekiwa Springs State Park.' },
  { name: 'Altamonte Springs', slug: 'altamonte-springs', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 47000, medianIncome: 60000, tier: 2, region: 'Greater Orlando', county: 'Seminole', zips: ['32701', '32714'], localBlurb: 'Altamonte Springs is anchored by AdventHealth Altamonte Springs, one of the busiest community hospitals in the AdventHealth system.' },
  { name: 'Winter Springs', slug: 'winter-springs', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 38000, medianIncome: 90000, tier: 2, region: 'Greater Orlando', county: 'Seminole', zips: ['32708'], localBlurb: 'Winter Springs is a Tuscawilla corridor suburb repeatedly ranked among the best places to live in Florida.' },
  { name: 'Oviedo', slug: 'oviedo', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 41000, medianIncome: 105000, tier: 2, region: 'Greater Orlando', county: 'Seminole', zips: ['32765', '32766'], localBlurb: 'Oviedo is served by Oviedo Medical Center and borders the University of Central Florida research corridor.' },
  { name: 'Sanford', slug: 'sanford', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 62000, medianIncome: 55000, tier: 3, region: 'Greater Orlando', county: 'Seminole', zips: ['32771', '32773'], localBlurb: 'Sanford is the Seminole County seat on Lake Monroe, served by HCA Florida Lake Monroe Hospital.' },
  { name: 'Celebration', slug: 'celebration', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 11000, medianIncome: 100000, tier: 1, region: 'Greater Orlando', county: 'Osceola', zips: ['34747'], localBlurb: 'Celebration is the Disney-founded new urbanist town anchored by AdventHealth Celebration hospital.' },
  { name: 'Kissimmee', slug: 'kissimmee', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 80000, medianIncome: 45000, tier: 3, region: 'Greater Orlando', county: 'Osceola', zips: ['34741', '34744'], localBlurb: 'Kissimmee is served by HCA Florida Osceola Hospital and AdventHealth Kissimmee in the tourism corridor south of Orlando.' },
  { name: 'Clermont', slug: 'clermont', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 45000, medianIncome: 75000, tier: 3, region: 'Greater Orlando', county: 'Lake', zips: ['34711', '34715'], localBlurb: 'Clermont hosts the National Training Center athletic campus and Orlando Health South Lake Hospital in the Lake County hills.' },
  { name: 'Apopka', slug: 'apopka', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 55000, medianIncome: 70000, tier: 3, region: 'Greater Orlando', county: 'Orange', zips: ['32703', '32712'], localBlurb: 'Apopka is served by AdventHealth Apopka on the fast-growing northwest side of the Orlando metro.' },

  // - Tampa Bay Area -
  { name: 'Tampa', slug: 'tampa', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 400000, medianIncome: 60000, tier: 1, region: 'Tampa Bay Area', county: 'Hillsborough', zips: ['33602', '33606', '33629'], localBlurb: 'Tampa is home to Moffitt Cancer Center, the USF Health Morsani College of Medicine, and Tampa General Hospital, one of the largest academic health campuses on the Gulf coast.' },
  { name: 'St. Petersburg', slug: 'st-petersburg', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 260000, medianIncome: 65000, tier: 2, region: 'Tampa Bay Area', county: 'Pinellas', zips: ['33701', '33704', '33712'], localBlurb: 'St. Petersburg is anchored by Johns Hopkins All Children\'s Hospital and Bayfront Health St. Petersburg near the downtown waterfront.' },
  { name: 'Clearwater', slug: 'clearwater', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 117000, medianIncome: 55000, tier: 3, region: 'Tampa Bay Area', county: 'Pinellas', zips: ['33755', '33759', '33767'], localBlurb: 'Clearwater is served by Morton Plant Hospital, the historic flagship of the BayCare network, near the Clearwater Beach gateway.' },
  { name: 'Wesley Chapel', slug: 'wesley-chapel', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 65000, medianIncome: 90000, tier: 2, region: 'Tampa Bay Area', county: 'Pasco', zips: ['33543', '33544', '33545'], localBlurb: 'Wesley Chapel is one of the fastest growing suburbs in Florida, served by AdventHealth Wesley Chapel and BayCare Hospital Wesley Chapel.' },
  { name: 'Lutz', slug: 'lutz', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 25000, medianIncome: 85000, tier: 2, region: 'Tampa Bay Area', county: 'Hillsborough', zips: ['33548', '33549', '33558'], localBlurb: 'Lutz is served by St. Joseph\'s Hospital North on the affluent northern edge of Hillsborough County.' },
  { name: 'Palm Harbor', slug: 'palm-harbor', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 62000, medianIncome: 75000, tier: 2, region: 'Tampa Bay Area', county: 'Pinellas', zips: ['34683', '34684', '34685'], localBlurb: 'Palm Harbor includes the Innisbrook golf resort corridor in the well-off northern tier of Pinellas County.' },
  { name: 'Safety Harbor', slug: 'safety-harbor', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 17000, medianIncome: 80000, tier: 2, region: 'Tampa Bay Area', county: 'Pinellas', zips: ['34695'], localBlurb: 'Safety Harbor is home to the Mease Countryside Hospital campus and a historic spa district on upper Tampa Bay.' },
  { name: 'Dunedin', slug: 'dunedin', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 36000, medianIncome: 60000, tier: 3, region: 'Tampa Bay Area', county: 'Pinellas', zips: ['34698'], localBlurb: 'Dunedin pairs its Pinellas Trail downtown with Mease Dunedin Hospital a few blocks from the marina.' },
  { name: 'Largo', slug: 'largo', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 82000, medianIncome: 50000, tier: 3, region: 'Tampa Bay Area', county: 'Pinellas', zips: ['33770', '33771'], localBlurb: 'Largo hosts HCA Florida Largo Hospital, one of the larger acute care hospitals in Pinellas County.' },
  { name: 'Belleair', slug: 'belleair', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 4000, medianIncome: 110000, tier: 1, region: 'Tampa Bay Area', county: 'Pinellas', zips: ['33756'], localBlurb: 'Belleair is a bluff-top town above Clearwater Harbor, home to the Pelican Golf Club and the historic Belleview grounds.' },
  { name: 'Tarpon Springs', slug: 'tarpon-springs', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 26000, medianIncome: 60000, tier: 3, region: 'Tampa Bay Area', county: 'Pinellas', zips: ['34689'], localBlurb: 'Tarpon Springs hosts AdventHealth North Pinellas hospital and the historic sponge docks district.' },
  { name: 'Brandon', slug: 'brandon', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 115000, medianIncome: 65000, tier: 3, region: 'Tampa Bay Area', county: 'Hillsborough', zips: ['33510', '33511'], localBlurb: 'Brandon is anchored by HCA Florida Brandon Hospital in the eastern Hillsborough suburban belt.' },
  { name: 'Riverview', slug: 'riverview', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 110000, medianIncome: 80000, tier: 3, region: 'Tampa Bay Area', county: 'Hillsborough', zips: ['33569', '33578', '33579'], localBlurb: 'Riverview is served by St. Joseph\'s Hospital South in one of the fastest growing corridors of Hillsborough County.' },
  { name: 'Apollo Beach', slug: 'apollo-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 30000, medianIncome: 90000, tier: 2, region: 'Tampa Bay Area', county: 'Hillsborough', zips: ['33572'], localBlurb: 'Apollo Beach is a canal-front boating community on the eastern shore of Tampa Bay.' },
  { name: 'Lakeland', slug: 'lakeland', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 115000, medianIncome: 55000, tier: 3, region: 'Tampa Bay Area', county: 'Polk', zips: ['33801', '33803', '33813'], localBlurb: 'Lakeland is home to Lakeland Regional Health Medical Center, one of the busiest emergency departments in the nation, and Florida Southern College.' },

  // - Southwest Florida -
  { name: 'Sarasota', slug: 'sarasota', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 57000, medianIncome: 70000, tier: 1, region: 'Southwest Florida', county: 'Sarasota', zips: ['34236', '34239'], localBlurb: 'Sarasota is anchored by Sarasota Memorial Hospital, one of the largest public health systems in Florida, and the New College of Florida campus.' },
  { name: 'Longboat Key', slug: 'longboat-key', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 7500, medianIncome: 130000, tier: 1, region: 'Southwest Florida', county: 'Sarasota', zips: ['34228'], localBlurb: 'Longboat Key is a twelve mile barrier island of gulf-front estates between Sarasota Bay and the Gulf of Mexico.' },
  { name: 'Lakewood Ranch', slug: 'lakewood-ranch', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 70000, medianIncome: 110000, tier: 1, region: 'Southwest Florida', county: 'Manatee', zips: ['34202', '34211'], localBlurb: 'Lakewood Ranch is one of the best selling master-planned communities in the country, served by Lakewood Ranch Medical Center.' },
  { name: 'Bradenton', slug: 'bradenton', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 57000, medianIncome: 55000, tier: 3, region: 'Southwest Florida', county: 'Manatee', zips: ['34205', '34209'], localBlurb: 'Bradenton is served by Manatee Memorial Hospital and HCA Florida Blake Hospital, and hosts the IMG Academy campus.' },
  { name: 'Venice', slug: 'venice', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 27000, medianIncome: 70000, tier: 2, region: 'Southwest Florida', county: 'Sarasota', zips: ['34285', '34293'], localBlurb: 'Venice is home to the Sarasota Memorial Hospital Venice campus and a Mediterranean revival downtown on the island.' },
  { name: 'Naples', slug: 'naples', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 22000, medianIncome: 120000, tier: 1, region: 'Southwest Florida', county: 'Collier', zips: ['34102', '34103', '34108'], localBlurb: 'Naples is anchored by the NCH Healthcare System hospital campuses and the Arthrex medical device headquarters.' },
  { name: 'Marco Island', slug: 'marco-island', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 18000, medianIncome: 95000, tier: 1, region: 'Southwest Florida', county: 'Collier', zips: ['34145'], localBlurb: 'Marco Island is the largest developed island of the Ten Thousand Islands, a resort and estate community south of Naples.' },
  { name: 'Bonita Springs', slug: 'bonita-springs', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 55000, medianIncome: 85000, tier: 1, region: 'Southwest Florida', county: 'Lee', zips: ['34134', '34135'], localBlurb: 'Bonita Springs sits between Naples and Fort Myers, minutes from the Lee Health Coconut Point medical campus.' },
  { name: 'Estero', slug: 'estero', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 37000, medianIncome: 95000, tier: 1, region: 'Southwest Florida', county: 'Lee', zips: ['33928'], localBlurb: 'Estero hosts the Hertz global headquarters and borders both Florida Gulf Coast University and the Coconut Point medical village.' },
  { name: 'Fort Myers', slug: 'fort-myers', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 92000, medianIncome: 55000, tier: 2, region: 'Southwest Florida', county: 'Lee', zips: ['33901', '33907', '33916'], localBlurb: 'Fort Myers is the hub of the Lee Health system, including Gulf Coast Medical Center and HealthPark Medical Center.' },
  { name: 'Cape Coral', slug: 'cape-coral', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 205000, medianIncome: 65000, tier: 3, region: 'Southwest Florida', county: 'Lee', zips: ['33904', '33909', '33914'], localBlurb: 'Cape Coral is the largest city in Southwest Florida, served by Cape Coral Hospital and laced with more canals than any city in the world.' },
  { name: 'Sanibel', slug: 'sanibel', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 6300, medianIncome: 110000, tier: 1, region: 'Southwest Florida', county: 'Lee', zips: ['33957'], localBlurb: 'Sanibel is a conservation-minded island city, home to the Ding Darling National Wildlife Refuge and world-renowned shelling beaches.' },

  // - Northeast Florida -
  { name: 'Jacksonville', slug: 'jacksonville', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 950000, medianIncome: 60000, tier: 1, region: 'Northeast Florida', county: 'Duval', zips: ['32202', '32207', '32224'], localBlurb: 'Jacksonville is home to the Mayo Clinic Florida campus, UF Health Jacksonville, and the Baptist MD Anderson Cancer Center.' },
  { name: 'Ponte Vedra Beach', slug: 'ponte-vedra-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 27000, medianIncome: 130000, tier: 1, region: 'Northeast Florida', county: 'St. Johns', zips: ['32082'], localBlurb: 'Ponte Vedra Beach hosts the PGA Tour headquarters and sits minutes from the Mayo Clinic Jacksonville campus.' },
  { name: 'Jacksonville Beach', slug: 'jacksonville-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 24000, medianIncome: 80000, tier: 2, region: 'Northeast Florida', county: 'Duval', zips: ['32250'], localBlurb: 'Jacksonville Beach is served by Baptist Medical Center Beaches along the First Coast oceanfront.' },
  { name: 'Atlantic Beach', slug: 'atlantic-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 14000, medianIncome: 90000, tier: 2, region: 'Northeast Florida', county: 'Duval', zips: ['32233'], localBlurb: 'Atlantic Beach is the northernmost of the Jacksonville Beaches communities, beside the Mayport naval corridor.' },
  { name: 'St. Johns', slug: 'st-johns', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 30000, medianIncome: 120000, tier: 1, region: 'Northeast Florida', county: 'St. Johns', zips: ['32259'], localBlurb: 'St. Johns is one of the wealthiest fast-growth communities in Florida, along the Julington Creek corridor south of Jacksonville.' },
  { name: 'St. Augustine', slug: 'st-augustine', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 15000, medianIncome: 60000, tier: 2, region: 'Northeast Florida', county: 'St. Johns', zips: ['32084', '32086'], localBlurb: 'St. Augustine is the oldest city in the nation, home to Flagler College and UF Health Flagler Hospital.' },
  { name: 'Fleming Island', slug: 'fleming-island', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 27000, medianIncome: 100000, tier: 2, region: 'Northeast Florida', county: 'Clay', zips: ['32003'], localBlurb: 'Fleming Island is a master-planned Clay County community served by Baptist Medical Center Clay.' },
  { name: 'Orange Park', slug: 'orange-park', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 9000, medianIncome: 60000, tier: 3, region: 'Northeast Florida', county: 'Clay', zips: ['32073'], localBlurb: 'Orange Park is anchored by HCA Florida Orange Park Hospital southwest of Jacksonville.' },
  { name: 'Fernandina Beach', slug: 'fernandina-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 13000, medianIncome: 75000, tier: 2, region: 'Northeast Florida', county: 'Nassau', zips: ['32034'], localBlurb: 'Fernandina Beach anchors Amelia Island with Baptist Medical Center Nassau and the island resort corridor.' },

  // - North Central Florida -
  { name: 'Gainesville', slug: 'gainesville', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 145000, medianIncome: 45000, tier: 2, region: 'North Central Florida', county: 'Alachua', zips: ['32601', '32608'], localBlurb: 'Gainesville is home to the University of Florida and UF Health Shands Hospital, one of the leading research medical centers in the Southeast.' },
  { name: 'Ocala', slug: 'ocala', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 65000, medianIncome: 50000, tier: 3, region: 'North Central Florida', county: 'Marion', zips: ['34470', '34471'], localBlurb: 'Ocala is the heart of Florida horse country, served by AdventHealth Ocala and HCA Florida Ocala Hospital.' },
  { name: 'The Villages', slug: 'the-villages', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 80000, medianIncome: 60000, tier: 2, region: 'North Central Florida', county: 'Sumter', zips: ['32162', '32163'], localBlurb: 'The Villages is the largest retirement community in the world, served by UF Health The Villages Hospital.' },

  // - Space Coast -
  { name: 'Melbourne', slug: 'melbourne', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 85000, medianIncome: 60000, tier: 2, region: 'Space Coast', county: 'Brevard', zips: ['32901', '32934', '32940'], localBlurb: 'Melbourne is home to the L3Harris Technologies headquarters, the Florida Institute of Technology, and Holmes Regional Medical Center.' },
  { name: 'Satellite Beach', slug: 'satellite-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 11000, medianIncome: 85000, tier: 2, region: 'Space Coast', county: 'Brevard', zips: ['32937'], localBlurb: 'Satellite Beach is a barrier island community at the heart of the Space Coast aerospace workforce corridor.' },
  { name: 'Merritt Island', slug: 'merritt-island', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 36000, medianIncome: 70000, tier: 2, region: 'Space Coast', county: 'Brevard', zips: ['32952', '32953'], localBlurb: 'Merritt Island is the gateway community to the Kennedy Space Center and its research facilities.' },
  { name: 'Cocoa Beach', slug: 'cocoa-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 11000, medianIncome: 65000, tier: 2, region: 'Space Coast', county: 'Brevard', zips: ['32931'], localBlurb: 'Cocoa Beach sits just south of Port Canaveral and the Cape Canaveral Space Force Station launch corridor.' },
  { name: 'Titusville', slug: 'titusville', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 49000, medianIncome: 50000, tier: 3, region: 'Space Coast', county: 'Brevard', zips: ['32780', '32796'], localBlurb: 'Titusville faces the Kennedy Space Center across the Indian River lagoon and is served by Parrish Medical Center.' },

  // - Treasure Coast -
  { name: 'Vero Beach', slug: 'vero-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 17000, medianIncome: 70000, tier: 1, region: 'Treasure Coast', county: 'Indian River', zips: ['32960', '32963'], localBlurb: 'Vero Beach is anchored by Cleveland Clinic Indian River Hospital and the oceanside Riomar estate district.' },
  { name: 'Stuart', slug: 'stuart', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 17000, medianIncome: 65000, tier: 2, region: 'Treasure Coast', county: 'Martin', zips: ['34994', '34996'], localBlurb: 'Stuart is the Martin County seat on the St. Lucie River, home to Cleveland Clinic Martin North Hospital.' },
  { name: 'Palm City', slug: 'palm-city', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 25000, medianIncome: 95000, tier: 2, region: 'Treasure Coast', county: 'Martin', zips: ['34990'], localBlurb: 'Palm City is an equestrian and golf community across the river from the Cleveland Clinic Martin Health campuses.' },
  { name: 'Port St. Lucie', slug: 'port-st-lucie', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 220000, medianIncome: 65000, tier: 3, region: 'Treasure Coast', county: 'St. Lucie', zips: ['34952', '34986'], localBlurb: 'Port St. Lucie hosts Cleveland Clinic Tradition Hospital in the master-planned Tradition district.' },

  // - Florida Panhandle -
  { name: 'Tallahassee', slug: 'tallahassee', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 200000, medianIncome: 55000, tier: 3, region: 'Florida Panhandle', county: 'Leon', zips: ['32301', '32304'], localBlurb: 'Tallahassee is home to Florida State University, its College of Medicine, and the National High Magnetic Field Laboratory, the largest magnet lab in the world.' },
  { name: 'Destin', slug: 'destin', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 14000, medianIncome: 90000, tier: 1, region: 'Florida Panhandle', county: 'Okaloosa', zips: ['32541'], localBlurb: 'Destin is the resort capital of the Emerald Coast with one of the strongest seasonal wealth bases in the Panhandle.' },
  { name: 'Pensacola', slug: 'pensacola', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 54000, medianIncome: 55000, tier: 3, region: 'Florida Panhandle', county: 'Escambia', zips: ['32501', '32502', '32514'], localBlurb: 'Pensacola hosts the Institute for Human and Machine Cognition along with the Ascension Sacred Heart and Baptist Health Care hospital systems.' },

  // - Daytona Beach Area -
  { name: 'Daytona Beach', slug: 'daytona-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 75000, medianIncome: 45000, tier: 3, region: 'Daytona Beach Area', county: 'Volusia', zips: ['32114', '32117'], localBlurb: 'Daytona Beach is home to Embry-Riddle Aeronautical University and Halifax Health Medical Center.' },
  { name: 'Ormond Beach', slug: 'ormond-beach', state: 'Florida', stateSlug: 'florida', stateAbbr: 'FL', population: 44000, medianIncome: 70000, tier: 2, region: 'Daytona Beach Area', county: 'Volusia', zips: ['32174', '32176'], localBlurb: 'Ormond Beach is an oak-canopied coastal city just north of the Halifax Health and AdventHealth Daytona Beach medical corridor.' },

  // ─────────────────────────────────────────────
  // TEXAS - full state build-out, targeted by wealth + population.
  // County, ZIPs, and a unique localBlurb per city (doorway-page mitigation).
  // ─────────────────────────────────────────────
  // - Dallas-Fort Worth Metroplex -
  { name: 'Dallas', slug: 'dallas', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 1304000, medianIncome: 58000, tier: 1, region: 'Dallas-Fort Worth Metroplex', county: 'Dallas', zips: ['75201', '75204', '75225'], localBlurb: 'Dallas is home to UT Southwestern Medical Center, one of the top academic medical centers in the world, along with the Baylor University Medical Center campus east of downtown.' },
  { name: 'Fort Worth', slug: 'fort-worth', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 935000, medianIncome: 64000, tier: 2, region: 'Dallas-Fort Worth Metroplex', county: 'Tarrant', zips: ['76102', '76104', '76107'], localBlurb: 'Fort Worth anchors the western Metroplex with the University of North Texas Health Science Center and the Camp Bowie hospital district.' },
  { name: 'Plano', slug: 'plano', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 290000, medianIncome: 95000, tier: 1, region: 'Dallas-Fort Worth Metroplex', county: 'Collin', zips: ['75023', '75024', '75093'], localBlurb: 'Plano pairs the Legacy West corporate corridor, home to Toyota North America and JPMorgan Chase campuses, with Medical City Plano, a Level I trauma center.' },
  { name: 'Frisco', slug: 'frisco', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 220000, medianIncome: 127000, tier: 1, region: 'Dallas-Fort Worth Metroplex', county: 'Collin', zips: ['75033', '75034', '75035'], localBlurb: 'Frisco is one of the fastest growing cities in America, anchored by Baylor Scott and White Medical Center Frisco and the PGA of America headquarters.' },
  { name: 'McKinney', slug: 'mckinney', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 210000, medianIncome: 98000, tier: 2, region: 'Dallas-Fort Worth Metroplex', county: 'Collin', zips: ['75069', '75070', '75071'], localBlurb: 'McKinney combines its historic downtown square with Medical City McKinney, a full-service acute care hospital for northern Collin County.' },
  { name: 'Allen', slug: 'allen', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 108000, medianIncome: 105000, tier: 2, region: 'Dallas-Fort Worth Metroplex', county: 'Collin', zips: ['75002', '75013'], localBlurb: 'Allen is a top-rated Collin County suburb served by Texas Health Presbyterian Hospital Allen and the Watters Creek district.' },
  { name: 'Prosper', slug: 'prosper', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 42000, medianIncome: 145000, tier: 1, region: 'Dallas-Fort Worth Metroplex', county: 'Collin', zips: ['75078'], localBlurb: 'Prosper is one of the wealthiest boomtowns north of Dallas, home to the Cook Children\'s Medical Center Prosper campus on the US 380 corridor.' },
  { name: 'Celina', slug: 'celina', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 45000, medianIncome: 120000, tier: 2, region: 'Dallas-Fort Worth Metroplex', county: 'Collin', zips: ['75009'], localBlurb: 'Celina has ranked among the fastest growing cities in the nation, at the northern frontier of the Dallas North Tollway growth corridor.' },
  { name: 'Melissa', slug: 'melissa', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 22000, medianIncome: 110000, tier: 2, region: 'Dallas-Fort Worth Metroplex', county: 'Collin', zips: ['75454'], localBlurb: 'Melissa is a fast-growing US 75 corridor town north of McKinney with one of the top-rated small school districts in Collin County.' },
  { name: 'Anna', slug: 'anna', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 28000, medianIncome: 95000, tier: 3, region: 'Dallas-Fort Worth Metroplex', county: 'Collin', zips: ['75409'], localBlurb: 'Anna is one of the newest boomtowns on the US 75 corridor, roughly doubling in population over the past decade.' },
  { name: 'Fairview', slug: 'fairview', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 11000, medianIncome: 150000, tier: 1, region: 'Dallas-Fort Worth Metroplex', county: 'Collin', zips: ['75069'], localBlurb: 'Fairview preserves one-acre residential lots between Allen and McKinney, beside the Heard Natural Science Museum and Wildlife Sanctuary.' },
  { name: 'Lucas', slug: 'lucas', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 9000, medianIncome: 170000, tier: 1, region: 'Dallas-Fort Worth Metroplex', county: 'Collin', zips: ['75002'], localBlurb: 'Lucas is a large-lot equestrian community in eastern Collin County with some of the highest household incomes in Texas.' },
  { name: 'Murphy', slug: 'murphy', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 21000, medianIncome: 130000, tier: 2, region: 'Dallas-Fort Worth Metroplex', county: 'Collin', zips: ['75094'], localBlurb: 'Murphy is a compact, high-income suburb wedged between Plano and Wylie in the Collin County residential belt.' },
  { name: 'Wylie', slug: 'wylie', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 60000, medianIncome: 95000, tier: 3, region: 'Dallas-Fort Worth Metroplex', county: 'Collin', zips: ['75098'], localBlurb: 'Wylie has grown from a farm town into a commuter city set between Lavon Lake and Lake Ray Hubbard.' },
  { name: 'Southlake', slug: 'southlake', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 31000, medianIncome: 240000, tier: 1, region: 'Dallas-Fort Worth Metroplex', county: 'Tarrant', zips: ['76092'], localBlurb: 'Southlake is one of the highest income cities in Texas, anchored by the Town Square district and the Sabre corporate headquarters.' },
  { name: 'Colleyville', slug: 'colleyville', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 26000, medianIncome: 190000, tier: 1, region: 'Dallas-Fort Worth Metroplex', county: 'Tarrant', zips: ['76034'], localBlurb: 'Colleyville is an estate-lot enclave of northeast Tarrant County, minutes from the Grapevine and Hurst-Euless-Bedford hospital corridors.' },
  { name: 'Keller', slug: 'keller', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 46000, medianIncome: 135000, tier: 2, region: 'Dallas-Fort Worth Metroplex', county: 'Tarrant', zips: ['76248'], localBlurb: 'Keller pairs a top-ranked school district with quick access to the Alliance corridor, one of the largest inland logistics and corporate hubs in the country.' },
  { name: 'Grapevine', slug: 'grapevine', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 51000, medianIncome: 110000, tier: 2, region: 'Dallas-Fort Worth Metroplex', county: 'Tarrant', zips: ['76051'], localBlurb: 'Grapevine wraps the north entrance of DFW International Airport and is home to Baylor Scott and White Medical Center Grapevine and the GameStop headquarters.' },
  { name: 'Trophy Club', slug: 'trophy-club', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 13000, medianIncome: 160000, tier: 1, region: 'Dallas-Fort Worth Metroplex', county: 'Denton', zips: ['76262'], localBlurb: 'Trophy Club was the first master-planned community in Texas, built around its namesake country club north of DFW Airport.' },
  { name: 'Westlake', slug: 'westlake', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 1800, medianIncome: 250000, tier: 1, region: 'Dallas-Fort Worth Metroplex', county: 'Tarrant', zips: ['76262'], localBlurb: 'Westlake hosts the Charles Schwab corporate headquarters and a major Fidelity Investments campus, giving the small town an outsized corporate base.' },
  { name: 'Highland Park', slug: 'highland-park', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 9000, medianIncome: 220000, tier: 1, region: 'Dallas-Fort Worth Metroplex', county: 'Dallas', zips: ['75205'], localBlurb: 'Highland Park is one of the wealthiest municipalities in Texas, minutes from the UT Southwestern and Baylor University Medical Center campuses.' },
  { name: 'University Park', slug: 'university-park', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 25000, medianIncome: 200000, tier: 1, region: 'Dallas-Fort Worth Metroplex', county: 'Dallas', zips: ['75205', '75225'], localBlurb: 'University Park is built around Southern Methodist University and its research programs in the heart of the Park Cities.' },
  { name: 'Coppell', slug: 'coppell', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 42000, medianIncome: 130000, tier: 2, region: 'Dallas-Fort Worth Metroplex', county: 'Dallas', zips: ['75019'], localBlurb: 'Coppell sits at the northwest corner of Dallas County beside DFW Airport with one of the deepest corporate park bases in the region.' },
  { name: 'Irving', slug: 'irving', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 255000, medianIncome: 70000, tier: 2, region: 'Dallas-Fort Worth Metroplex', county: 'Dallas', zips: ['75038', '75039', '75062'], localBlurb: 'Irving\'s Las Colinas district hosts the McKesson healthcare headquarters and Baylor Scott and White Medical Center Irving.' },
  { name: 'Richardson', slug: 'richardson', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 120000, medianIncome: 85000, tier: 2, region: 'Dallas-Fort Worth Metroplex', county: 'Dallas', zips: ['75080', '75081', '75082'], localBlurb: 'Richardson\'s Telecom Corridor is home to the University of Texas at Dallas and hundreds of technology and engineering employers.' },
  { name: 'Addison', slug: 'addison', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 17000, medianIncome: 80000, tier: 2, region: 'Dallas-Fort Worth Metroplex', county: 'Dallas', zips: ['75001'], localBlurb: 'Addison packs one of the densest office and restaurant corridors in North Texas along the Dallas North Tollway.' },
  { name: 'Carrollton', slug: 'carrollton', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 135000, medianIncome: 80000, tier: 3, region: 'Dallas-Fort Worth Metroplex', county: 'Dallas', zips: ['75006', '75007', '75010'], localBlurb: 'Carrollton is a diverse inner-ring suburb served by Baylor Scott and White Medical Center Carrollton.' },
  { name: 'Lewisville', slug: 'lewisville', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 115000, medianIncome: 75000, tier: 3, region: 'Dallas-Fort Worth Metroplex', county: 'Denton', zips: ['75057', '75067'], localBlurb: 'Lewisville anchors southern Denton County with Medical City Lewisville and the Lake Lewisville waterfront.' },
  { name: 'Flower Mound', slug: 'flower-mound', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 79000, medianIncome: 150000, tier: 1, region: 'Dallas-Fort Worth Metroplex', county: 'Denton', zips: ['75022', '75028'], localBlurb: 'Flower Mound is a high-income Denton County suburb anchored by Texas Health Presbyterian Hospital Flower Mound.' },
  { name: 'Denton', slug: 'denton', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 150000, medianIncome: 60000, tier: 2, region: 'Dallas-Fort Worth Metroplex', county: 'Denton', zips: ['76201', '76205', '76210'], localBlurb: 'Denton is home to the University of North Texas and Texas Woman\'s University, two of the largest campuses in the northern Metroplex.' },
  { name: 'Argyle', slug: 'argyle', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 6000, medianIncome: 160000, tier: 1, region: 'Dallas-Fort Worth Metroplex', county: 'Denton', zips: ['76226'], localBlurb: 'Argyle is a ranch-estate community in the Cross Timbers corridor beside the affluent Lantana development.' },
  { name: 'Rockwall', slug: 'rockwall', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 50000, medianIncome: 105000, tier: 2, region: 'Dallas-Fort Worth Metroplex', county: 'Rockwall', zips: ['75032', '75087'], localBlurb: 'Rockwall overlooks Lake Ray Hubbard and is served by Texas Health Presbyterian Hospital Rockwall on the eastern edge of the Metroplex.' },
  { name: 'Heath', slug: 'heath', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 10000, medianIncome: 160000, tier: 1, region: 'Dallas-Fort Worth Metroplex', county: 'Rockwall', zips: ['75032'], localBlurb: 'Heath is a lakeside estate community on the eastern shore of Lake Ray Hubbard, one of the highest income small cities in North Texas.' },
  { name: 'Forney', slug: 'forney', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 28000, medianIncome: 95000, tier: 3, region: 'Dallas-Fort Worth Metroplex', county: 'Kaufman', zips: ['75126'], localBlurb: 'Forney is one of the fastest growing cities in Texas, anchoring the US 80 corridor east of Dallas.' },
  { name: 'Garland', slug: 'garland', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 245000, medianIncome: 60000, tier: 3, region: 'Dallas-Fort Worth Metroplex', county: 'Dallas', zips: ['75040', '75041', '75044'], localBlurb: 'Garland is one of the largest cities in Texas, spanning the northeast I-635 corridor between Richardson and Lake Ray Hubbard.' },
  { name: 'Mesquite', slug: 'mesquite', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 150000, medianIncome: 55000, tier: 3, region: 'Dallas-Fort Worth Metroplex', county: 'Dallas', zips: ['75149', '75150'], localBlurb: 'Mesquite anchors the eastern I-635 corridor and is served by Dallas Regional Medical Center.' },
  { name: 'Arlington', slug: 'arlington', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 395000, medianIncome: 63000, tier: 3, region: 'Dallas-Fort Worth Metroplex', county: 'Tarrant', zips: ['76010', '76012', '76013'], localBlurb: 'Arlington is home to the University of Texas at Arlington, a Carnegie R1 research university, and Texas Health Arlington Memorial Hospital.' },
  { name: 'Grand Prairie', slug: 'grand-prairie', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 200000, medianIncome: 65000, tier: 3, region: 'Dallas-Fort Worth Metroplex', county: 'Dallas', zips: ['75050', '75051', '75052'], localBlurb: 'Grand Prairie stretches between Dallas and Fort Worth with a major aerospace and defense base, including a large Lockheed Martin operation.' },
  { name: 'Mansfield', slug: 'mansfield', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 75000, medianIncome: 105000, tier: 2, region: 'Dallas-Fort Worth Metroplex', county: 'Tarrant', zips: ['76063'], localBlurb: 'Mansfield is served by Methodist Mansfield Medical Center on the fast-growing southeast side of Tarrant County.' },
  { name: 'North Richland Hills', slug: 'north-richland-hills', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 70000, medianIncome: 75000, tier: 3, region: 'Dallas-Fort Worth Metroplex', county: 'Tarrant', zips: ['76180', '76182'], localBlurb: 'North Richland Hills is anchored by Medical City North Hills hospital in the mid-cities corridor.' },
  { name: 'Bedford', slug: 'bedford', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 49000, medianIncome: 70000, tier: 3, region: 'Dallas-Fort Worth Metroplex', county: 'Tarrant', zips: ['76021', '76022'], localBlurb: 'Bedford hosts Texas Health Harris Methodist Hospital Hurst-Euless-Bedford, the primary acute care hospital of the mid-cities.' },
  { name: 'Weatherford', slug: 'weatherford', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 33000, medianIncome: 70000, tier: 3, region: 'Dallas-Fort Worth Metroplex', county: 'Parker', zips: ['76086', '76087'], localBlurb: 'Weatherford is the Parker County seat, served by Medical City Weatherford at the western gateway of the Metroplex.' },
  { name: 'Aledo', slug: 'aledo', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 5000, medianIncome: 120000, tier: 2, region: 'Dallas-Fort Worth Metroplex', county: 'Parker', zips: ['76008'], localBlurb: 'Aledo is a fast-growing Parker County community along the I-20 corridor west of Fort Worth, known for its championship school district.' },
  { name: 'Midlothian', slug: 'midlothian', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 40000, medianIncome: 100000, tier: 2, region: 'Dallas-Fort Worth Metroplex', county: 'Ellis', zips: ['76065'], localBlurb: 'Midlothian sits at the center of the Ellis County growth triangle, served by Methodist Midlothian Medical Center.' },
  { name: 'Waxahachie', slug: 'waxahachie', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 45000, medianIncome: 75000, tier: 3, region: 'Dallas-Fort Worth Metroplex', county: 'Ellis', zips: ['75165'], localBlurb: 'Waxahachie is the Ellis County seat, home to Baylor Scott and White Medical Center Waxahachie and Southwestern Assemblies of God University.' },

  // - Greater Houston -
  { name: 'Houston', slug: 'houston', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 2304000, medianIncome: 60000, tier: 1, region: 'Greater Houston', county: 'Harris', zips: ['77002', '77005', '77030'], localBlurb: 'Houston is home to the Texas Medical Center, the largest medical complex in the world, including MD Anderson Cancer Center, Baylor College of Medicine, and Houston Methodist.' },
  { name: 'The Woodlands', slug: 'the-woodlands', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 115000, medianIncome: 125000, tier: 1, region: 'Greater Houston', county: 'Montgomery', zips: ['77380', '77381', '77382'], localBlurb: 'The Woodlands is a master-planned township anchored by Houston Methodist The Woodlands Hospital and Memorial Hermann The Woodlands Medical Center.' },
  { name: 'Sugar Land', slug: 'sugar-land', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 110000, medianIncome: 125000, tier: 1, region: 'Greater Houston', county: 'Fort Bend', zips: ['77478', '77479'], localBlurb: 'Sugar Land is one of the most affluent large suburbs in Texas, anchored by Houston Methodist Sugar Land Hospital and the Town Square district.' },
  { name: 'Katy', slug: 'katy', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 25000, medianIncome: 95000, tier: 2, region: 'Greater Houston', county: 'Harris', zips: ['77449', '77450', '77494'], localBlurb: 'The Katy area is one of the largest master-planned suburban corridors in America, served by Houston Methodist West Hospital and Texas Children\'s Hospital West Campus.' },
  { name: 'Fulshear', slug: 'fulshear', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 47000, medianIncome: 165000, tier: 1, region: 'Greater Houston', county: 'Fort Bend', zips: ['77441'], localBlurb: 'Fulshear is the wealthiest fast-growth city in Fort Bend County, centered on the Cross Creek Ranch and Fulbrook communities.' },
  { name: 'Pearland', slug: 'pearland', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 130000, medianIncome: 95000, tier: 2, region: 'Greater Houston', county: 'Brazoria', zips: ['77581', '77584'], localBlurb: 'Pearland sits just south of the Texas Medical Center commute shed, served by HCA Houston Healthcare Pearland and Memorial Hermann Pearland Hospital.' },
  { name: 'Friendswood', slug: 'friendswood', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 42000, medianIncome: 120000, tier: 1, region: 'Greater Houston', county: 'Galveston', zips: ['77546'], localBlurb: 'Friendswood is a high-income community between Clear Lake and Pearland, minutes from the NASA Johnson Space Center research corridor.' },
  { name: 'League City', slug: 'league-city', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 115000, medianIncome: 110000, tier: 2, region: 'Greater Houston', county: 'Galveston', zips: ['77573'], localBlurb: 'League City is the largest city in Galveston County, anchored by the University of Texas Medical Branch League City Campus hospital.' },
  { name: 'Webster', slug: 'webster', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 12000, medianIncome: 60000, tier: 3, region: 'Greater Houston', county: 'Harris', zips: ['77598'], localBlurb: 'Webster packs a dense medical district around HCA Houston Healthcare Clear Lake, serving the NASA area communities.' },
  { name: 'Bellaire', slug: 'bellaire', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 19000, medianIncome: 180000, tier: 1, region: 'Greater Houston', county: 'Harris', zips: ['77401'], localBlurb: 'Bellaire is an independent city surrounded by Houston, minutes from the Texas Medical Center and the Rice University research campus.' },
  { name: 'West University Place', slug: 'west-university-place', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 15000, medianIncome: 250000, tier: 1, region: 'Greater Houston', county: 'Harris', zips: ['77005'], localBlurb: 'West University Place borders Rice University and sits closer to the Texas Medical Center than nearly any other independent city.' },
  { name: 'Piney Point Village', slug: 'piney-point-village', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 3300, medianIncome: 250000, tier: 1, region: 'Greater Houston', county: 'Harris', zips: ['77024'], localBlurb: 'Piney Point Village is among the wealthiest municipalities in Texas, at the heart of the Memorial Villages west of downtown Houston.' },
  { name: 'Cypress', slug: 'cypress', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 200000, medianIncome: 100000, tier: 2, region: 'Greater Houston', county: 'Harris', zips: ['77429', '77433'], localBlurb: 'Cypress is one of the largest master-planned corridors in the Houston area, served by the new Houston Methodist Cypress Hospital on US 290.' },
  { name: 'Tomball', slug: 'tomball', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 13000, medianIncome: 75000, tier: 3, region: 'Greater Houston', county: 'Harris', zips: ['77375'], localBlurb: 'Tomball is anchored by HCA Houston Healthcare Tomball on the fast-growing northwest side of the metro.' },
  { name: 'Spring', slug: 'spring', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 63000, medianIncome: 70000, tier: 3, region: 'Greater Houston', county: 'Harris', zips: ['77373', '77379', '77388'], localBlurb: 'Spring hosts the ExxonMobil corporate campus at Springwoods Village and a major HP Inc campus along the Grand Parkway.' },
  { name: 'Conroe', slug: 'conroe', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 105000, medianIncome: 65000, tier: 3, region: 'Greater Houston', county: 'Montgomery', zips: ['77301', '77304'], localBlurb: 'Conroe is the Montgomery County seat, served by HCA Houston Healthcare Conroe north of The Woodlands.' },
  { name: 'Missouri City', slug: 'missouri-city', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 75000, medianIncome: 95000, tier: 2, region: 'Greater Houston', county: 'Fort Bend', zips: ['77459'], localBlurb: 'Missouri City spans the Sienna and Riverstone master-planned communities in the heart of Fort Bend County.' },
  { name: 'Richmond', slug: 'richmond', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 12000, medianIncome: 70000, tier: 3, region: 'Greater Houston', county: 'Fort Bend', zips: ['77406', '77469'], localBlurb: 'Richmond is the historic Fort Bend County seat, anchored by OakBend Medical Center.' },
  { name: 'Baytown', slug: 'baytown', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 84000, medianIncome: 60000, tier: 3, region: 'Greater Houston', county: 'Harris', zips: ['77520', '77521'], localBlurb: 'Baytown is a major Gulf Coast industrial hub, served by Houston Methodist Baytown Hospital.' },
  { name: 'Galveston', slug: 'galveston', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 53000, medianIncome: 55000, tier: 2, region: 'Greater Houston', county: 'Galveston', zips: ['77550', '77551'], localBlurb: 'Galveston is home to the University of Texas Medical Branch, one of the oldest academic medical centers in the country and a major biomedical research campus.' },
  { name: 'Lake Jackson', slug: 'lake-jackson', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 28000, medianIncome: 80000, tier: 3, region: 'Greater Houston', county: 'Brazoria', zips: ['77566'], localBlurb: 'Lake Jackson anchors the Brazosport industrial corridor and serves as the home base for Dow Texas operations.' },

  // - Greater Austin -
  { name: 'Austin', slug: 'austin', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 979000, medianIncome: 86000, tier: 1, region: 'Greater Austin', county: 'Travis', zips: ['78701', '78704', '78705'], localBlurb: 'Austin is home to the University of Texas and its Dell Medical School, plus one of the densest biotech and life-science startup scenes in the South.' },
  { name: 'West Lake Hills', slug: 'west-lake-hills', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 3400, medianIncome: 240000, tier: 1, region: 'Greater Austin', county: 'Travis', zips: ['78746'], localBlurb: 'West Lake Hills is the most exclusive enclave on the west side of Austin, minutes from the downtown technology corridor.' },
  { name: 'Bee Cave', slug: 'bee-cave', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 9000, medianIncome: 170000, tier: 1, region: 'Greater Austin', county: 'Travis', zips: ['78738'], localBlurb: 'Bee Cave anchors the Hill Country Galleria corridor at the gateway to the Lake Travis communities.' },
  { name: 'Lakeway', slug: 'lakeway', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 20000, medianIncome: 135000, tier: 1, region: 'Greater Austin', county: 'Travis', zips: ['78734', '78738'], localBlurb: 'Lakeway is a Lake Travis resort city anchored by Baylor Scott and White Medical Center Lakeway.' },
  { name: 'Round Rock', slug: 'round-rock', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 130000, medianIncome: 95000, tier: 2, region: 'Greater Austin', county: 'Williamson', zips: ['78664', '78665', '78681'], localBlurb: 'Round Rock hosts the Dell Technologies headquarters and a hospital district that includes St. David\'s Round Rock Medical Center and a Texas A and M Health Science Center campus.' },
  { name: 'Cedar Park', slug: 'cedar-park', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 88000, medianIncome: 110000, tier: 2, region: 'Greater Austin', county: 'Williamson', zips: ['78613'], localBlurb: 'Cedar Park is served by Cedar Park Regional Medical Center at the heart of the fast-growing 183A technology corridor.' },
  { name: 'Leander', slug: 'leander', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 87000, medianIncome: 110000, tier: 2, region: 'Greater Austin', county: 'Williamson', zips: ['78641'], localBlurb: 'Leander has repeatedly ranked among the fastest growing cities in America along the 183A corridor north of Austin.' },
  { name: 'Georgetown', slug: 'georgetown', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 100000, medianIncome: 90000, tier: 2, region: 'Greater Austin', county: 'Williamson', zips: ['78626', '78628', '78633'], localBlurb: 'Georgetown is home to Southwestern University and St. David\'s Georgetown Hospital, anchoring the northern edge of the Austin metro.' },
  { name: 'Pflugerville', slug: 'pflugerville', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 65000, medianIncome: 95000, tier: 3, region: 'Greater Austin', county: 'Travis', zips: ['78660'], localBlurb: 'Pflugerville sits between Austin and Round Rock along the SH 130 corridor, one of the fastest growing employment belts in Central Texas.' },
  { name: 'Dripping Springs', slug: 'dripping-springs', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 7500, medianIncome: 130000, tier: 2, region: 'Greater Austin', county: 'Hays', zips: ['78620'], localBlurb: 'Dripping Springs is the gateway to the Hill Country wine and distillery corridor west of Austin, with rapid estate-community growth.' },
  { name: 'Kyle', slug: 'kyle', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 60000, medianIncome: 80000, tier: 3, region: 'Greater Austin', county: 'Hays', zips: ['78640'], localBlurb: 'Kyle is served by Ascension Seton Hays hospital, anchoring the I-35 growth corridor between Austin and San Marcos.' },
  { name: 'Buda', slug: 'buda', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 17000, medianIncome: 95000, tier: 3, region: 'Greater Austin', county: 'Hays', zips: ['78610'], localBlurb: 'Buda pairs a small-town Main Street with some of the fastest residential growth on the southern edge of the Austin metro.' },
  { name: 'San Marcos', slug: 'san-marcos', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 70000, medianIncome: 50000, tier: 3, region: 'Greater Austin', county: 'Hays', zips: ['78666'], localBlurb: 'San Marcos is home to Texas State University and its growing research programs along the San Marcos River.' },

  // - Greater San Antonio -
  { name: 'San Antonio', slug: 'san-antonio', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 1434000, medianIncome: 59000, tier: 1, region: 'Greater San Antonio', county: 'Bexar', zips: ['78205', '78209', '78229'], localBlurb: 'San Antonio is home to the South Texas Medical Center, UT Health San Antonio, and Southwest Research Institute, one of the largest independent research organizations in the nation.' },
  { name: 'Alamo Heights', slug: 'alamo-heights', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 7000, medianIncome: 120000, tier: 1, region: 'Greater San Antonio', county: 'Bexar', zips: ['78209'], localBlurb: 'Alamo Heights is an incorporated enclave beside the University of the Incarnate Word campus and the Quarry district.' },
  { name: 'Terrell Hills', slug: 'terrell-hills', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 5000, medianIncome: 150000, tier: 1, region: 'Greater San Antonio', county: 'Bexar', zips: ['78209'], localBlurb: 'Terrell Hills is one of the highest income municipalities in Bexar County, bordered by Fort Sam Houston and its Brooke Army Medical Center complex.' },
  { name: 'Shavano Park', slug: 'shavano-park', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 3800, medianIncome: 180000, tier: 1, region: 'Greater San Antonio', county: 'Bexar', zips: ['78231'], localBlurb: 'Shavano Park is a wooded enclave beside the South Texas Medical Center and the UTSA main campus corridor.' },
  { name: 'Boerne', slug: 'boerne', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 21000, medianIncome: 100000, tier: 1, region: 'Greater San Antonio', county: 'Kendall', zips: ['78006', '78015'], localBlurb: 'Boerne is the Kendall County seat in the Texas Hill Country, along the fast-growing I-10 medical corridor into northwest San Antonio.' },
  { name: 'Fair Oaks Ranch', slug: 'fair-oaks-ranch', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 11000, medianIncome: 160000, tier: 1, region: 'Greater San Antonio', county: 'Bexar', zips: ['78015'], localBlurb: 'Fair Oaks Ranch is a golf-course estate community on the Hill Country side of the San Antonio metro, among the wealthiest small cities in South Texas.' },
  { name: 'New Braunfels', slug: 'new-braunfels', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 105000, medianIncome: 80000, tier: 2, region: 'Greater San Antonio', county: 'Comal', zips: ['78130', '78132'], localBlurb: 'New Braunfels is one of the fastest growing cities in America, served by Christus Santa Rosa Hospital New Braunfels and Resolute Health Hospital.' },
  { name: 'Schertz', slug: 'schertz', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 45000, medianIncome: 85000, tier: 3, region: 'Greater San Antonio', county: 'Guadalupe', zips: ['78154'], localBlurb: 'Schertz sits along the I-35 corridor northeast of San Antonio beside Randolph Air Force Base.' },
  { name: 'Cibolo', slug: 'cibolo', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 35000, medianIncome: 100000, tier: 3, region: 'Greater San Antonio', county: 'Guadalupe', zips: ['78108'], localBlurb: 'Cibolo is a high-growth Guadalupe County suburb in the northeast San Antonio commuter belt.' },
  { name: 'Helotes', slug: 'helotes', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 9000, medianIncome: 110000, tier: 2, region: 'Greater San Antonio', county: 'Bexar', zips: ['78023'], localBlurb: 'Helotes sits at the edge of the Hill Country near the UTSA and South Texas Medical Center corridors of northwest San Antonio.' },

  // - Central Texas -
  { name: 'Waco', slug: 'waco', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 140000, medianIncome: 45000, tier: 3, region: 'Central Texas', county: 'McLennan', zips: ['76701', '76706', '76710'], localBlurb: 'Waco is home to Baylor University and its research campus, plus the Ascension Providence and Baylor Scott and White Hillcrest medical centers.' },
  { name: 'Temple', slug: 'temple', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 90000, medianIncome: 60000, tier: 3, region: 'Central Texas', county: 'Bell', zips: ['76502', '76508'], localBlurb: 'Temple is anchored by the flagship Baylor Scott and White Medical Center Temple and a Texas A and M University College of Medicine campus.' },
  { name: 'College Station', slug: 'college-station', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 125000, medianIncome: 50000, tier: 2, region: 'Central Texas', county: 'Brazos', zips: ['77840', '77845'], localBlurb: 'College Station is home to Texas A and M University, one of the largest research universities in the country.' },
  { name: 'Bryan', slug: 'bryan', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 87000, medianIncome: 50000, tier: 3, region: 'Central Texas', county: 'Brazos', zips: ['77802', '77803'], localBlurb: 'Bryan hosts the Texas A and M Health Science Center campus and the St. Joseph Health regional hospital.' },

  // - East Texas And Coastal Bend -
  { name: 'Tyler', slug: 'tyler', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 108000, medianIncome: 55000, tier: 3, region: 'East Texas', county: 'Smith', zips: ['75701', '75703'], localBlurb: 'Tyler is the medical hub of East Texas, home to the UT Tyler Health Science Center and the Christus Trinity Mother Frances and UT Health East Texas systems.' },
  { name: 'Corpus Christi', slug: 'corpus-christi', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 317000, medianIncome: 58000, tier: 3, region: 'Coastal Bend', county: 'Nueces', zips: ['78401', '78411', '78414'], localBlurb: 'Corpus Christi is served by Christus Spohn Hospital Shoreline and Texas A and M University Corpus Christi on the Gulf coast.' },

  // - West Texas -
  { name: 'El Paso', slug: 'el-paso', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 678000, medianIncome: 50000, tier: 3, region: 'West Texas', county: 'El Paso', zips: ['79901', '79912', '79936'], localBlurb: 'El Paso is home to Texas Tech University Health Sciences Center El Paso and its Paul L. Foster School of Medicine.' },
  { name: 'Lubbock', slug: 'lubbock', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 260000, medianIncome: 55000, tier: 3, region: 'West Texas', county: 'Lubbock', zips: ['79401', '79410', '79424'], localBlurb: 'Lubbock is anchored by Texas Tech University and the Texas Tech University Health Sciences Center, the research hub of the South Plains.' },
  { name: 'Midland', slug: 'midland', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 135000, medianIncome: 85000, tier: 2, region: 'West Texas', county: 'Midland', zips: ['79701', '79705'], localBlurb: 'Midland is the corporate capital of the Permian Basin energy industry, with among the highest median incomes in Texas.' },
  { name: 'Odessa', slug: 'odessa', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 115000, medianIncome: 60000, tier: 3, region: 'West Texas', county: 'Ector', zips: ['79761', '79762'], localBlurb: 'Odessa hosts Medical Center Hospital and a Texas Tech University Health Sciences Center Permian Basin campus.' },
  { name: 'Amarillo', slug: 'amarillo', state: 'Texas', stateSlug: 'texas', stateAbbr: 'TX', population: 200000, medianIncome: 55000, tier: 3, region: 'West Texas', county: 'Potter', zips: ['79101', '79106'], localBlurb: 'Amarillo anchors the Panhandle medical corridor with the BSA Health System and a Texas Tech University Health Sciences Center campus.' },

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
    localBlurb: 'From the historic architecture along Cermak Road to the vibrant industrial parks, Pep Nation Lab provides Cicero research professionals with rapid access to 99%+ pure research peptides. Our secure fulfillment network ensures next-day processing for critical in vitro studies across Cook County.'
  },
  {
    name: 'Waukegan', slug: 'waukegan', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 87000, medianIncome: 60000, tier: 2, region: 'Chicagoland area', county: 'Lake',
    localBlurb: 'Supporting the scientific community near the Lake County medical and bioscience corridor, Pep Nation Lab delivers third-party tested research peptides to Waukegan. Whether conducting trials near the harbor district or inland labs, researchers trust our verifiable COAs and consistent wholesale pricing.'
  },
  {
    name: 'DeKalb', slug: 'dekalb', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 40000, medianIncome: 45000, tier: 3, region: 'Northern Illinois', county: 'DeKalb',
    localBlurb: 'Home to major academic and agricultural research institutions, DeKalb relies on Pep Nation Lab for premium analytical compounds. We supply Northern Illinois University affiliates and independent investigators with strictly regulated, high-purity peptides for advanced structural and binding assays.'
  },
  {
    name: 'Urbana', slug: 'urbana', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 38000, medianIncome: 50000, tier: 3, region: 'Central Illinois', county: 'Champaign',
    localBlurb: 'As a global hub for scientific innovation and home to leading research parks, Urbana demands uncompromising quality. Pep Nation Lab provides Urbana researchers with lyophilized, synthesis-verified peptides perfectly suited for the rigorous analytical environments of the Silicon Prairie.'
  },
  {
    name: 'Quincy', slug: 'quincy', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 40000, medianIncome: 52000, tier: 3, region: 'Central Illinois', county: 'Adams',
    localBlurb: 'Serving the "Gem City" and the broader Tri-State area, Pep Nation Lab is Quincy’s premier source for research peptides. We offer fast, discreet shipping along the Mississippi corridor, equipping local scientific teams with the reference materials needed for complex cellular research.'
  },
  {
    name: 'Rock Island', slug: 'rock-island', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 37000, medianIncome: 50000, tier: 3, region: 'Quad Cities', county: 'Rock Island',
    localBlurb: 'Nestled in the Quad Cities, Rock Island’s clinical and environmental researchers trust Pep Nation Lab for domestic, USA-verified compounds. From the Arsenal district to Augustana’s academic labs, we provide BPC-157, TB-500, and more with guaranteed mass spectroscopy reports.'
  },
  {
    name: 'Carbondale', slug: 'carbondale', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 21000, medianIncome: 30000, tier: 3, region: 'Southern Illinois', county: 'Jackson',
    localBlurb: 'As the educational and medical center of Little Egypt, Carbondale is a key hub for physiological research. Pep Nation Lab supplies investigators across the SIU corridor with premium research peptides, backed by transparent NMR testing for demanding in vitro applications.'
  },
  {
    name: 'Macomb', slug: 'macomb', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 15000, medianIncome: 35000, tier: 3, region: 'Western Illinois', county: 'McDonough',
    localBlurb: 'Serving the academic and scientific communities of McDonough County, Pep Nation Lab is Macomb’s reliable supplier for research-grade peptides. We streamline procurement for Western Illinois University labs and private clinics conducting localized cellular receptor studies.'
  },
  {
    name: 'Alton', slug: 'alton', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 25000, medianIncome: 45000, tier: 3, region: 'Metro East', county: 'Madison',
    localBlurb: 'Located along the historic Mississippi River bluffs, Alton’s medical and research facilities depend on Pep Nation Lab for fast, secure compound delivery. We provide the Riverbend region with third-party tested peptides designed explicitly for high-precision analytical research.'
  },
  {
    name: 'Galesburg', slug: 'galesburg', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 30000, medianIncome: 40000, tier: 3, region: 'Western Illinois', county: 'Knox',
    localBlurb: 'From the Knox College campus to the thriving local medical districts, Galesburg researchers choose Pep Nation Lab for unparalleled peptide purity. Our strict US-based fulfillment ensures your lab receives stable, properly stored compounds ready for immediate reconstitution.'
  },
  {
    name: 'Marion', slug: 'marion', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 16000, medianIncome: 45000, tier: 3, region: 'Southern Illinois', county: 'Williamson',
    localBlurb: 'As the retail and medical hub of Southern Illinois, Marion’s scientific investigators require dependable access to research chemicals. Pep Nation Lab offers Marion labs wholesale access to Semaglutide, Tirzepatide, and other peptides with verifiable certificates of analysis.'
  },
  {
    name: 'Mount Vernon', slug: 'mount-vernon', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 14000, medianIncome: 48000, tier: 3, region: 'Southern Illinois', county: 'Jefferson',
    localBlurb: 'Situated at the crossroads of Southern Illinois, Mount Vernon is a strategic center for regional healthcare and bio-research. Pep Nation Lab equips Jefferson County facilities with research-grade peptides, guaranteeing fast logistics and uncompromising batch purity.'
  },
  {
    name: 'Effingham', slug: 'effingham', state: 'Illinois', stateSlug: 'illinois', stateAbbr: 'IL',
    population: 12000, medianIncome: 55000, tier: 3, region: 'Central Illinois', county: 'Effingham',
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
