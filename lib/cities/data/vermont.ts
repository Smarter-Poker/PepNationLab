import type { City } from '../cities-data';

// Vermont - 6 cities
const CITIES_VERMONT: City[] = [
  { name: 'Burlington', slug: 'burlington', state: 'Vermont', stateSlug: 'vermont', stateAbbr: 'VT', population: 44000, medianIncome: 60000, tier: 2, region: 'Greater Burlington', county: 'Chittenden', zips: ['05401', '05408'], localBlurb: 'Burlington is home to the University of Vermont Medical Center, the state\'s academic health campus.' },
  { name: 'South Burlington', slug: 'south-burlington', state: 'Vermont', stateSlug: 'vermont', stateAbbr: 'VT', population: 20000, medianIncome: 78000, tier: 2, region: 'Greater Burlington', county: 'Chittenden', zips: ['05403'], localBlurb: 'South Burlington hosts the University of Vermont Medical Center\'s Tilley Drive outpatient campus.' },
  { name: 'Shelburne', slug: 'shelburne', state: 'Vermont', stateSlug: 'vermont', stateAbbr: 'VT', population: 7800, medianIncome: 105000, tier: 1, region: 'Greater Burlington', county: 'Chittenden', zips: ['05482'], localBlurb: 'Shelburne is an affluent lakeshore town south of Burlington\'s university research district.' },
  { name: 'Stowe', slug: 'stowe', state: 'Vermont', stateSlug: 'vermont', stateAbbr: 'VT', population: 5200, medianIncome: 90000, tier: 1, region: 'Northern Vermont', county: 'Lamoille', zips: ['05672'], localBlurb: 'Stowe\'s resort community is served by Copley Hospital in neighboring Morrisville.' },
  { name: 'Montpelier', slug: 'montpelier', state: 'Vermont', stateSlug: 'vermont', stateAbbr: 'VT', population: 8000, medianIncome: 65000, tier: 3, region: 'Central Vermont', county: 'Washington', zips: ['05602'], localBlurb: 'Montpelier, the nation\'s smallest state capital, is served by Central Vermont Medical Center in nearby Berlin.' },
  { name: 'Norwich', slug: 'norwich', state: 'Vermont', stateSlug: 'vermont', stateAbbr: 'VT', population: 3600, medianIncome: 120000, tier: 1, region: 'Upper Valley', county: 'Windsor', zips: ['05055'], localBlurb: 'Norwich sits across the Connecticut River from Dartmouth College, minutes from Dartmouth Hitchcock Medical Center.' },
];

export default CITIES_VERMONT;
