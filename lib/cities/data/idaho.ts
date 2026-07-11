import type { City } from '../cities-data';

// Idaho — 9 cities
const CITIES_IDAHO: City[] = [
  { name: 'Boise', slug: 'boise', state: 'Idaho', stateSlug: 'idaho', stateAbbr: 'ID', population: 236000, medianIncome: 70000, tier: 2, region: 'Treasure Valley', county: 'Ada', zips: ['83702', '83706', '83712'], localBlurb: 'Boise is anchored by St. Luke\'s Boise Medical Center, Idaho\'s largest hospital, and Boise State University.' },
  { name: 'Meridian', slug: 'meridian', state: 'Idaho', stateSlug: 'idaho', stateAbbr: 'ID', population: 118000, medianIncome: 80000, tier: 2, region: 'Treasure Valley', county: 'Ada', zips: ['83642', '83646'], localBlurb: 'Meridian hosts St. Luke\'s Meridian Medical Center in the fastest-growing city in Idaho.' },
  { name: 'Eagle', slug: 'eagle', state: 'Idaho', stateSlug: 'idaho', stateAbbr: 'ID', population: 32000, medianIncome: 105000, tier: 1, region: 'Treasure Valley', county: 'Ada', zips: ['83616'], localBlurb: 'Eagle is the Treasure Valley\'s wealthiest suburb, in the Boise foothills near the St. Luke\'s and Saint Alphonsus networks.' },
  { name: 'Nampa', slug: 'nampa', state: 'Idaho', stateSlug: 'idaho', stateAbbr: 'ID', population: 101000, medianIncome: 60000, tier: 3, region: 'Treasure Valley', county: 'Canyon', zips: ['83651', '83686'], localBlurb: 'Nampa is served by Saint Alphonsus Medical Center Nampa in the western Treasure Valley.' },
  { name: 'Coeur d\'Alene', slug: 'coeur-dalene', state: 'Idaho', stateSlug: 'idaho', stateAbbr: 'ID', population: 56000, medianIncome: 62000, tier: 2, region: 'North Idaho', county: 'Kootenai', zips: ['83814', '83815'], localBlurb: 'Coeur d\'Alene is home to Kootenai Health, the largest medical center in North Idaho.' },
  { name: 'Idaho Falls', slug: 'idaho-falls', state: 'Idaho', stateSlug: 'idaho', stateAbbr: 'ID', population: 65000, medianIncome: 62000, tier: 3, region: 'Eastern Idaho', county: 'Bonneville', zips: ['83402', '83404'], localBlurb: 'Idaho Falls neighbors the Idaho National Laboratory and is anchored by Eastern Idaho Regional Medical Center.' },
  { name: 'Pocatello', slug: 'pocatello', state: 'Idaho', stateSlug: 'idaho', stateAbbr: 'ID', population: 57000, medianIncome: 52000, tier: 3, region: 'Eastern Idaho', county: 'Bannock', zips: ['83201', '83204'], localBlurb: 'Pocatello hosts Idaho State University and its Kasiska Division of Health Sciences.' },
  { name: 'Twin Falls', slug: 'twin-falls', state: 'Idaho', stateSlug: 'idaho', stateAbbr: 'ID', population: 52000, medianIncome: 55000, tier: 3, region: 'Magic Valley', county: 'Twin Falls', zips: ['83301'], localBlurb: 'Twin Falls is anchored by St. Luke\'s Magic Valley Medical Center above the Snake River Canyon.' },
  { name: 'Moscow', slug: 'moscow', state: 'Idaho', stateSlug: 'idaho', stateAbbr: 'ID', population: 26000, medianIncome: 50000, tier: 3, region: 'North Idaho', county: 'Latah', zips: ['83843'], localBlurb: 'Moscow is home to the University of Idaho, the state\'s land-grant research university.' },
];

export default CITIES_IDAHO;
