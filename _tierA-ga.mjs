import fs from 'fs';
const DIR = process.argv[2];
const CITIES = [
  // Atlanta metro
  ['Peachtree Corners','peachtree-corners',45000,95000,2,'Metro Atlanta','Gwinnett',['30092'],'Peachtree Corners is an affluent Gwinnett County technology hub along the Peachtree Industrial corridor.'],
  ['Norcross','norcross',17000,58000,3,'Metro Atlanta','Gwinnett',['30071','30093'],'Norcross is a historic railroad town in Gwinnett County northeast of Atlanta.'],
  ['Lilburn','lilburn',13000,62000,3,'Metro Atlanta','Gwinnett',['30047'],'Lilburn is a diverse Gwinnett County suburb along the US-29 corridor.'],
  ['Sugar Hill','sugar-hill',25000,82000,2,'Metro Atlanta','Gwinnett',['30518'],'Sugar Hill is a fast-growing northern Gwinnett County city near Lake Lanier.'],
  ['Grayson','grayson',5000,95000,2,'Metro Atlanta','Gwinnett',['30017'],'Grayson is an affluent, family-oriented city in eastern Gwinnett County.'],
  ['Loganville','loganville',15000,72000,2,'Metro Atlanta','Walton',['30052'],'Loganville straddles Walton and Gwinnett counties on Atlanta eastern edge.'],
  ['Powder Springs','powder-springs',15000,72000,2,'Metro Atlanta','Cobb',['30127'],'Powder Springs is a growing city in western Cobb County southwest of Marietta.'],
  ['Mableton','mableton',41000,62000,3,'Metro Atlanta','Cobb',['30126'],'Mableton is a large community in southern Cobb County along the Chattahoochee.'],
  ['Austell','austell',7000,52000,3,'Metro Atlanta','Cobb',['30106','30168'],'Austell is a rail-heritage city in southwest Cobb County near Six Flags.'],
  ['Union City','union-city',24000,52000,3,'Metro Atlanta','Fulton',['30291'],'Union City is a south Fulton County city along the I-85 corridor.'],
  ['East Point','east-point',39000,52000,3,'Metro Atlanta','Fulton',['30344'],'East Point borders Hartsfield-Jackson airport just southwest of downtown Atlanta.'],
  ['College Park','college-park',15000,45000,3,'Metro Atlanta','Fulton',['30337','30349'],'College Park sits at Hartsfield-Jackson airport, home to the Georgia International Convention Center.'],
  ['Chamblee','chamblee',30000,72000,2,'Metro Atlanta','DeKalb',['30341'],'Chamblee is a revitalized inner-ring DeKalb County city along the MARTA line north of Atlanta.'],
  ['Doraville','doraville',10000,55000,3,'Metro Atlanta','DeKalb',['30340','30360'],'Doraville is a diverse DeKalb County city redeveloping the former GM Assembly plant.'],
  ['Conyers','conyers',17000,52000,3,'Metro Atlanta','Rockdale',['30012','30013'],'Conyers is the Rockdale County seat east of Atlanta along I-20.'],
  ['Covington','covington',15000,52000,3,'Metro Atlanta','Newton',['30014','30016'],'Covington is the Newton County seat, a filming hub known as the Hollywood of the South.'],
  ['Jonesboro','jonesboro',5000,48000,3,'Metro Atlanta','Clayton',['30236','30238'],'Jonesboro is the Clayton County seat south of Atlanta.'],
  ['Fairburn','fairburn',16000,58000,3,'Metro Atlanta','Fulton',['30213'],'Fairburn is a fast-growing south Fulton County city along the I-85 logistics corridor.'],
  // Regional
  ['Cartersville','cartersville',24000,52000,3,'Northwest Georgia','Bartow',['30120','30121'],'Cartersville is the Bartow County seat in the northwest Georgia foothills along I-75.'],
  ['Dalton','dalton',34000,42000,3,'Northwest Georgia','Whitfield',['30720','30721'],'Dalton, the carpet capital of the world, is the Whitfield County seat near the Tennessee line.'],
  ['Calhoun','calhoun',17000,48000,3,'Northwest Georgia','Gordon',['30701'],'Calhoun is the Gordon County seat in the northwest Georgia carpet-manufacturing belt.'],
  ['LaGrange','lagrange',31000,44000,3,'West Georgia','Troup',['30240','30241'],'LaGrange is the Troup County seat near West Point Lake on the Alabama line.'],
  ['Dublin','dublin',16000,40000,3,'Middle Georgia','Laurens',['31021'],'Dublin is the Laurens County seat on the Oconee River in Middle Georgia.'],
  ['Thomasville','thomasville',18000,45000,3,'South Georgia','Thomas',['31792'],'Thomasville is a historic plantation-country city and the Thomas County seat in South Georgia.'],
  ['Tifton','tifton',17000,40000,3,'South Georgia','Tift',['31794'],'Tifton, home to Abraham Baldwin Agricultural College, is the Tift County seat in South Georgia.'],
  ['Milledgeville','milledgeville',17000,38000,3,'Middle Georgia','Baldwin',['31061'],'Milledgeville, the antebellum state capital and home of Georgia College, is the Baldwin County seat.'],
  ['Waycross','waycross',13000,36000,3,'Southeast Georgia','Ware',['31501'],'Waycross is the Ware County seat at the edge of the Okefenokee Swamp in southeast Georgia.'],
  ['Brunswick','brunswick',16000,38000,3,'Coastal Georgia','Glynn',['31520','31525'],'Brunswick is a coastal port and the Glynn County seat, gateway to the Golden Isles.'],
  ['Douglas','douglas',12000,40000,3,'South Georgia','Coffee',['31533'],'Douglas is the Coffee County seat in the South Georgia agricultural plain.'],
];
const esc=(s)=>s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
const meta={state:'Georgia',stateSlug:'georgia',ab:'GA'};
function fmt(c){const [name,slug,pop,inc,tier,region,county,zips,blurb]=c;const z=zips.map(x=>`'${x}'`).join(', ');return `  { name: '${esc(name)}', slug: '${slug}', state: '${meta.state}', stateSlug: '${meta.stateSlug}', stateAbbr: '${meta.ab}', population: ${pop}, medianIncome: ${inc}, tier: ${tier}, region: '${esc(region)}', county: '${esc(county)}', zips: [${z}], localBlurb: '${esc(blurb)}' },`;}
const file=`${DIR}/georgia.ts`; let src=fs.readFileSync(file,'utf8');
const existing=new Set([...src.matchAll(/slug: '([^']+)'/g)].map(m=>m[1]));
const toAdd=CITIES.filter(c=>!existing.has(c[1])); const skipped=CITIES.filter(c=>existing.has(c[1])).map(c=>c[1]);
const idx=src.lastIndexOf('\n];'); src=src.slice(0,idx)+'\n'+toAdd.map(fmt).join('\n')+src.slice(idx);
fs.writeFileSync(file,src);
console.log(JSON.stringify({added:toAdd.length, skipped, total_after: existing.size+toAdd.length},null,2));
