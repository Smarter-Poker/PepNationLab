import type { City } from '../cities-data';

// West Virginia - 6 cities
const CITIES_WEST_VIRGINIA: City[] = [
  { name: 'Morgantown', slug: 'morgantown', state: 'West Virginia', stateSlug: 'west-virginia', stateAbbr: 'WV', population: 30000, medianIncome: 45000, tier: 2, region: 'North Central West Virginia', county: 'Monongalia', zips: ['26505', '26508'], localBlurb: 'Morgantown is home to WVU Medicine\'s J.W. Ruby Memorial Hospital and the Rockefeller Neuroscience Institute.' },
  { name: 'Charleston', slug: 'charleston', state: 'West Virginia', stateSlug: 'west-virginia', stateAbbr: 'WV', population: 48000, medianIncome: 50000, tier: 3, region: 'Kanawha Valley', county: 'Kanawha', zips: ['25301', '25314'], localBlurb: 'Charleston, the state capital, is anchored by the Charleston Area Medical Center network.' },
  { name: 'Huntington', slug: 'huntington', state: 'West Virginia', stateSlug: 'west-virginia', stateAbbr: 'WV', population: 46000, medianIncome: 40000, tier: 3, region: 'Tri-State Area', county: 'Cabell', zips: ['25701', '25705'], localBlurb: 'Huntington hosts Marshall University\'s Joan C. Edwards School of Medicine and Cabell Huntington Hospital.' },
  { name: 'Wheeling', slug: 'wheeling', state: 'West Virginia', stateSlug: 'west-virginia', stateAbbr: 'WV', population: 27000, medianIncome: 48000, tier: 3, region: 'Northern Panhandle', county: 'Ohio', zips: ['26003'], localBlurb: 'Wheeling is served by WVU Medicine Wheeling Hospital in the Northern Panhandle.' },
  { name: 'Martinsburg', slug: 'martinsburg', state: 'West Virginia', stateSlug: 'west-virginia', stateAbbr: 'WV', population: 18000, medianIncome: 55000, tier: 3, region: 'Eastern Panhandle', county: 'Berkeley', zips: ['25401', '25404'], localBlurb: 'Martinsburg is anchored by WVU Medicine Berkeley Medical Center in the fast-growing Eastern Panhandle.' },
  { name: 'Bridgeport', slug: 'bridgeport', state: 'West Virginia', stateSlug: 'west-virginia', stateAbbr: 'WV', population: 9000, medianIncome: 85000, tier: 2, region: 'North Central West Virginia', county: 'Harrison', zips: ['26330'], localBlurb: 'Bridgeport is one of West Virginia\'s highest-income cities, home to United Hospital Center.' },
];

export default CITIES_WEST_VIRGINIA;
