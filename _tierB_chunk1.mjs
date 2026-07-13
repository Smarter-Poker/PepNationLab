import fs from 'fs';
const DIR = './lib/cities/data';

const additions = {
  'washington': [
    ['Kennewick','kennewick',84000,68000,3,'Tri-Cities','Benton',['99336'],'Kennewick laboratories in the Tri-Cities region source our high-purity peptides for reproducible metabolic research alongside the Pacific Northwest National Laboratory.'],
    ['Richland','richland',61000,82000,2,'Tri-Cities','Benton',['99352'],'Richland research groups, anchored near the Hanford Site and PNNL, trust our lot-traceable compounds and complete certificates of analysis.'],
    ['Pasco','pasco',78000,65000,3,'Tri-Cities','Franklin',['99301'],'Pasco research professionals rely on our verified purity and complete third-party COAs for tissue-repair investigations.'],
    ['Yakima','yakima',96000,55000,3,'Central Washington','Yakima',['98901', '98902'],'Yakima laboratories in the heart of Central Washington choose our high-purity peptides for metabolic and recovery studies.'],
    ['Bellingham','bellingham',93000,56000,3,'North Puget Sound','Whatcom',['98225', '98226'],'Bellingham research teams near Western Washington University select our documented compounds and transparent third-party analysis.'],
    ['Wenatchee','wenatchee',35000,62000,3,'Central Washington','Chelan',['98801'],'Wenatchee research professionals in the Columbia River valley source our cold-chain-handled compounds with full lot documentation.'],
    ['Walla Walla','walla-walla',33000,52000,3,'Eastern Washington','Walla Walla',['99362'],'Walla Walla laboratories value our stability testing and full COA documentation on every compound lot for local academic and biotech studies.'],
    ['Pullman','pullman',32000,32000,3,'Eastern Washington','Whitman',['99163'],'Home to Washington State University, Pullman research groups rely on our high-purity peptides for reproducible cellular research.'],
    ['Bremerton','bremerton',44000,58000,3,'Kitsap Peninsula','Kitsap',['98310', '98312'],'Bremerton laboratories on the Kitsap Peninsula choose our lot-traceable peptides for longevity and recovery studies.'],
    ['Silverdale','silverdale',19000,80000,2,'Kitsap Peninsula','Kitsap',['98383'],'Silverdale research teams trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Port Orchard','port-orchard',16000,72000,3,'Kitsap Peninsula','Kitsap',['98366'],'Port Orchard research professionals select our high-purity peptides with full lot documentation.'],
    ['Mount Vernon','mount-vernon',35000,65000,3,'North Puget Sound','Skagit',['98273'],'Mount Vernon laboratories source our verified-purity compounds with complete COAs for Skagit Valley research.'],
    ['Anacortes','anacortes',17000,78000,2,'North Puget Sound','Skagit',['98221'],'Anacortes research groups on Fidalgo Island rely on our lot-traceable compounds for reproducible metabolic research.'],
    ['Oak Harbor','oak-harbor',23000,60000,3,'Whidbey Island','Island',['98277'],'Oak Harbor laboratories choose our high-purity peptides for metabolic and recovery studies.'],
    ['Port Angeles','port-angeles',20000,52000,3,'Olympic Peninsula','Clallam',['98362'],'Port Angeles research teams on the Olympic Peninsula trust our documented compounds and comprehensive certificates of analysis.'],
    ['Sequim','sequim',8000,55000,3,'Olympic Peninsula','Clallam',['98382'],'Sequim research professionals select our high-purity peptides with transparent lot documentation.'],
    ['Longview','longview',37000,52000,3,'Southwest Washington','Cowlitz',['98632'],'Longview laboratories source our verified-purity compounds with full lot documentation.'],
    ['Kelso','kelso',12000,50000,3,'Southwest Washington','Cowlitz',['98626'],'Kelso research groups rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Centralia','centralia',18000,52000,3,'Southwest Washington','Lewis',['98531'],'Centralia laboratories in Lewis County choose our high-purity peptides for cellular-signaling and metabolic studies.'],
    ['Chehalis','chehalis',7000,55000,3,'Southwest Washington','Lewis',['98532'],'Chehalis research teams trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Aberdeen','aberdeen',17000,48000,3,'Grays Harbor','Grays Harbor',['98520'],'Aberdeen laboratories on the Washington coast select our high-purity peptides for reproducible metabolic research.'],
    ['Moses Lake','moses-lake',25000,60000,3,'Columbia Basin','Grant',['98837'],'Moses Lake research professionals source our cold-chain-handled compounds with full lot documentation.']
  ],
  'florida': [
    ['Boca Raton','boca-raton',97000,88000,2,'South Florida','Palm Beach',['33431', '33432'],'Boca Raton research groups near Florida Atlantic University trust our lot-traceable compounds and complete certificates of analysis.'],
    ['Boynton Beach','boynton-beach',80000,65000,3,'South Florida','Palm Beach',['33426', '33435'],'Boynton Beach laboratories choose our high-purity peptides for metabolic and recovery studies.'],
    ['Delray Beach','delray-beach',66000,68000,3,'South Florida','Palm Beach',['33444', '33445', '33483'],'Delray Beach research teams select our documented compounds and transparent third-party analysis.'],
    ['Wellington','wellington',61000,98000,2,'South Florida','Palm Beach',['33414'],'Wellington research professionals source our cold-chain-handled compounds with full lot documentation.'],
    ['Jupiter','jupiter',60000,92000,2,'South Florida','Palm Beach',['33458', '33477'],'Jupiter laboratories near the Scripps Research Institute value our stability testing and full COA documentation on every compound lot.'],
    ['Palm Beach Gardens','palm-beach-gardens',59000,95000,2,'South Florida','Palm Beach',['33410', '33418'],'Palm Beach Gardens research groups rely on our high-purity peptides for reproducible cellular research.'],
    ['Sunrise','sunrise',97000,62000,3,'South Florida','Broward',['33322', '33323', '33351'],'Sunrise laboratories choose our lot-traceable peptides for longevity and recovery studies.'],
    ['Plantation','plantation',91000,75000,3,'South Florida','Broward',['33317', '33324'],'Plantation research teams trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Deerfield Beach','deerfield-beach',86000,55000,3,'South Florida','Broward',['33441', '33442'],'Deerfield Beach research professionals select our high-purity peptides with full lot documentation.'],
    ['Melbourne','melbourne',85000,58000,3,'Space Coast','Brevard',['32901', '32935', '32940'],'Melbourne laboratories on the Space Coast source our verified-purity compounds with complete COAs for local biotech research.'],
    ['Palm Bay','palm-bay',120000,55000,3,'Space Coast','Brevard',['32905', '32907', '32909'],'Palm Bay research groups rely on our lot-traceable compounds for reproducible metabolic research.'],
    ['Kissimmee','kissimmee',79000,52000,3,'Central Florida','Osceola',['34741', '34743', '34744'],'Kissimmee laboratories choose our high-purity peptides for metabolic and recovery studies.'],
    ['Sanford','sanford',61000,60000,3,'Central Florida','Seminole',['32771', '32773'],'Sanford research teams trust our documented compounds and comprehensive certificates of analysis.'],
    ['Daytona Beach','daytona-beach',72000,42000,3,'Central Florida','Volusia',['32114', '32118', '32119'],'Daytona Beach research professionals select our high-purity peptides with transparent lot documentation.'],
    ['Port Orange','port-orange',63000,58000,3,'Central Florida','Volusia',['32127', '32128'],'Port Orange laboratories source our verified-purity compounds with full lot documentation.'],
    ['Pensacola','pensacola',54000,55000,3,'Florida Panhandle','Escambia',['32501', '32503', '32504'],'Pensacola research groups in the Panhandle rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Panama City','panama-city',35000,48000,3,'Florida Panhandle','Bay',['32401', '32405'],'Panama City laboratories choose our high-purity peptides for cellular-signaling and metabolic studies.'],
    ['Fort Myers','fort-myers',86000,52000,3,'Southwest Florida','Lee',['33901', '33908', '33916'],'Fort Myers research teams trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Cape Coral','cape-coral',194000,65000,3,'Southwest Florida','Lee',['33904', '33909', '33914'],'Cape Coral laboratories select our high-purity peptides for reproducible metabolic research.'],
    ['Bradenton','bradenton',55000,50000,3,'Tampa Bay Area','Manatee',['34205', '34208', '34209'],'Bradenton research professionals source our cold-chain-handled compounds with full lot documentation.'],
    ['Sarasota','sarasota',54000,62000,3,'Tampa Bay Area','Sarasota',['34231', '34232', '34236'],'Sarasota laboratories choose our verified-purity peptides for recovery and tissue-repair investigations.']
  ],
  'tennessee': [
    ['Clarksville','clarksville',166000,60000,3,'Middle Tennessee','Montgomery',['37040', '37042'],'Clarksville research groups near Austin Peay State University trust our lot-traceable compounds and complete certificates of analysis.'],
    ['Murfreesboro','murfreesboro',152000,68000,3,'Middle Tennessee','Rutherford',['37128', '37129', '37130'],'Murfreesboro laboratories near Middle Tennessee State University choose our high-purity peptides for metabolic and recovery studies.'],
    ['Franklin','franklin-tn',85000,105000,2,'Middle Tennessee','Williamson',['37064', '37067', '37069'],'Franklin research teams in affluent Williamson County select our documented compounds and transparent third-party analysis.'],
    ['Jackson','jackson-tn',68000,48000,3,'West Tennessee','Madison',['38301', '38305'],'Jackson research professionals source our cold-chain-handled compounds with full lot documentation.'],
    ['Johnson City','johnson-city',71000,46000,3,'East Tennessee','Washington',['37601', '37604', '37615'],'Johnson City laboratories near East Tennessee State University value our stability testing and full COA documentation on every compound lot.'],
    ['Bartlett','bartlett',57000,88000,2,'West Tennessee','Shelby',['38133', '38134', '38135'],'Bartlett research groups in suburban Memphis rely on our high-purity peptides for reproducible cellular research.'],
    ['Hendersonville','hendersonville',61000,75000,2,'Middle Tennessee','Sumner',['37075'],'Hendersonville laboratories choose our lot-traceable peptides for longevity and recovery studies.'],
    ['Kingsport','kingsport',55000,45000,3,'East Tennessee','Sullivan',['37660', '37664'],'Kingsport research teams in the Tri-Cities region trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Collierville','collierville',51000,118000,1,'West Tennessee','Shelby',['38017'],'Collierville research professionals select our high-purity peptides with full lot documentation.'],
    ['Smyrna','smyrna-tn',53000,68000,3,'Middle Tennessee','Rutherford',['37167'],'Smyrna laboratories source our verified-purity compounds with complete COAs.'],
    ['Cleveland','cleveland-tn',47000,48000,3,'East Tennessee','Bradley',['37311', '37312', '37323'],'Cleveland research groups rely on our lot-traceable compounds for reproducible metabolic research.'],
    ['Brentwood','brentwood',45000,168000,1,'Middle Tennessee','Williamson',['37027'],'Brentwood laboratories in Williamson County choose our high-purity peptides for metabolic and recovery studies.'],
    ['Germantown','germantown',39000,122000,1,'West Tennessee','Shelby',['38138', '38139'],'Germantown research teams trust our documented compounds and comprehensive certificates of analysis.'],
    ['Columbia','columbia-tn',41000,55000,3,'Middle Tennessee','Maury',['38401'],'Columbia research professionals select our high-purity peptides with transparent lot documentation.'],
    ['Spring Hill','spring-hill',50000,92000,2,'Middle Tennessee','Williamson',['37174'],'Spring Hill laboratories source our verified-purity compounds with full lot documentation.'],
    ['Gallatin','gallatin',44000,62000,3,'Middle Tennessee','Sumner',['37066'],'Gallatin research groups rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Lebanon','lebanon-tn',38000,60000,3,'Middle Tennessee','Wilson',['37087', '37090'],'Lebanon laboratories choose our high-purity peptides for cellular-signaling and metabolic studies.'],
    ['Mount Juliet','mount-juliet',39000,95000,2,'Middle Tennessee','Wilson',['37122'],'Mount Juliet research teams trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Maryville','maryville',31000,65000,3,'East Tennessee','Blount',['37801', '37803', '37804'],'Maryville laboratories select our high-purity peptides for reproducible metabolic research.'],
    ['Bristol','bristol-tn',27000,45000,3,'East Tennessee','Sullivan',['37620'],'Bristol research professionals source our cold-chain-handled compounds with full lot documentation.']
  ],
  'missouri': [
    ['Independence','independence',123000,52000,3,'Kansas City Metro','Jackson',['64050', '64052', '64055'],'Independence research groups trust our lot-traceable compounds and complete certificates of analysis.'],
    ['Columbia','columbia-mo',126000,55000,3,'Central Missouri','Boone',['65201', '65202', '65203'],'Columbia laboratories anchored by the University of Missouri choose our high-purity peptides for metabolic and recovery studies.'],
    ["Lee's Summit",'lees-summit',101000,95000,2,'Kansas City Metro','Jackson',['64063', '64064', '64081', '64082'],"Lee's Summit research teams select our documented compounds and transparent third-party analysis."],
    ["O'Fallon",'ofallon-mo',91000,92000,2,'St. Louis Metro','St. Charles',['63366', '63368'],"O'Fallon research professionals source our cold-chain-handled compounds with full lot documentation."],
    ['St. Joseph','st-joseph',70000,48000,3,'Northwest Missouri','Buchanan',['64501', '64506'],'St. Joseph laboratories value our stability testing and full COA documentation on every compound lot.'],
    ['St. Charles','st-charles',70000,72000,3,'St. Louis Metro','St. Charles',['63301', '63303'],'St. Charles research groups rely on our high-purity peptides for reproducible cellular research.'],
    ['St. Peters','st-peters',58000,78000,2,'St. Louis Metro','St. Charles',['63376'],'St. Peters laboratories choose our lot-traceable peptides for longevity and recovery studies.'],
    ['Blue Springs','blue-springs',58000,75000,2,'Kansas City Metro','Jackson',['64014', '64015'],'Blue Springs research teams trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Florissant','florissant',52000,58000,3,'St. Louis Metro','St. Louis',['63031', '63033'],'Florissant research professionals select our high-purity peptides with full lot documentation.'],
    ['Joplin','joplin',51000,45000,3,'Southwest Missouri','Jasper',['64801', '64804'],'Joplin laboratories source our verified-purity compounds with complete COAs.'],
    ['Chesterfield','chesterfield',49000,118000,1,'St. Louis Metro','St. Louis',['63005', '63017'],'Chesterfield research groups in affluent St. Louis County rely on our lot-traceable compounds for reproducible metabolic research.'],
    ['Jefferson City','jefferson-city',43000,52000,3,'Central Missouri','Cole',['65101', '65109'],'Jefferson City laboratories in the state capital choose our high-purity peptides for metabolic and recovery studies.'],
    ['Cape Girardeau','cape-girardeau',39000,48000,3,'Southeast Missouri','Cape Girardeau',['63701'],'Cape Girardeau research teams trust our documented compounds and comprehensive certificates of analysis.'],
    ['Wildwood','wildwood',35000,132000,1,'St. Louis Metro','St. Louis',['63038', '63040'],'Wildwood research professionals select our high-purity peptides with transparent lot documentation.'],
    ['University City','university-city',35000,68000,3,'St. Louis Metro','St. Louis',['63130'],'University City laboratories near Washington University source our verified-purity compounds with full lot documentation.'],
    ['Liberty','liberty',32000,78000,2,'Kansas City Metro','Clay',['64068'],'Liberty research groups rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Raytown','raytown',29000,55000,3,'Kansas City Metro','Jackson',['64133', '64138'],'Raytown laboratories choose our high-purity peptides for cellular-signaling and metabolic studies.']
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
