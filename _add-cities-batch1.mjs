import fs from 'fs';
const DIR = process.argv[2];
if (!DIR) { console.error('usage: node add-cities-batch1.mjs <lib/cities/data>'); process.exit(1); }

// Accurate additions. Fields: name, slug, stateAbbr, population, medianIncome, tier, region, county, zips[], blurb
const BATCH = {
  kentucky: { state: 'Kentucky', stateSlug: 'kentucky', ab: 'KY', cities: [
    ['Anchorage','anchorage',2400,205000,1,'Louisville Metro','Jefferson',['40223'],'Anchorage is one of the Louisville metro wealthiest enclaves, whose private researchers select our high-purity peptides for guaranteed purity and full lot documentation.'],
    ['St. Matthews','st-matthews',18000,78000,2,'Louisville Metro','Jefferson',['40207'],'St. Matthews laboratories in eastern Louisville rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Jeffersontown','jeffersontown',28000,72000,2,'Louisville Metro','Jefferson',['40299'],'Jeffersontown research groups in the Louisville metro choose our verified-purity peptides for recovery and tissue-repair investigations.'],
    ['Crestwood','crestwood',6500,110000,1,'Louisville Metro','Oldham',['40014'],'Crestwood research professionals in affluent Oldham County trust our documented, lot-traceable compounds and transparent analysis.'],
    ['Shelbyville','shelbyville',16000,58000,3,'Louisville Metro','Shelby',['40065'],'Shelbyville laboratories in Kentucky horse country source our high-purity peptides backed by complete certificates of analysis.'],
    ['Elizabethtown','elizabethtown',31000,52000,3,'Central Kentucky','Hardin',['42701'],'Elizabethtown research teams in Hardin County select our high-purity peptides for reproducible metabolic research.'],
    ['Nicholasville','nicholasville',32000,62000,2,'Greater Lexington','Jessamine',['40356'],'Nicholasville laboratories in the Lexington metro rely on our verified purity and full third-party COAs.'],
    ['Georgetown','georgetown',37000,68000,2,'Greater Lexington','Scott',['40324'],'Georgetown research groups north of Lexington choose our lot-traceable peptides for longevity and recovery studies.'],
    ['Richmond','richmond',36000,45000,3,'Greater Lexington','Madison',['40475'],'Home to Eastern Kentucky University, Richmond laboratories source our high-purity peptides with complete certificates of analysis.'],
    ['Winchester','winchester',19000,48000,3,'Greater Lexington','Clark',['40391'],'Winchester research professionals in the Bluegrass region trust our documented compounds and transparent third-party analysis.'],
    ['Independence','independence',30000,82000,2,'Northern Kentucky','Kenton',['41051'],'Independence laboratories in the Cincinnati metro select our high-purity peptides for reproducible study protocols.'],
    ['Fort Thomas','fort-thomas',16000,95000,1,'Northern Kentucky','Campbell',['41075'],'Fort Thomas research groups in affluent Campbell County rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Paducah','paducah',27000,42000,3,'Western Kentucky','McCracken',['42001','42003'],'Paducah laboratories on the Ohio River choose our verified-purity peptides for metabolic and recovery research.'],
    ['Henderson','henderson',28000,45000,3,'Western Kentucky','Henderson',['42420'],'Henderson research teams in western Kentucky trust our documented, lot-traceable compounds and third-party COAs.'],
    ['Hopkinsville','hopkinsville',31000,44000,3,'Western Kentucky','Christian',['42240'],'Hopkinsville laboratories in the Pennyrile region source our high-purity peptides with full lot documentation.'],
    ['Murray','murray',17000,38000,3,'Western Kentucky','Calloway',['42071'],'Home to Murray State University, Murray research groups rely on our lot-traceable compounds for reproducible metabolic research.'],
    ['Ashland','ashland',21000,40000,3,'Eastern Kentucky','Boyd',['41101'],'Ashland laboratories in the Tri-State region select our high-purity peptides backed by complete certificates of analysis.'],
    ['Danville','danville',17000,46000,3,'Central Kentucky','Boyle',['40422'],'Home to Centre College, Danville research teams choose our verified-purity compounds with full lot documentation.'],
  ]},
  'west-virginia': { state: 'West Virginia', stateSlug: 'west-virginia', ab: 'WV', cities: [
    ['Parkersburg','parkersburg',29000,42000,3,'Mid-Ohio Valley','Wood',['26101'],'Parkersburg laboratories in the Mid-Ohio Valley source our high-purity peptides for metabolic and recovery research with third-party COAs.'],
    ['Vienna','vienna',10000,55000,2,'Mid-Ohio Valley','Wood',['26105'],'Vienna research groups near Parkersburg rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Beckley','beckley',16000,38000,3,'Southern West Virginia','Raleigh',['25801'],'Beckley research teams in southern West Virginia choose our verified-purity peptides for reproducible study protocols.'],
    ['Clarksburg','clarksburg',16000,40000,3,'North Central West Virginia','Harrison',['26301'],'Clarksburg laboratories in north-central West Virginia trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Fairmont','fairmont',18000,40000,3,'North Central West Virginia','Marion',['26554'],'Fairmont research professionals near Morgantown select our high-purity peptides with full lot documentation.'],
    ['Weirton','weirton',18000,45000,3,'Northern Panhandle','Hancock',['26062'],'Weirton laboratories in the Northern Panhandle source our lot-traceable peptides backed by complete certificates of analysis.'],
    ['South Charleston','south-charleston',13000,52000,3,'Charleston Metro','Kanawha',['25309'],'South Charleston research groups in the Kanawha Valley rely on our verified purity and transparent third-party analysis.'],
    ['Teays Valley','teays-valley',14000,72000,2,'Charleston Metro','Putnam',['25560'],'Teays Valley research teams in affluent Putnam County choose our high-purity peptides for longevity and recovery studies.'],
    ['Hurricane','hurricane',6500,62000,2,'Charleston Metro','Putnam',['25526'],'Hurricane laboratories in the Charleston metro trust our documented compounds and comprehensive certificates of analysis.'],
    ['Lewisburg','lewisburg',4000,48000,2,'Greenbrier Valley','Greenbrier',['24901'],'Lewisburg research groups in the Greenbrier Valley select our verified-purity compounds with full lot documentation.'],
  ]},
  mississippi: { state: 'Mississippi', stateSlug: 'mississippi', ab: 'MS', cities: [
    ['Southaven','southaven',55000,62000,2,'DeSoto County','DeSoto',['38671'],'Southaven laboratories in the Memphis metro rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Olive Branch','olive-branch',40000,70000,2,'DeSoto County','DeSoto',['38654'],'Olive Branch research groups in affluent DeSoto County choose our high-purity peptides for longevity and recovery studies.'],
    ['Hernando','hernando',16000,68000,2,'DeSoto County','DeSoto',['38632'],'Hernando research teams south of Memphis trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Tupelo','tupelo',38000,44000,3,'Northeast Mississippi','Lee',['38801','38804'],'Tupelo laboratories in northeast Mississippi source our high-purity peptides with full lot documentation.'],
    ['Meridian','meridian',35000,34000,3,'East Mississippi','Lauderdale',['39301','39305'],'Meridian research professionals in east Mississippi select our verified-purity peptides for reproducible metabolic research.'],
    ['Starkville','starkville',25000,34000,3,'Golden Triangle','Oktibbeha',['39759'],'Home to Mississippi State University, Starkville research groups rely on our lot-traceable compounds and third-party COAs.'],
    ['Columbus','columbus',24000,40000,3,'Golden Triangle','Lowndes',['39701','39702'],'Columbus laboratories in the Golden Triangle choose our high-purity peptides backed by complete certificates of analysis.'],
    ['Brandon','brandon',25000,72000,2,'Jackson Metro','Rankin',['39042','39047'],'Brandon research teams in affluent Rankin County trust our documented compounds and transparent third-party analysis.'],
    ['Clinton','clinton',28000,58000,2,'Jackson Metro','Hinds',['39056'],'Home to Mississippi College, Clinton laboratories source our verified-purity peptides with full lot documentation.'],
    ['Flowood','flowood',10000,78000,2,'Jackson Metro','Rankin',['39232'],'Flowood research groups in the Jackson metro select our high-purity peptides for longevity and recovery studies.'],
    ['Pascagoula','pascagoula',22000,42000,3,'Mississippi Gulf Coast','Jackson',['39567'],'Pascagoula laboratories on the Gulf Coast rely on our lot-traceable compounds for reproducible metabolic research.'],
    ['Ocean Springs','ocean-springs',18000,62000,2,'Mississippi Gulf Coast','Jackson',['39564'],'Ocean Springs research professionals on the Gulf Coast choose our verified-purity compounds with complete COAs.'],
    ['Vicksburg','vicksburg',21000,38000,3,'Southwest Mississippi','Warren',['39180'],'Vicksburg laboratories on the Mississippi River trust our documented, lot-traceable compounds and third-party analysis.'],
  ]},
  arkansas: { state: 'Arkansas', stateSlug: 'arkansas', ab: 'AR', cities: [
    ['Pine Bluff','pine-bluff',39000,38000,3,'Southeast Arkansas','Jefferson',['71601','71603'],'Pine Bluff laboratories in southeast Arkansas source our high-purity peptides for metabolic and recovery research with third-party COAs.'],
    ['Texarkana','texarkana',30000,40000,3,'Southwest Arkansas','Miller',['71854'],'Texarkana research groups on the Arkansas-Texas line rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Russellville','russellville',29000,42000,3,'Arkansas River Valley','Pope',['72801'],'Home to Arkansas Tech University, Russellville laboratories choose our verified-purity peptides for reproducible study protocols.'],
    ['Cabot','cabot',26000,68000,2,'Central Arkansas','Lonoke',['72023'],'Cabot research teams in the Little Rock metro trust our documented compounds and comprehensive certificates of analysis.'],
    ['Searcy','searcy',24000,44000,3,'Central Arkansas','White',['72143'],'Home to Harding University, Searcy research groups select our high-purity peptides with full lot documentation.'],
    ['Van Buren','van-buren',23000,48000,3,'Fort Smith Metro','Crawford',['72956'],'Van Buren laboratories in the Fort Smith metro source our lot-traceable peptides backed by complete certificates of analysis.'],
    ['Jacksonville','jacksonville',29000,52000,3,'Central Arkansas','Pulaski',['72076'],'Jacksonville research professionals north of Little Rock rely on our verified purity and transparent third-party analysis.'],
    ['El Dorado','el-dorado',17000,42000,3,'South Arkansas','Union',['71730'],'El Dorado laboratories in south Arkansas choose our high-purity peptides for longevity and recovery studies.'],
  ]},
  iowa: { state: 'Iowa', stateSlug: 'iowa', ab: 'IA', cities: [
    ['Waterloo','waterloo',67000,48000,3,'Cedar Valley','Black Hawk',['50701','50702'],'Waterloo laboratories in the Cedar Valley source our high-purity peptides for metabolic and recovery research with third-party COAs.'],
    ['Cedar Falls','cedar-falls',40000,55000,2,'Cedar Valley','Black Hawk',['50613'],'Home to the University of Northern Iowa, Cedar Falls research groups rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Dubuque','dubuque',59000,52000,3,'Eastern Iowa','Dubuque',['52001','52002'],'Dubuque research teams on the Mississippi River choose our verified-purity peptides for reproducible study protocols.'],
    ['Bettendorf','bettendorf',39000,78000,2,'Quad Cities','Scott',['52722'],'Bettendorf laboratories in the affluent Quad Cities trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Marion','marion',41000,72000,2,'Cedar Rapids Metro','Linn',['52302'],'Marion research professionals in the Cedar Rapids metro select our high-purity peptides with full lot documentation.'],
    ['Mason City','mason-city',27000,48000,3,'North Central Iowa','Cerro Gordo',['50401'],'Mason City laboratories in north-central Iowa source our lot-traceable peptides backed by complete certificates of analysis.'],
    ['Marshalltown','marshalltown',27000,48000,3,'Central Iowa','Marshall',['50158'],'Marshalltown research groups in central Iowa rely on our verified purity and transparent third-party analysis.'],
    ['Muscatine','muscatine',24000,52000,3,'Eastern Iowa','Muscatine',['52761'],'Muscatine laboratories on the Mississippi River choose our high-purity peptides for reproducible metabolic research.'],
    ['Fort Dodge','fort-dodge',24000,44000,3,'North Central Iowa','Webster',['50501'],'Fort Dodge research teams in north-central Iowa trust our documented compounds and comprehensive certificates of analysis.'],
  ]},
};

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
function fmt(c, meta) {
  const [name,slug,pop,inc,tier,region,county,zips,blurb] = c;
  const z = zips.map(x=>`'${x}'`).join(', ');
  return `  { name: '${esc(name)}', slug: '${slug}', state: '${meta.state}', stateSlug: '${meta.stateSlug}', stateAbbr: '${meta.ab}', population: ${pop}, medianIncome: ${inc}, tier: ${tier}, region: '${esc(region)}', county: '${esc(county)}', zips: [${z}], localBlurb: '${esc(blurb)}' },`;
}

const report = {};
for (const [slug, meta] of Object.entries(BATCH)) {
  const file = `${DIR}/${slug}.ts`;
  let src = fs.readFileSync(file, 'utf8');
  // guard: skip any city whose slug already exists
  const existing = new Set([...src.matchAll(/slug: '([^']+)'/g)].map(m=>m[1]));
  const toAdd = meta.cities.filter(c => !existing.has(c[1]));
  const skipped = meta.cities.filter(c => existing.has(c[1])).map(c=>c[1]);
  const lines = toAdd.map(c => fmt(c, meta)).join('\n');
  // insert before the closing "];" of the array
  const idx = src.lastIndexOf('\n];');
  if (idx < 0) { console.error('no array close in', file); continue; }
  src = src.slice(0, idx) + '\n' + lines + src.slice(idx);
  fs.writeFileSync(file, src);
  report[slug] = { added: toAdd.length, skipped };
}
console.log(JSON.stringify(report, null, 2));
