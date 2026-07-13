import fs from 'fs';
const DIR = './lib/cities/data';

const additions = {
  'maryland': [
    ['Bowie','bowie',58000,122000,2,'Capital Region',"Prince George's",['20715', '20716', '20720', '20721'],'Bowie research groups in the Capital Region trust our lot-traceable compounds and complete certificates of analysis.'],
    ['Hagerstown','hagerstown',43000,52000,3,'Western Maryland','Washington',['21740', '21742'],'Hagerstown laboratories rely on our high-purity peptides for reproducible metabolic research.'],
    ['Annapolis','annapolis',39000,98000,2,'Central Maryland','Anne Arundel',['21401', '21403'],'Annapolis research professionals select our documented compounds and transparent third-party analysis.'],
    ['College Park','college-park-md',32000,68000,3,'Capital Region',"Prince George's",['20740'],'College Park laboratories anchored by the University of Maryland choose our lot-traceable peptides for longevity and recovery studies.'],
    ['Salisbury','salisbury-md',32000,48000,3,'Eastern Shore','Wicomico',['21801', '21804'],'Salisbury research teams trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Laurel','laurel-md',29000,85000,2,'Capital Region',"Prince George's",['20707', '20708'],'Laurel laboratories select our high-purity peptides for reproducible metabolic research.'],
    ['Greenbelt','greenbelt',24000,75000,3,'Capital Region',"Prince George's",['20770'],'Greenbelt research professionals near the NASA Goddard Space Flight Center source our cold-chain-handled compounds with full lot documentation.'],
    ['Cumberland','cumberland-md',19000,42000,3,'Western Maryland','Allegany',['21502'],'Cumberland laboratories value our stability testing and full COA documentation on every compound lot.'],
    ['Westminster','westminster-md',19000,75000,2,'Central Maryland','Carroll',['21157', '21158'],'Westminster research groups choose our high-purity peptides for metabolic and recovery studies.'],
    ['Hyattsville','hyattsville',20000,68000,3,'Capital Region',"Prince George's",['20781', '20782'],'Hyattsville laboratories rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Takoma Park','takoma-park',17000,88000,2,'Capital Region','Montgomery',['20912'],'Takoma Park research teams select our documented compounds and transparent third-party analysis.'],
    ['Easton','easton-md',16000,68000,3,'Eastern Shore','Talbot',['21601'],'Easton research professionals source our cold-chain-handled compounds with full lot documentation.'],
    ['Elkton','elkton-md',15000,62000,3,'Eastern Shore','Cecil',['21921'],'Elkton laboratories value our stability testing and full COA documentation on every compound lot.'],
    ['Aberdeen','aberdeen-md',16000,68000,3,'Central Maryland','Harford',['21001'],'Aberdeen research groups rely on our high-purity peptides for reproducible cellular research.'],
    ['Havre de Grace','havre-de-grace',13000,85000,2,'Central Maryland','Harford',['21078'],'Havre de Grace laboratories choose our lot-traceable peptides for longevity and recovery studies.']
  ],
  'alabama': [
    ['Hoover','hoover',92000,98000,2,'Birmingham Metro','Jefferson',['35216', '35226', '35244'],'Hoover research groups in the Birmingham suburbs trust our lot-traceable compounds and complete certificates of analysis.'],
    ['Dothan','dothan',71000,52000,3,'Wiregrass Region','Houston',['36301', '36303', '36305'],'Dothan laboratories rely on our high-purity peptides for reproducible metabolic research.'],
    ['Auburn','auburn-al',76000,52000,3,'East Alabama','Lee',['36830', '36832'],'Auburn research professionals at Auburn University select our documented compounds and transparent third-party analysis.'],
    ['Decatur','decatur-al',54000,55000,3,'North Alabama','Morgan',['35601', '35603'],'Decatur laboratories choose our lot-traceable peptides for longevity and recovery studies.'],
    ['Madison','madison-al',56000,105000,2,'North Alabama','Madison',['35756', '35758'],'Madison research teams near Huntsville trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Florence','florence-al',40000,48000,3,'North Alabama','Lauderdale',['35630'],'Florence laboratories select our high-purity peptides for reproducible metabolic research.'],
    ['Phenix City','phenix-city',38000,45000,3,'East Alabama','Russell',['36867', '36869'],'Phenix City research professionals source our cold-chain-handled compounds with full lot documentation.'],
    ['Prattville','prattville',37000,72000,3,'Central Alabama','Autauga',['36066', '36067'],'Prattville laboratories value our stability testing and full COA documentation on every compound lot.'],
    ['Gadsden','gadsden',35000,42000,3,'Northeast Alabama','Etowah',['35901', '35903'],'Gadsden research groups choose our high-purity peptides for metabolic and recovery studies.'],
    ['Vestavia Hills','vestavia-hills',39000,122000,1,'Birmingham Metro','Jefferson',['35216', '35243'],'Vestavia Hills laboratories rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Alabaster','alabaster',33000,82000,3,'Birmingham Metro','Shelby',['35007'],'Alabaster research teams select our documented compounds and transparent third-party analysis.'],
    ['Opelika','opelika',32000,58000,3,'East Alabama','Lee',['36801'],'Opelika research professionals source our cold-chain-handled compounds with full lot documentation.'],
    ['Enterprise','enterprise',28000,68000,3,'Wiregrass Region','Coffee',['36330'],'Enterprise laboratories value our stability testing and full COA documentation on every compound lot.'],
    ['Bessemer','bessemer',26000,45000,3,'Birmingham Metro','Jefferson',['35020', '35022'],'Bessemer research groups rely on our high-purity peptides for reproducible cellular research.']
  ],
  'south-carolina': [
    ['Mount Pleasant','mount-pleasant',91000,118000,1,'Lowcountry','Charleston',['29464', '29466'],'Mount Pleasant research groups trust our lot-traceable compounds and complete certificates of analysis.'],
    ['Rock Hill','rock-hill',74000,58000,3,'Piedmont','York',['29730', '29732'],'Rock Hill laboratories near Winthrop University rely on our high-purity peptides for reproducible metabolic research.'],
    ['Greenville','greenville',70000,62000,2,'Upstate','Greenville',['29601', '29605', '29607'],'Greenville research professionals select our documented compounds and transparent third-party analysis.'],
    ['Summerville','summerville',53000,75000,2,'Lowcountry','Dorchester',['29483', '29485'],'Summerville laboratories choose our lot-traceable peptides for longevity and recovery studies.'],
    ['Goose Creek','goose-creek',46000,72000,3,'Lowcountry','Berkeley',['29445'],'Goose Creek research teams trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Sumter','sumter',43000,45000,3,'Midlands','Sumter',['29150', '29154'],'Sumter laboratories select our high-purity peptides for reproducible metabolic research.'],
    ['Florence','florence-sc',39000,52000,3,'Pee Dee','Florence',['29501', '29505'],'Florence research professionals source our cold-chain-handled compounds with full lot documentation.'],
    ['Spartanburg','spartanburg',38000,48000,3,'Upstate','Spartanburg',['29301', '29302', '29303'],'Spartanburg laboratories value our stability testing and full COA documentation on every compound lot.'],
    ['Hilton Head Island','hilton-head-island',39000,95000,2,'Lowcountry','Beaufort',['29926', '29928'],'Hilton Head Island research groups choose our high-purity peptides for metabolic and recovery studies.'],
    ['Myrtle Beach','myrtle-beach',35000,55000,3,'Grand Strand','Horry',['29577', '29579'],'Myrtle Beach laboratories rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Aiken','aiken',32000,65000,3,'CSRA','Aiken',['29801', '29803'],'Aiken research teams near the Savannah River Site select our documented compounds and transparent third-party analysis.'],
    ['Greer','greer',35000,68000,3,'Upstate','Greenville',['29650', '29651'],'Greer research professionals source our cold-chain-handled compounds with full lot documentation.'],
    ['Anderson','anderson-sc',28000,48000,3,'Upstate','Anderson',['29621', '29625'],'Anderson laboratories value our stability testing and full COA documentation on every compound lot.'],
    ['Mauldin','mauldin',25000,75000,3,'Upstate','Greenville',['29662'],'Mauldin research groups rely on our high-purity peptides for reproducible cellular research.']
  ],
  'minnesota': [
    ['Duluth','duluth',86000,58000,3,'Arrowhead Region','St. Louis',['55802', '55804', '55811'],'Duluth research groups near UMD trust our lot-traceable compounds and complete certificates of analysis.'],
    ['Bloomington','bloomington-mn',89000,82000,2,'Twin Cities Metro','Hennepin',['55420', '55431', '55437', '55438'],'Bloomington laboratories rely on our high-purity peptides for reproducible metabolic research.'],
    ['Brooklyn Park','brooklyn-park',86000,78000,2,'Twin Cities Metro','Hennepin',['55443', '55444', '55445'],'Brooklyn Park research professionals select our documented compounds and transparent third-party analysis.'],
    ['Plymouth','plymouth-mn',81000,115000,1,'Twin Cities Metro','Hennepin',['55441', '55442', '55446', '55447'],'Plymouth laboratories choose our lot-traceable peptides for longevity and recovery studies.'],
    ['Woodbury','woodbury',75000,122000,1,'Twin Cities Metro','Washington',['55125', '55129'],'Woodbury research teams trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Lakeville','lakeville',69000,118000,1,'Twin Cities Metro','Dakota',['55044'],'Lakeville laboratories select our high-purity peptides for reproducible metabolic research.'],
    ['Blaine','blaine',70000,95000,2,'Twin Cities Metro','Anoka',['55434', '55449'],'Blaine research professionals source our cold-chain-handled compounds with full lot documentation.'],
    ['Maple Grove','maple-grove',70000,120000,1,'Twin Cities Metro','Hennepin',['55311', '55369'],'Maple Grove laboratories value our stability testing and full COA documentation on every compound lot.'],
    ['St. Cloud','st-cloud-mn',68000,55000,3,'Central Minnesota','Stearns',['56301', '56303'],'St. Cloud research groups choose our high-purity peptides for metabolic and recovery studies.'],
    ['Eagan','eagan',68000,105000,2,'Twin Cities Metro','Dakota',['55121', '55122', '55123'],'Eagan laboratories rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Burnsville','burnsville',64000,82000,3,'Twin Cities Metro','Dakota',['55306', '55337'],'Burnsville research teams select our documented compounds and transparent third-party analysis.'],
    ['Eden Prairie','eden-prairie',64000,125000,1,'Twin Cities Metro','Hennepin',['55344', '55346', '55347'],'Eden Prairie research professionals source our cold-chain-handled compounds with full lot documentation.']
  ],
  'colorado': [
    ['Grand Junction','grand-junction',65000,62000,3,'Western Slope','Mesa',['81501', '81504'],'Grand Junction research groups trust our lot-traceable compounds and complete certificates of analysis.'],
    ['Parker','parker',58000,135000,1,'Denver Metro','Douglas',['80134', '80138'],'Parker laboratories rely on our high-purity peptides for reproducible metabolic research.'],
    ['Castle Rock','castle-rock',73000,128000,1,'Denver Metro','Douglas',['80104', '80108'],'Castle Rock research professionals select our documented compounds and transparent third-party analysis.'],
    ['Commerce City','commerce-city',62000,88000,3,'Denver Metro','Adams',['80022'],'Commerce City laboratories choose our lot-traceable peptides for longevity and recovery studies.'],
    ['Littleton','littleton',48000,92000,2,'Denver Metro','Arapahoe',['80120', '80123', '80128'],'Littleton research teams trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Northglenn','northglenn',38000,78000,3,'Denver Metro','Adams',['80233', '80234'],'Northglenn laboratories select our high-purity peptides for reproducible metabolic research.'],
    ['Brighton','brighton-co',40000,85000,3,'Denver Metro','Adams',['80601', '80602'],'Brighton research professionals source our cold-chain-handled compounds with full lot documentation.'],
    ['Englewood','englewood-co',33000,72000,3,'Denver Metro','Arapahoe',['80110', '80111', '80112'],'Englewood laboratories value our stability testing and full COA documentation on every compound lot.'],
    ['Wheat Ridge','wheat-ridge',32000,68000,3,'Denver Metro','Jefferson',['80033'],'Wheat Ridge research groups choose our high-purity peptides for metabolic and recovery studies.']
  ],
  'oregon': [
    ['Corvallis','corvallis',59000,55000,3,'Willamette Valley','Benton',['97330', '97333'],'Corvallis research groups at Oregon State University trust our lot-traceable compounds and complete certificates of analysis.'],
    ['Albany','albany-or',56000,62000,3,'Willamette Valley','Linn',['97321', '97322'],'Albany laboratories rely on our high-purity peptides for reproducible metabolic research.'],
    ['Tigard','tigard',54000,88000,2,'Portland Metro','Washington',['97223', '97224'],'Tigard research professionals select our documented compounds and transparent third-party analysis.'],
    ['Lake Oswego','lake-oswego',40000,122000,1,'Portland Metro','Clackamas',['97034', '97035'],'Lake Oswego laboratories choose our lot-traceable peptides for longevity and recovery studies.'],
    ['Keizer','keizer',39000,72000,3,'Willamette Valley','Marion',['97303'],'Keizer research teams trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Grants Pass','grants-pass',39000,52000,3,'Southern Oregon','Josephine',['97526', '97527'],'Grants Pass laboratories select our high-purity peptides for reproducible metabolic research.']
  ],
  'louisiana': [
    ['Lake Charles','lake-charles',81000,52000,3,'Southwest Louisiana','Calcasieu',['70601', '70605'],'Lake Charles research groups trust our lot-traceable compounds and complete certificates of analysis.'],
    ['Kenner','kenner',65000,62000,3,'New Orleans Metro','Jefferson',['70062', '70065'],'Kenner laboratories rely on our high-purity peptides for reproducible metabolic research.'],
    ['Bossier City','bossier-city',62000,58000,3,'Northwest Louisiana','Bossier',['71111', '71112'],'Bossier City research professionals select our documented compounds and transparent third-party analysis.'],
    ['Monroe','monroe-la',47000,42000,3,'Northeast Louisiana','Ouachita',['71201', '71203'],'Monroe laboratories choose our lot-traceable peptides for longevity and recovery studies.'],
    ['Alexandria','alexandria-la',45000,48000,3,'Central Louisiana','Rapides',['71301', '71303'],'Alexandria research teams trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Houma','houma',32000,55000,3,'South Louisiana','Terrebonne',['70360', '70364'],'Houma laboratories select our high-purity peptides for reproducible metabolic research.']
  ],
  'oklahoma': [
    ['Midwest City','midwest-city',58000,58000,3,'Oklahoma City Metro','Oklahoma',['73110', '73130'],'Midwest City research groups near Tinker AFB trust our lot-traceable compounds and complete certificates of analysis.'],
    ['Moore','moore',62000,75000,2,'Oklahoma City Metro','Cleveland',['73160'],'Moore laboratories rely on our high-purity peptides for reproducible metabolic research.'],
    ['Enid','enid',49000,55000,3,'North Central Oklahoma','Garfield',['73701', '73703'],'Enid research professionals select our documented compounds and transparent third-party analysis.'],
    ['Stillwater','stillwater',48000,42000,3,'North Central Oklahoma','Payne',['74074'],'Stillwater laboratories at Oklahoma State University choose our lot-traceable peptides for longevity and recovery studies.']
  ],
  'kentucky': [
    ['Owensboro','owensboro',60000,52000,3,'Western Kentucky','Daviess',['42301', '42303'],'Owensboro research groups trust our lot-traceable compounds and complete certificates of analysis.'],
    ['Covington','covington',40000,55000,3,'Northern Kentucky','Kenton',['41011', '41014', '41015'],'Covington laboratories rely on our high-purity peptides for reproducible metabolic research.'],
    ['Richmond','richmond-ky',36000,48000,3,'Bluegrass Region','Madison',['40475'],'Richmond research professionals near Eastern Kentucky University select our documented compounds and transparent third-party analysis.'],
    ['Georgetown','georgetown-ky',37000,75000,2,'Bluegrass Region','Scott',['40324'],'Georgetown laboratories choose our lot-traceable peptides for longevity and recovery studies.']
  ],
  'nevada': [
    ['Sparks','sparks',108000,75000,2,'Washoe County','Washoe',['89431', '89434', '89436'],'Sparks research groups trust our lot-traceable compounds and complete certificates of analysis.'],
    ['Carson City','carson-city',58000,65000,3,'Western Nevada','Carson City',['89701', '89703'],'Carson City laboratories in the state capital rely on our high-purity peptides for reproducible metabolic research.'],
    ['Fernley','fernley',22000,68000,3,'Western Nevada','Lyon',['89408'],'Fernley research professionals select our documented compounds and transparent third-party analysis.']
  ],
  'utah': [
    ['Lehi','lehi',75000,105000,2,'Silicon Slopes','Utah',['84043'],'Lehi research groups in Silicon Slopes trust our lot-traceable compounds and complete certificates of analysis.'],
    ['Orem','orem',97000,72000,3,'Utah Valley','Utah',['84057', '84058'],'Orem laboratories near Utah Valley University rely on our high-purity peptides for reproducible metabolic research.']
  ]
};

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

for (const [stateSlug, CITIES] of Object.entries(additions)) {
  const file = `${DIR}/${stateSlug}.ts`;
  if (!fs.existsSync(file)) {
    console.error(`File ${file} not found!`);
    continue;
  }
  let src = fs.readFileSync(file, 'utf8');
  
  const stateMatch = src.match(/state:\s*'([^']+)'/);
  const abMatch = src.match(/stateAbbr:\s*'([^']+)'/);
  
  const meta = {
    state: stateMatch ? stateMatch[1] : '',
    stateSlug: stateSlug,
    ab: abMatch ? abMatch[1] : ''
  };

  const existing = new Set([...src.matchAll(/slug:\s*'([^']+)'/g)].map(m => m[1]));
  const toAdd = CITIES.filter(c => !existing.has(c[1]));
  const skipped = CITIES.filter(c => existing.has(c[1])).map(c => c[1]);
  
  function fmt(c) {
    const [name, slug, pop, inc, tier, region, county, zips, blurb] = c;
    const z = zips.map(x => `'${x}'`).join(', ');
    return `  { name: '${esc(name)}', slug: '${slug}', state: '${meta.state}', stateSlug: '${meta.stateSlug}', stateAbbr: '${meta.ab}', population: ${pop}, medianIncome: ${inc}, tier: ${tier}, region: '${esc(region)}', county: '${esc(county)}', zips: [${z}], localBlurb: '${esc(blurb)}' },`;
  }
  
  const idx = src.lastIndexOf('\n];');
  if (idx !== -1 && toAdd.length > 0) {
    src = src.slice(0, idx) + '\n' + toAdd.map(fmt).join('\n') + src.slice(idx);
    fs.writeFileSync(file, src);
    console.log(`Updated ${stateSlug}.ts: Added ${toAdd.length}, Skipped ${skipped.length}`);
  } else {
    console.log(`Skipped ${stateSlug}.ts (no additions or parse error)`);
  }
}
