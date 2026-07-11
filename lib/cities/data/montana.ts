import type { City } from '../cities-data';

// Montana — 8 cities
const CITIES_MONTANA: City[] = [
  { name: 'Billings', slug: 'billings', state: 'Montana', stateSlug: 'montana', stateAbbr: 'MT', population: 118000, medianIncome: 62000, tier: 3, region: 'Yellowstone Valley', county: 'Yellowstone', zips: ['59101', '59102'], localBlurb: 'Billings is anchored by Billings Clinic, Montana\'s largest health system and research center.' },
  { name: 'Bozeman', slug: 'bozeman', state: 'Montana', stateSlug: 'montana', stateAbbr: 'MT', population: 56000, medianIncome: 75000, tier: 2, region: 'Gallatin Valley', county: 'Gallatin', zips: ['59715', '59718'], localBlurb: 'Bozeman hosts Montana State University and Bozeman Health\'s Deaconess Regional Medical Center.' },
  { name: 'Big Sky', slug: 'big-sky', state: 'Montana', stateSlug: 'montana', stateAbbr: 'MT', population: 3600, medianIncome: 105000, tier: 1, region: 'Gallatin Valley', county: 'Gallatin', zips: ['59716'], localBlurb: 'Big Sky\'s resort community is served by the Bozeman Health Big Sky Medical Center.' },
  { name: 'Missoula', slug: 'missoula', state: 'Montana', stateSlug: 'montana', stateAbbr: 'MT', population: 75000, medianIncome: 57000, tier: 3, region: 'Greater Missoula', county: 'Missoula', zips: ['59801', '59802'], localBlurb: 'Missoula is home to the University of Montana and Providence St. Patrick Hospital.' },
  { name: 'Helena', slug: 'helena', state: 'Montana', stateSlug: 'montana', stateAbbr: 'MT', population: 34000, medianIncome: 65000, tier: 3, region: 'Helena Valley', county: 'Lewis and Clark', zips: ['59601'], localBlurb: 'Helena, the state capital, is anchored by St. Peter\'s Health regional medical center.' },
  { name: 'Great Falls', slug: 'great-falls', state: 'Montana', stateSlug: 'montana', stateAbbr: 'MT', population: 60000, medianIncome: 52000, tier: 3, region: 'Central Montana', county: 'Cascade', zips: ['59401', '59405'], localBlurb: 'Great Falls is served by Benefis Health System, one of Montana\'s largest hospitals.' },
  { name: 'Kalispell', slug: 'kalispell', state: 'Montana', stateSlug: 'montana', stateAbbr: 'MT', population: 26000, medianIncome: 55000, tier: 3, region: 'Flathead Valley', county: 'Flathead', zips: ['59901'], localBlurb: 'Kalispell is anchored by Logan Health Medical Center, the referral hub for northwest Montana.' },
  { name: 'Whitefish', slug: 'whitefish', state: 'Montana', stateSlug: 'montana', stateAbbr: 'MT', population: 8000, medianIncome: 80000, tier: 2, region: 'Flathead Valley', county: 'Flathead', zips: ['59937'], localBlurb: 'Whitefish pairs its resort economy with the Logan Health Whitefish hospital campus near Glacier National Park.' },
];

export default CITIES_MONTANA;
