import type { City } from '../cities-data';

// Wyoming - 7 cities
const CITIES_WYOMING: City[] = [
  { name: 'Jackson', slug: 'jackson', state: 'Wyoming', stateSlug: 'wyoming', stateAbbr: 'WY', population: 11000, medianIncome: 105000, tier: 1, region: 'Jackson Hole', county: 'Teton', zips: ['83001'], localBlurb: 'Jackson anchors Teton County, the wealthiest county in America, and is served by St. John\'s Health.' },
  { name: 'Cheyenne', slug: 'cheyenne', state: 'Wyoming', stateSlug: 'wyoming', stateAbbr: 'WY', population: 65000, medianIncome: 65000, tier: 3, region: 'Southeast Wyoming', county: 'Laramie', zips: ['82001', '82009'], localBlurb: 'Cheyenne, the state capital, is anchored by Cheyenne Regional Medical Center.' },
  { name: 'Casper', slug: 'casper', state: 'Wyoming', stateSlug: 'wyoming', stateAbbr: 'WY', population: 59000, medianIncome: 62000, tier: 3, region: 'Central Wyoming', county: 'Natrona', zips: ['82601', '82609'], localBlurb: 'Casper is served by Banner Wyoming Medical Center, the state\'s largest hospital.' },
  { name: 'Laramie', slug: 'laramie', state: 'Wyoming', stateSlug: 'wyoming', stateAbbr: 'WY', population: 32000, medianIncome: 50000, tier: 3, region: 'Southeast Wyoming', county: 'Albany', zips: ['82070', '82072'], localBlurb: 'Laramie is home to the University of Wyoming, the state\'s only public university.' },
  { name: 'Gillette', slug: 'gillette', state: 'Wyoming', stateSlug: 'wyoming', stateAbbr: 'WY', population: 33000, medianIncome: 80000, tier: 3, region: 'Powder River Basin', county: 'Campbell', zips: ['82716', '82718'], localBlurb: 'Gillette pairs some of the nation\'s highest energy-sector wages with the Campbell County Health medical campus.' },
  { name: 'Cody', slug: 'cody', state: 'Wyoming', stateSlug: 'wyoming', stateAbbr: 'WY', population: 10000, medianIncome: 60000, tier: 3, region: 'Bighorn Basin', county: 'Park', zips: ['82414'], localBlurb: 'Cody is anchored by Cody Regional Health at the eastern gateway to Yellowstone.' },
  { name: 'Sheridan', slug: 'sheridan', state: 'Wyoming', stateSlug: 'wyoming', stateAbbr: 'WY', population: 19000, medianIncome: 58000, tier: 3, region: 'Northern Wyoming', county: 'Sheridan', zips: ['82801'], localBlurb: 'Sheridan is served by Sheridan Memorial Hospital at the foot of the Bighorn Mountains.' },
];

export default CITIES_WYOMING;
