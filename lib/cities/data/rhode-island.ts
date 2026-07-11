import type { City } from '../cities-data';

// Rhode Island — 6 cities
const CITIES_RHODE_ISLAND: City[] = [
  { name: 'Providence', slug: 'providence', state: 'Rhode Island', stateSlug: 'rhode-island', stateAbbr: 'RI', population: 190000, medianIncome: 55000, tier: 2, region: 'Providence Metro', county: 'Providence', zips: ['02903', '02906'], localBlurb: 'Providence is home to Brown University\'s Warren Alpert Medical School and Rhode Island Hospital.' },
  { name: 'East Greenwich', slug: 'east-greenwich', state: 'Rhode Island', stateSlug: 'rhode-island', stateAbbr: 'RI', population: 14000, medianIncome: 130000, tier: 1, region: 'Providence Metro', county: 'Kent', zips: ['02818'], localBlurb: 'East Greenwich is Rhode Island\'s wealthiest town, minutes from the Kent Hospital campus in Warwick.' },
  { name: 'Barrington', slug: 'barrington', state: 'Rhode Island', stateSlug: 'rhode-island', stateAbbr: 'RI', population: 17000, medianIncome: 125000, tier: 1, region: 'Providence Metro', county: 'Bristol', zips: ['02806'], localBlurb: 'Barrington is an affluent East Bay town whose professionals commute to Providence\'s hospital district.' },
  { name: 'Newport', slug: 'newport', state: 'Rhode Island', stateSlug: 'rhode-island', stateAbbr: 'RI', population: 25000, medianIncome: 80000, tier: 2, region: 'Aquidneck Island', county: 'Newport', zips: ['02840'], localBlurb: 'Newport is served by Newport Hospital, a Brown University Health member on Aquidneck Island.' },
  { name: 'Warwick', slug: 'warwick', state: 'Rhode Island', stateSlug: 'rhode-island', stateAbbr: 'RI', population: 82000, medianIncome: 70000, tier: 3, region: 'Providence Metro', county: 'Kent', zips: ['02886', '02889'], localBlurb: 'Warwick is anchored by Kent Hospital, Rhode Island\'s second-largest medical center.' },
  { name: 'Cranston', slug: 'cranston', state: 'Rhode Island', stateSlug: 'rhode-island', stateAbbr: 'RI', population: 82000, medianIncome: 67000, tier: 3, region: 'Providence Metro', county: 'Providence', zips: ['02905', '02920'], localBlurb: 'Cranston sits just south of Providence\'s academic medical district along the Route 10 corridor.' },
];

export default CITIES_RHODE_ISLAND;
