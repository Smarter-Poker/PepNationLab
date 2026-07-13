import fs from 'fs';
const DIR = process.argv[2];
const CITIES = [
  // Columbus metro
  ['Reynoldsburg','reynoldsburg',41000,62000,3,'Greater Columbus','Franklin',['43068'],'Reynoldsburg is an eastern Franklin County suburb, the self-styled birthplace of the tomato, along the US-40 National Road.'],
  ['Bexley','bexley',13000,120000,1,'Greater Columbus','Franklin',['43209'],'Bexley is an affluent, tree-lined enclave bordering east Columbus, home to Capital University.'],
  ['Grandview Heights','grandview-heights',8000,110000,1,'Greater Columbus','Franklin',['43212'],'Grandview Heights is a walkable, affluent inner-ring Columbus suburb beside the Scioto River.'],
  ['Whitehall','whitehall',20000,45000,3,'Greater Columbus','Franklin',['43213'],'Whitehall is an eastside Franklin County city adjacent to the former Defense Supply Center Columbus.'],
  ['Canal Winchester','canal-winchester',9500,78000,2,'Greater Columbus','Franklin',['43110'],'Canal Winchester is a fast-growing town on the Columbus southeast edge straddling Franklin and Fairfield counties.'],
  ['Newark','newark',50000,50000,3,'Greater Columbus','Licking',['43055'],'Newark is the Licking County seat east of Columbus, home to a shared Ohio State and COTC campus.'],
  ['Lancaster','lancaster',40000,52000,3,'Greater Columbus','Fairfield',['43130'],'Lancaster is the Fairfield County seat at the edge of the Hocking Hills, southeast of Columbus.'],
  ['Marysville','marysville',26000,72000,2,'Greater Columbus','Union',['43040'],'Marysville is the Union County seat northwest of Columbus, home to Honda of America manufacturing.'],
  // Cleveland metro
  ['Parma','parma',80000,58000,3,'Greater Cleveland','Cuyahoga',['44134'],'Parma is the largest suburb of Cleveland, a residential city in southern Cuyahoga County.'],
  ['Lakewood','lakewood',50000,62000,2,'Greater Cleveland','Cuyahoga',['44107'],'Lakewood is a dense, walkable lakefront city immediately west of Cleveland on Lake Erie.'],
  ['Euclid','euclid',48000,42000,3,'Greater Cleveland','Cuyahoga',['44117'],'Euclid is a Lake Erie industrial suburb on Cleveland northeast side in Cuyahoga County.'],
  ['Mentor','mentor',47000,72000,2,'Greater Cleveland','Lake',['44060'],'Mentor is the largest city in Lake County, a lakefront suburb east of Cleveland.'],
  ['Willoughby','willoughby',23000,62000,2,'Greater Cleveland','Lake',['44094'],'Willoughby is a historic Chagrin River suburb in Lake County east of Cleveland.'],
  ['Cleveland Heights','cleveland-heights',44000,58000,3,'Greater Cleveland','Cuyahoga',['44118'],'Cleveland Heights is a diverse inner-ring suburb bordering University Circle and its medical campuses.'],
  ['North Olmsted','north-olmsted',32000,68000,2,'Greater Cleveland','Cuyahoga',['44070'],'North Olmsted is a west-side Cuyahoga County suburb along the I-480 corridor.'],
  ['Avon','avon',25000,105000,2,'Greater Cleveland','Lorain',['44011'],'Avon is a fast-growing, affluent Lorain County suburb west of Cleveland.'],
  ['Avon Lake','avon-lake',25000,110000,1,'Greater Cleveland','Lorain',['44012'],'Avon Lake is an affluent Lake Erie community in Lorain County west of Cleveland.'],
  ['Brecksville','brecksville',13000,115000,1,'Greater Cleveland','Cuyahoga',['44141'],'Brecksville is an affluent southern Cuyahoga County suburb beside the Cuyahoga Valley National Park.'],
  ['Hudson','hudson',23000,145000,1,'Greater Cleveland','Summit',['44236'],'Hudson is one of Ohio wealthiest communities, a historic Western Reserve town in northern Summit County.'],
  ['Chagrin Falls','chagrin-falls',4000,120000,1,'Greater Cleveland','Cuyahoga',['44022'],'Chagrin Falls is a picturesque, affluent village around its namesake waterfall southeast of Cleveland.'],
  ['Bay Village','bay-village',15000,120000,1,'Greater Cleveland','Cuyahoga',['44140'],'Bay Village is an affluent lakefront Cuyahoga County suburb on Cleveland far west side.'],
  // Cincinnati metro
  ['Hamilton','hamilton',63000,48000,3,'Greater Cincinnati','Butler',['45011'],'Hamilton is the Butler County seat on the Great Miami River north of Cincinnati.'],
  ['Fairfield','fairfield',45000,62000,2,'Greater Cincinnati','Butler',['45014'],'Fairfield is a Butler County suburb between Hamilton and Cincinnati along the Route 4 corridor.'],
  ['Norwood','norwood',19000,45000,3,'Greater Cincinnati','Hamilton',['45212'],'Norwood is an urban enclave entirely surrounded by the city of Cincinnati in Hamilton County.'],
  ['Indian Hill','indian-hill',6000,200000,1,'Greater Cincinnati','Hamilton',['45243'],'Indian Hill is the wealthiest community in the Cincinnati metro, an equestrian village in eastern Hamilton County.'],
  ['Madeira','madeira',9000,130000,1,'Greater Cincinnati','Hamilton',['45243'],'Madeira is an affluent, family-oriented suburb on Cincinnati east side in Hamilton County.'],
  ['Sharonville','sharonville',14000,62000,2,'Greater Cincinnati','Hamilton',['45241'],'Sharonville is a northern Hamilton County suburb anchoring a convention and business corridor.'],
  ['Milford','milford-oh',7000,68000,2,'Greater Cincinnati','Clermont',['45150'],'Milford is a Little Miami River town in Clermont County on Cincinnati eastern edge.'],
  ['Wyoming','wyoming-oh',8500,150000,1,'Greater Cincinnati','Hamilton',['45215'],'Wyoming is a small, affluent, historic residential city north of Cincinnati in Hamilton County.'],
  // Akron / Canton
  ['Cuyahoga Falls','cuyahoga-falls',51000,58000,3,'Northeast Ohio','Summit',['44221'],'Cuyahoga Falls is a Summit County city on the Cuyahoga River bordering Akron.'],
  ['Stow','stow',35000,78000,2,'Northeast Ohio','Summit',['44224'],'Stow is a residential Summit County suburb between Akron and Kent.'],
  ['Massillon','massillon',32000,45000,3,'Northeast Ohio','Stark',['44646'],'Massillon is a Tuscarawas River city in Stark County west of Canton.'],
  ['North Canton','north-canton',17000,62000,2,'Northeast Ohio','Stark',['44720'],'North Canton is an affluent Stark County suburb, the home of Walsh University.'],
  ['Green','green',27000,78000,2,'Northeast Ohio','Summit',['44685'],'Green is a growing suburb in southern Summit County between Akron and Canton.'],
  // Dayton
  ['Beavercreek','beavercreek',48000,82000,2,'Miami Valley','Greene',['45431'],'Beavercreek is the largest suburb of Dayton, a Greene County city beside Wright-Patterson Air Force Base.'],
  ['Centerville','centerville',24000,78000,2,'Miami Valley','Montgomery',['45459'],'Centerville is an affluent southern Montgomery County suburb of Dayton.'],
  ['Springboro','springboro',19000,105000,1,'Miami Valley','Warren',['45066'],'Springboro is an affluent, fast-growing community straddling Warren and Montgomery counties south of Dayton.'],
  ['Miamisburg','miamisburg',20000,58000,3,'Miami Valley','Montgomery',['45342'],'Miamisburg is a Great Miami River city in Montgomery County, home to the former Mound research site.'],
  ['Oakwood','oakwood',9000,150000,1,'Miami Valley','Montgomery',['45419'],'Oakwood is one of the wealthiest suburbs of Dayton, an affluent enclave in Montgomery County.'],
  // Toledo
  ['Sylvania','sylvania',19000,82000,2,'Northwest Ohio','Lucas',['43560'],'Sylvania is an affluent northwestern Lucas County suburb of Toledo.'],
  ['Perrysburg','perrysburg',25000,88000,2,'Northwest Ohio','Wood',['43551'],'Perrysburg is an affluent Maumee River suburb of Toledo in Wood County.'],
  ['Maumee','maumee',14000,62000,2,'Northwest Ohio','Lucas',['43537'],'Maumee is a Maumee River city in Lucas County anchoring Toledo southwestern suburbs.'],
  // College / regional
  ['Athens','athens-oh',24000,32000,3,'Southeast Ohio','Athens',['45701'],'Athens is home to Ohio University in the Appalachian foothills of southeast Ohio.'],
  ['Oxford','oxford',23000,42000,3,'Greater Cincinnati','Butler',['45056'],'Oxford is home to Miami University in the rolling farmland of northwest Butler County.'],
  ['Kent','kent',28000,40000,3,'Northeast Ohio','Portage',['44240'],'Kent is home to Kent State University on the Cuyahoga River in Portage County.'],
  ['Bowling Green','bowling-green-oh',31000,44000,3,'Northwest Ohio','Wood',['43402'],'Bowling Green is home to Bowling Green State University and the Wood County seat.'],
  ['Findlay','findlay',40000,55000,3,'Northwest Ohio','Hancock',['45840'],'Findlay is the Hancock County seat and corporate home of Marathon Petroleum in northwest Ohio.'],
  ['Lima','lima',36000,38000,3,'Northwest Ohio','Allen',['45801'],'Lima is the Allen County seat and industrial hub of the northwest Ohio Grand Lake region.'],
  ['Mansfield','mansfield',47000,42000,3,'North Central Ohio','Richland',['44902'],'Mansfield is the Richland County seat midway between Columbus and Cleveland.'],
  ['Elyria','elyria',52000,45000,3,'Greater Cleveland','Lorain',['44035'],'Elyria is the Lorain County seat at the forks of the Black River southwest of Cleveland.'],
];
const esc=(s)=>s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
const meta={state:'Ohio',stateSlug:'ohio',ab:'OH'};
function fmt(c){const [name,slug,pop,inc,tier,region,county,zips,blurb]=c;const z=zips.map(x=>`'${x}'`).join(', ');return `  { name: '${esc(name)}', slug: '${slug}', state: '${meta.state}', stateSlug: '${meta.stateSlug}', stateAbbr: '${meta.ab}', population: ${pop}, medianIncome: ${inc}, tier: ${tier}, region: '${esc(region)}', county: '${esc(county)}', zips: [${z}], localBlurb: '${esc(blurb)}' },`;}
const file=`${DIR}/ohio.ts`; let src=fs.readFileSync(file,'utf8');
const existing=new Set([...src.matchAll(/slug: '([^']+)'/g)].map(m=>m[1]));
const toAdd=CITIES.filter(c=>!existing.has(c[1])); const skipped=CITIES.filter(c=>existing.has(c[1])).map(c=>c[1]);
const idx=src.lastIndexOf('\n];'); src=src.slice(0,idx)+'\n'+toAdd.map(fmt).join('\n')+src.slice(idx);
fs.writeFileSync(file,src);
console.log(JSON.stringify({added:toAdd.length, skipped, total_after: existing.size+toAdd.length},null,2));
