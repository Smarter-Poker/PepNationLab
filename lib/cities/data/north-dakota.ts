import type { City } from '../cities-data';

// North Dakota — 5 cities
const CITIES_NORTH_DAKOTA: City[] = [
  { name: 'Fargo', slug: 'fargo', state: 'North Dakota', stateSlug: 'north-dakota', stateAbbr: 'ND', population: 126000, medianIncome: 60000, tier: 2, region: 'Red River Valley', county: 'Cass', zips: ['58102', '58103', '58104'], localBlurb: 'Fargo is anchored by Sanford Medical Center Fargo and North Dakota State University\'s research park.' },
  { name: 'West Fargo', slug: 'west-fargo', state: 'North Dakota', stateSlug: 'north-dakota', stateAbbr: 'ND', population: 39000, medianIncome: 78000, tier: 2, region: 'Red River Valley', county: 'Cass', zips: ['58078'], localBlurb: 'West Fargo is North Dakota\'s fastest-growing city, served by the Sanford and Essentia networks.' },
  { name: 'Bismarck', slug: 'bismarck', state: 'North Dakota', stateSlug: 'north-dakota', stateAbbr: 'ND', population: 74000, medianIncome: 68000, tier: 3, region: 'Missouri Slope', county: 'Burleigh', zips: ['58501', '58503'], localBlurb: 'Bismarck, the state capital, hosts Sanford Health Bismarck and CHI St. Alexius Health.' },
  { name: 'Grand Forks', slug: 'grand-forks', state: 'North Dakota', stateSlug: 'north-dakota', stateAbbr: 'ND', population: 59000, medianIncome: 55000, tier: 3, region: 'Red River Valley', county: 'Grand Forks', zips: ['58201', '58203'], localBlurb: 'Grand Forks is home to the University of North Dakota School of Medicine and Altru Health System.' },
  { name: 'Minot', slug: 'minot', state: 'North Dakota', stateSlug: 'north-dakota', stateAbbr: 'ND', population: 48000, medianIncome: 65000, tier: 3, region: 'North Central North Dakota', county: 'Ward', zips: ['58701'], localBlurb: 'Minot is anchored by Trinity Health\'s new regional healthcare campus.' },
];

export default CITIES_NORTH_DAKOTA;
