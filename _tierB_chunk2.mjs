import fs from 'fs';
const DIR = './lib/cities/data';

const additions = {
  'florida': [
    // We need 21 new cities. Let's add ones that are likely not in the top 132 or just very specific.
    ['Ocoee','ocoee',49000,75000,3,'Central Florida','Orange',['34761'],'Ocoee research groups in Central Florida trust our lot-traceable compounds and complete certificates of analysis.'],
    ['Winter Garden','winter-garden',46000,88000,3,'Central Florida','Orange',['34787'],'Winter Garden laboratories rely on our high-purity peptides for reproducible metabolic research.'],
    ['Oviedo','oviedo',40000,98000,2,'Central Florida','Seminole',['32765', '32766'],'Oviedo research professionals select our documented compounds and transparent third-party analysis.'],
    ['St. Cloud','st-cloud',58000,65000,3,'Central Florida','Osceola',['34769', '34771', '34772'],'St. Cloud laboratories choose our lot-traceable peptides for longevity and recovery studies.'],
    ['Winter Springs','winter-springs',38000,82000,2,'Central Florida','Seminole',['32708'],'Winter Springs research teams trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Clermont','clermont',44000,72000,3,'Central Florida','Lake',['34711', '34715'],'Clermont laboratories select our high-purity peptides for reproducible metabolic research.'],
    ['Ormond Beach','ormond-beach',43000,65000,3,'Central Florida','Volusia',['32174', '32176'],'Ormond Beach research professionals source our cold-chain-handled compounds with full lot documentation.'],
    ['DeLand','deland',38000,52000,3,'Central Florida','Volusia',['32720', '32724'],'DeLand laboratories value our stability testing and full COA documentation on every compound lot.'],
    ['Titusville','titusville',48000,58000,3,'Space Coast','Brevard',['32780', '32796'],'Titusville research groups on the Space Coast choose our high-purity peptides for metabolic and recovery studies.'],
    ['Rockledge','rockledge',28000,78000,3,'Space Coast','Brevard',['32955'],'Rockledge laboratories rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Altamonte Springs','altamonte-springs',46000,62000,3,'Central Florida','Seminole',['32701', '32714'],'Altamonte Springs research teams select our documented compounds and transparent third-party analysis.'],
    ['Apopka','apopka',55000,75000,3,'Central Florida','Orange',['32703', '32712'],'Apopka research professionals source our cold-chain-handled compounds with full lot documentation.'],
    ['Margate','margate',58000,55000,3,'South Florida','Broward',['33063', '33068'],'Margate laboratories value our stability testing and full COA documentation on every compound lot.'],
    ['Coconut Creek','coconut-creek',57000,70000,3,'South Florida','Broward',['33066', '33073'],'Coconut Creek research groups rely on our high-purity peptides for reproducible cellular research.'],
    ['Oakland Park','oakland-park',44000,58000,3,'South Florida','Broward',['33309', '33334'],'Oakland Park laboratories choose our lot-traceable peptides for longevity and recovery studies.'],
    ['North Lauderdale','north-lauderdale',44000,52000,3,'South Florida','Broward',['33068'],'North Lauderdale research teams trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Hallandale Beach','hallandale-beach',41000,55000,3,'South Florida','Broward',['33009'],'Hallandale Beach research professionals select our high-purity peptides with full lot documentation.'],
    ['Cooper City','cooper-city',34000,105000,2,'South Florida','Broward',['33328', '33330'],'Cooper City laboratories source our verified-purity compounds with complete COAs.'],
    ['Parkland','parkland',34000,158000,1,'South Florida','Broward',['33067', '33076'],'Parkland research groups rely on our lot-traceable compounds for reproducible metabolic research.'],
    ['Dania Beach','dania-beach',32000,55000,3,'South Florida','Broward',['33004'],'Dania Beach laboratories choose our high-purity peptides for metabolic and recovery studies.'],
    ['Riviera Beach','riviera-beach',37000,52000,3,'South Florida','Palm Beach',['33404'],'Riviera Beach research teams trust our documented compounds and comprehensive certificates of analysis.']
  ],
  'wisconsin': [
    ['Waukesha','waukesha',71000,75000,3,'Milwaukee Metro','Waukesha',['53186', '53188', '53189'],'Waukesha research groups in the Milwaukee suburbs trust our lot-traceable compounds and complete certificates of analysis.'],
    ['Oshkosh','oshkosh',66000,52000,3,'Fox Valley','Winnebago',['54901', '54902', '54904'],'Oshkosh laboratories near the UW-Oshkosh campus rely on our high-purity peptides for reproducible metabolic research.'],
    ['Appleton','appleton',74000,65000,3,'Fox Valley','Outagamie',['54911', '54914', '54915'],'Appleton research professionals select our documented compounds and transparent third-party analysis.'],
    ['Janesville','janesville',65000,60000,3,'Southern Wisconsin','Rock',['53545', '53546'],'Janesville laboratories choose our lot-traceable peptides for longevity and recovery studies.'],
    ['Beloit','beloit',36000,48000,3,'Southern Wisconsin','Rock',['53511'],'Beloit research teams trust our documented, lot-traceable compounds and third-party analysis.'],
    ['La Crosse','la-crosse',52000,48000,3,'Western Wisconsin','La Crosse',['54601'],'La Crosse laboratories select our high-purity peptides for reproducible metabolic research.'],
    ['Sheboygan','sheboygan',49000,55000,3,'Eastern Wisconsin','Sheboygan',['53081', '53083'],'Sheboygan research professionals source our cold-chain-handled compounds with full lot documentation.'],
    ['Wauwatosa','wauwatosa',48000,85000,2,'Milwaukee Metro','Milwaukee',['53213', '53222', '53226'],'Wauwatosa laboratories anchored by the Medical College of Wisconsin value our stability testing and full COA documentation.'],
    ['Fond du Lac','fond-du-lac',43000,56000,3,'Fox Valley','Fond du Lac',['54935', '54937'],'Fond du Lac research groups choose our high-purity peptides for metabolic and recovery studies.'],
    ['New Berlin','new-berlin',40000,92000,2,'Milwaukee Metro','Waukesha',['53146', '53151'],'New Berlin laboratories rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Wausau','wausau',39000,55000,3,'Central Wisconsin','Marathon',['54401', '54403'],'Wausau research teams select our documented compounds and transparent third-party analysis.'],
    ['Brookfield','brookfield-wi',39000,105000,2,'Milwaukee Metro','Waukesha',['53005', '53045'],'Brookfield research professionals source our cold-chain-handled compounds with full lot documentation.'],
    ['Menomonee Falls','menomonee-falls',38000,85000,2,'Milwaukee Metro','Waukesha',['53051'],'Menomonee Falls laboratories value our stability testing and full COA documentation on every compound lot.'],
    ['Franklin','franklin-wi',36000,90000,2,'Milwaukee Metro','Milwaukee',['53132'],'Franklin research groups rely on our high-purity peptides for reproducible cellular research.'],
    ['Oak Creek','oak-creek',36000,82000,2,'Milwaukee Metro','Milwaukee',['53154'],'Oak Creek laboratories choose our lot-traceable peptides for longevity and recovery studies.'],
    ['Fitchburg','fitchburg-wi',32000,75000,2,'Madison Metro','Dane',['53711'],'Fitchburg research teams near Madison trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Manitowoc','manitowoc',32000,52000,3,'Eastern Wisconsin','Manitowoc',['54220'],'Manitowoc research professionals select our high-purity peptides with full lot documentation.']
  ],
  'massachusetts': [
    ['Brockton','brockton',105000,68000,3,'South Shore','Plymouth',['02301', '02302'],'Brockton research groups trust our lot-traceable compounds and complete certificates of analysis.'],
    ['Quincy','quincy',101000,85000,2,'Greater Boston','Norfolk',['02169', '02170', '02171'],'Quincy laboratories near Boston rely on our high-purity peptides for reproducible metabolic research.'],
    ['Lynn','lynn',100000,65000,3,'North Shore','Essex',['01902', '01904', '01905'],'Lynn research professionals select our documented compounds and transparent third-party analysis.'],
    ['Fall River','fall-river',94000,48000,3,'South Coast','Bristol',['02720', '02721', '02723', '02724'],'Fall River laboratories choose our lot-traceable peptides for longevity and recovery studies.'],
    ['Newton','newton',88000,165000,1,'Greater Boston','Middlesex',['02458', '02459', '02460'],'Newton research teams in affluent Middlesex County trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Somerville','somerville',80000,105000,2,'Greater Boston','Middlesex',['02143', '02144', '02145'],'Somerville laboratories near Cambridge select our high-purity peptides for reproducible metabolic research.'],
    ['Lawrence','lawrence',89000,45000,3,'Merrimack Valley','Essex',['01841', '01843'],'Lawrence research professionals source our cold-chain-handled compounds with full lot documentation.'],
    ['Framingham','framingham',71000,92000,2,'MetroWest','Middlesex',['01701', '01702'],'Framingham laboratories value our stability testing and full COA documentation.'],
    ['Waltham','waltham',65000,105000,2,'Greater Boston','Middlesex',['02451', '02452', '02453'],'Waltham research groups along the Route 128 tech corridor choose our high-purity peptides for metabolic and recovery studies.'],
    ['Haverhill','haverhill',67000,75000,3,'Merrimack Valley','Essex',['01830', '01832', '01835'],'Haverhill laboratories rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Malden','malden',65000,78000,2,'Greater Boston','Middlesex',['02148'],'Malden research teams select our documented compounds and transparent third-party analysis.'],
    ['Brookline','brookline',63000,125000,1,'Greater Boston','Norfolk',['02445', '02446'],'Brookline research professionals near the Longwood Medical Area source our cold-chain-handled compounds with full lot documentation.'],
    ['Plymouth','plymouth',61000,98000,2,'South Shore','Plymouth',['02360'],'Plymouth laboratories value our stability testing and full COA documentation on every compound lot.'],
    ['Medford','medford',62000,105000,2,'Greater Boston','Middlesex',['02155'],'Medford research groups near Tufts University rely on our high-purity peptides for reproducible cellular research.'],
    ['Weymouth','weymouth',57000,92000,2,'South Shore','Norfolk',['02188', '02189', '02190'],'Weymouth laboratories choose our lot-traceable peptides for longevity and recovery studies.'],
    ['Revere','revere',61000,70000,3,'Greater Boston','Suffolk',['02151'],'Revere research teams trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Peabody','peabody',54000,82000,3,'North Shore','Essex',['01960'],'Peabody research professionals select our high-purity peptides with full lot documentation.']
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
