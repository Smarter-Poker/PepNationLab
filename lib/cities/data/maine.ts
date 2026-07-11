import type { City } from '../cities-data';

// Maine — 8 cities
const CITIES_MAINE: City[] = [
  { name: 'Portland', slug: 'portland', state: 'Maine', stateSlug: 'maine', stateAbbr: 'ME', population: 68000, medianIncome: 66000, tier: 2, region: 'Greater Portland', county: 'Cumberland', zips: ['04101', '04102', '04103'], localBlurb: 'Portland is home to Maine Medical Center, the state\'s largest hospital and a major teaching campus.' },
  { name: 'Falmouth', slug: 'falmouth', state: 'Maine', stateSlug: 'maine', stateAbbr: 'ME', population: 12500, medianIncome: 120000, tier: 1, region: 'Greater Portland', county: 'Cumberland', zips: ['04105'], localBlurb: 'Falmouth\'s Foreside neighborhoods make it one of Maine\'s wealthiest coastal towns, just north of Portland\'s medical district.' },
  { name: 'Cape Elizabeth', slug: 'cape-elizabeth', state: 'Maine', stateSlug: 'maine', stateAbbr: 'ME', population: 9500, medianIncome: 130000, tier: 1, region: 'Greater Portland', county: 'Cumberland', zips: ['04107'], localBlurb: 'Cape Elizabeth pairs Portland Head Light\'s coastline with one of Maine\'s highest household incomes.' },
  { name: 'Scarborough', slug: 'scarborough', state: 'Maine', stateSlug: 'maine', stateAbbr: 'ME', population: 22000, medianIncome: 95000, tier: 2, region: 'Greater Portland', county: 'Cumberland', zips: ['04074'], localBlurb: 'Scarborough hosts the MaineHealth Institute for Research, the state\'s largest biomedical research facility.' },
  { name: 'South Portland', slug: 'south-portland', state: 'Maine', stateSlug: 'maine', stateAbbr: 'ME', population: 26000, medianIncome: 68000, tier: 3, region: 'Greater Portland', county: 'Cumberland', zips: ['04106'], localBlurb: 'South Portland sits across the Fore River from Maine\'s largest medical campus along the Maine Mall corridor.' },
  { name: 'Bangor', slug: 'bangor', state: 'Maine', stateSlug: 'maine', stateAbbr: 'ME', population: 32000, medianIncome: 50000, tier: 3, region: 'Greater Bangor', county: 'Penobscot', zips: ['04401'], localBlurb: 'Bangor is anchored by Northern Light Eastern Maine Medical Center, the referral hub for northern Maine.' },
  { name: 'Orono', slug: 'orono', state: 'Maine', stateSlug: 'maine', stateAbbr: 'ME', population: 11000, medianIncome: 48000, tier: 3, region: 'Greater Bangor', county: 'Penobscot', zips: ['04473'], localBlurb: 'Orono is home to the University of Maine, the state\'s flagship research university.' },
  { name: 'Augusta', slug: 'augusta', state: 'Maine', stateSlug: 'maine', stateAbbr: 'ME', population: 19000, medianIncome: 50000, tier: 3, region: 'Central Maine', county: 'Kennebec', zips: ['04330'], localBlurb: 'Augusta, the state capital, is served by MaineGeneral\'s Alfond Center for Health.' },
];

export default CITIES_MAINE;
