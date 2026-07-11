import type { City } from '../cities-data';

// Ohio - 31 cities (Columbus + Cleveland + Cincinnati metros + statewide)
const CITIES_OHIO: City[] = [
  { name: 'New Albany', slug: 'new-albany', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 11000, medianIncome: 140000, tier: 1, region: 'Greater Columbus', county: 'Franklin', zips: ['43054'], localBlurb: 'New Albany research groups source our high-purity peptides for longevity and recovery studies backed by full third-party COAs.' },
  { name: 'Upper Arlington', slug: 'upper-arlington', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 36000, medianIncome: 130000, tier: 1, region: 'Greater Columbus', county: 'Franklin', zips: ['43221'], localBlurb: 'Upper Arlington laboratories rely on our lot-traceable compounds and comprehensive certificates of analysis.' },
  { name: 'Powell', slug: 'powell', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 14000, medianIncome: 155000, tier: 1, region: 'Greater Columbus', county: 'Delaware', zips: ['43065'], localBlurb: 'Powell research professionals choose our peptides for guaranteed purity, cold-chain handling, and full lot documentation.' },
  { name: 'Dublin', slug: 'dublin', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 50000, medianIncome: 105000, tier: 2, region: 'Greater Columbus', county: 'Franklin', zips: ['43016', '43017'] },
  { name: 'Westerville', slug: 'westerville', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 41000, medianIncome: 82000, tier: 2, region: 'Greater Columbus', county: 'Franklin', zips: ['43081', '43082'] },
  { name: 'Worthington', slug: 'worthington', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 15000, medianIncome: 92000, tier: 2, region: 'Greater Columbus', county: 'Franklin', zips: ['43085'] },
  { name: 'Hilliard', slug: 'hilliard', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 38000, medianIncome: 85000, tier: 2, region: 'Greater Columbus', county: 'Franklin', zips: ['43026'] },
  { name: 'Gahanna', slug: 'gahanna', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 35000, medianIncome: 80000, tier: 2, region: 'Greater Columbus', county: 'Franklin', zips: ['43230'] },
  { name: 'Grove City', slug: 'grove-city', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 41000, medianIncome: 72000, tier: 3, region: 'Greater Columbus', county: 'Franklin', zips: ['43123'] },
  { name: 'Columbus', slug: 'columbus', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 905000, medianIncome: 58000, tier: 2, region: 'Greater Columbus', county: 'Franklin', zips: ['43215', '43220', '43214'] },
  { name: 'Beachwood', slug: 'beachwood', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 13000, medianIncome: 105000, tier: 1, region: 'Greater Cleveland', county: 'Cuyahoga', zips: ['44122'], localBlurb: 'Beachwood laboratories in Greater Cleveland trust our verified purity and transparent documentation on every peptide lot.' },
  { name: 'Shaker Heights', slug: 'shaker-heights', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 29000, medianIncome: 90000, tier: 2, region: 'Greater Cleveland', county: 'Cuyahoga', zips: ['44120'] },
  { name: 'Westlake', slug: 'westlake', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 34000, medianIncome: 92000, tier: 2, region: 'Greater Cleveland', county: 'Cuyahoga', zips: ['44145'] },
  { name: 'Rocky River', slug: 'rocky-river', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 21000, medianIncome: 88000, tier: 2, region: 'Greater Cleveland', county: 'Cuyahoga', zips: ['44116'] },
  { name: 'Solon', slug: 'solon', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 24000, medianIncome: 118000, tier: 2, region: 'Greater Cleveland', county: 'Cuyahoga', zips: ['44139'] },
  { name: 'Strongsville', slug: 'strongsville', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 46000, medianIncome: 84000, tier: 3, region: 'Greater Cleveland', county: 'Cuyahoga', zips: ['44136'] },
  { name: 'Cleveland', slug: 'cleveland', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 372000, medianIncome: 35000, tier: 3, region: 'Greater Cleveland', county: 'Cuyahoga', zips: ['44113', '44114', '44115'] },
  { name: 'Akron', slug: 'akron', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 190000, medianIncome: 42000, tier: 3, region: 'Northeast Ohio', county: 'Summit', zips: ['44303', '44311'] },
  { name: 'Canton', slug: 'canton', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 70000, medianIncome: 36000, tier: 3, region: 'Northeast Ohio', county: 'Stark', zips: ['44708', '44718'] },
  { name: 'Mason', slug: 'mason', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 34000, medianIncome: 118000, tier: 1, region: 'Greater Cincinnati', county: 'Warren', zips: ['45040'], localBlurb: 'Mason research groups north of Cincinnati select our high-purity compounds for metabolic and tissue-repair investigations.' },
  { name: 'Montgomery', slug: 'montgomery', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 11000, medianIncome: 135000, tier: 1, region: 'Greater Cincinnati', county: 'Hamilton', zips: ['45242'], localBlurb: 'Montgomery laboratories rely on our documented, lot-traceable peptides for reproducible research protocols.' },
  { name: 'Blue Ash', slug: 'blue-ash', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 13000, medianIncome: 90000, tier: 2, region: 'Greater Cincinnati', county: 'Hamilton', zips: ['45242'] },
  { name: 'West Chester', slug: 'west-chester', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 63000, medianIncome: 95000, tier: 2, region: 'Greater Cincinnati', county: 'Butler', zips: ['45069'] },
  { name: 'Loveland', slug: 'loveland', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 13000, medianIncome: 92000, tier: 2, region: 'Greater Cincinnati', county: 'Hamilton', zips: ['45140'] },
  { name: 'Cincinnati', slug: 'cincinnati', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 309000, medianIncome: 45000, tier: 3, region: 'Greater Cincinnati', county: 'Hamilton', zips: ['45202', '45208', '45219'] },
  { name: 'Dayton', slug: 'dayton', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 137000, medianIncome: 38000, tier: 3, region: 'Miami Valley', county: 'Montgomery', zips: ['45402', '45409'] },
  { name: 'Toledo', slug: 'toledo', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 270000, medianIncome: 40000, tier: 3, region: 'Northwest Ohio', county: 'Lucas', zips: ['43604', '43606'] },
  { name: 'Youngstown', slug: 'youngstown', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 60000, medianIncome: 32000, tier: 3, region: 'Mahoning Valley', county: 'Mahoning', zips: ['44503', '44512'] },
  { name: 'Delaware', slug: 'delaware', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 42000, medianIncome: 78000, tier: 3, region: 'Greater Columbus', county: 'Delaware', zips: ['43015'] },
  { name: 'Pickerington', slug: 'pickerington', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 24000, medianIncome: 98000, tier: 2, region: 'Greater Columbus', county: 'Fairfield', zips: ['43147'] },
  { name: 'Kettering', slug: 'kettering', state: 'Ohio', stateSlug: 'ohio', stateAbbr: 'OH', population: 58000, medianIncome: 62000, tier: 3, region: 'Miami Valley', county: 'Montgomery', zips: ['45409', '45429'] },
];

export default CITIES_OHIO;
