import fs from 'fs';
const DIR = process.argv[2];
// name, slug, pop, income, tier, region, county, [zips], bespoke local blurb
const CITIES = [
  // Philadelphia metro
  ['Norristown','norristown',35000,45000,3,'Greater Philadelphia','Montgomery',['19401'],'Norristown is the Montgomery County seat, a Schuylkill River hub anchoring the research corridor northwest of Philadelphia.'],
  ['Phoenixville','phoenixville',20000,78000,2,'Greater Philadelphia','Chester',['19460'],'Phoenixville is a revitalized former steel town on the Schuylkill, now one of the fastest-growing communities in Chester County.'],
  ['Lansdale','lansdale',19000,72000,2,'Greater Philadelphia','Montgomery',['19446'],'Lansdale is a rail-line borough in central Montgomery County, a commuter hub for the North Penn Valley.'],
  ['Abington','abington',56000,88000,2,'Greater Philadelphia','Montgomery',['19001'],'Abington anchors the Old York Road corridor in eastern Montgomery County, home to Abington-Jefferson Health.'],
  ['Cheltenham','cheltenham',37000,82000,2,'Greater Philadelphia','Montgomery',['19012'],'Cheltenham is an inner-ring Montgomery County township bordering Northeast Philadelphia.'],
  ['Havertown','havertown',37000,105000,1,'Main Line','Delaware',['19083'],'Havertown is an affluent Delaware County community along the Main Line, minutes from Philadelphia via the R100 line.'],
  ['Drexel Hill','drexel-hill',30000,72000,3,'Greater Philadelphia','Delaware',['19026'],'Drexel Hill is a dense residential section of Upper Darby in Delaware County, on Philadelphia western edge.'],
  ['Warminster','warminster',33000,82000,2,'Bucks County','Bucks',['18974'],'Warminster is a Bucks County township along the former Naval Air Warfare Center research campus.'],
  ['Levittown','levittown',52000,75000,3,'Bucks County','Bucks',['19054'],'Levittown is a large planned Bucks County community on the Delaware River northeast of Philadelphia.'],
  ['Horsham','horsham',26000,95000,2,'Greater Philadelphia','Montgomery',['19044'],'Horsham is a Montgomery County business hub anchoring a pharmaceutical and life-sciences corridor.'],
  ['Blue Bell','blue-bell',6000,130000,1,'Greater Philadelphia','Montgomery',['19422'],'Blue Bell is an affluent Whitpain Township community, home to a cluster of corporate and research campuses.'],
  ['Collegeville','collegeville',6000,105000,1,'Greater Philadelphia','Montgomery',['19426'],'Collegeville, home to Ursinus College, sits in a fast-growing pharmaceutical corridor along the upper Perkiomen.'],
  ['Downingtown','downingtown',8000,92000,2,'Greater Philadelphia','Chester',['19335'],'Downingtown is a historic Chester County borough on the Brandywine, in one of the wealthiest counties in the state.'],
  ['Exton','exton',5000,98000,2,'Greater Philadelphia','Chester',['19341'],'Exton is a West Whiteland commercial crossroads in Chester County along the US-30 corridor.'],
  ['Kennett Square','kennett-square',6500,82000,2,'Greater Philadelphia','Chester',['19348'],'Kennett Square, the mushroom capital of the country, anchors southern Chester County near Longwood Gardens.'],
  ['Pottstown','pottstown',23000,48000,3,'Greater Philadelphia','Montgomery',['19464'],'Pottstown is a Schuylkill River borough at the western edge of the Philadelphia metro in Montgomery County.'],
  ['Chester','chester',33000,34000,3,'Greater Philadelphia','Delaware',['19013'],'Chester, the oldest city in Pennsylvania, is a Delaware River port and home to Widener University.'],
  ['Yardley','yardley',2600,120000,1,'Bucks County','Bucks',['19067'],'Yardley is an affluent Delaware River borough in lower Bucks County near the New Jersey line.'],
  ['Jenkintown','jenkintown',4700,95000,1,'Greater Philadelphia','Montgomery',['19046'],'Jenkintown is a walkable, affluent Montgomery County borough on the Old York Road rail corridor.'],
  // Pittsburgh metro
  ['Bethel Park','bethel-park',33000,78000,2,'Greater Pittsburgh','Allegheny',['15102'],'Bethel Park is a residential South Hills municipality anchoring Pittsburgh affluent southern suburbs.'],
  ['Wexford','wexford',12000,130000,1,'Greater Pittsburgh','Allegheny',['15090'],'Wexford is an affluent North Hills community in Pine Township along the I-79 corridor north of Pittsburgh.'],
  ['McMurray','mcmurray',24000,120000,1,'Greater Pittsburgh','Washington',['15317'],'McMurray anchors affluent Peters Township in Washington County, a top-rated South Hills suburb of Pittsburgh.'],
  ['Monroeville','monroeville',28000,62000,2,'Greater Pittsburgh','Allegheny',['15146'],'Monroeville is an eastern Allegheny County commercial hub anchoring a medical and technology corridor.'],
  ['Murrysville','murrysville',20000,95000,2,'Greater Pittsburgh','Westmoreland',['15668'],'Murrysville is an affluent Westmoreland County community in the eastern Pittsburgh suburbs.'],
  ['Moon','moon',25000,78000,2,'Greater Pittsburgh','Allegheny',['15108'],'Moon Township sits beside Pittsburgh International Airport and Robert Morris University in western Allegheny County.'],
  ['McCandless','mccandless',29000,92000,2,'Greater Pittsburgh','Allegheny',['15237'],'McCandless is an affluent North Hills town in Allegheny County north of Pittsburgh.'],
  ['Greensburg','greensburg',15000,48000,3,'Greater Pittsburgh','Westmoreland',['15601'],'Greensburg is the Westmoreland County seat and cultural hub of the southwestern Pennsylvania Laurel Highlands.'],
  ['Washington','washington-pa',13000,38000,3,'Greater Pittsburgh','Washington',['15301'],'Washington, home to Washington and Jefferson College, is the county seat southwest of Pittsburgh.'],
  ['Butler','butler',13000,44000,3,'Western Pennsylvania','Butler',['16001'],'Butler is the seat of fast-growing Butler County, north of the Pittsburgh metro.'],
  ['Indiana','indiana',14000,38000,3,'Western Pennsylvania','Indiana',['15701'],'Indiana, home to Indiana University of Pennsylvania, is a college town in the western Pennsylvania highlands.'],
  ['New Castle','new-castle',21000,34000,3,'Western Pennsylvania','Lawrence',['16101'],'New Castle is the Lawrence County seat at the confluence of the Shenango and Neshannock in western Pennsylvania.'],
  ['Sharon','sharon',13000,34000,3,'Western Pennsylvania','Mercer',['16146'],'Sharon is a Shenango Valley steel-heritage city in Mercer County on the Ohio border.'],
  // Lehigh Valley + Northeast
  ['Easton','easton',28000,52000,3,'Lehigh Valley','Northampton',['18042'],'Easton, home to Lafayette College, sits at the forks of the Delaware anchoring the eastern Lehigh Valley.'],
  ['Wilkes-Barre','wilkes-barre',44000,40000,3,'Northeastern Pennsylvania','Luzerne',['18701'],'Wilkes-Barre is the Luzerne County seat and, with Scranton, anchors the Wyoming Valley.'],
  ['Hazleton','hazleton',30000,42000,3,'Northeastern Pennsylvania','Luzerne',['18201'],'Hazleton is a mountaintop former anthracite city in southern Luzerne County.'],
  ['Stroudsburg','stroudsburg',6000,52000,3,'Poconos','Monroe',['18360'],'Stroudsburg is the Monroe County seat and commercial gateway to the Pocono Mountains.'],
  // Central + South Central
  ['Hershey','hershey',14000,78000,2,'Central Pennsylvania','Dauphin',['17033'],'Hershey pairs its chocolate heritage with the Penn State Health Milton S. Hershey Medical Center campus.'],
  ['Mechanicsburg','mechanicsburg',9000,72000,2,'Central Pennsylvania','Cumberland',['17055'],'Mechanicsburg is an affluent Cumberland County borough on the Harrisburg West Shore.'],
  ['Carlisle','carlisle',20000,52000,3,'Central Pennsylvania','Cumberland',['17013'],'Carlisle, home to Dickinson College and the U.S. Army War College, is the Cumberland County seat.'],
  ['Chambersburg','chambersburg',21000,48000,3,'South Central Pennsylvania','Franklin',['17201'],'Chambersburg is the Franklin County seat in the Cumberland Valley of south-central Pennsylvania.'],
  ['Hanover','hanover',16000,55000,3,'South Central Pennsylvania','York',['17331'],'Hanover is a York County manufacturing borough near the Maryland line in south-central Pennsylvania.'],
  ['Gettysburg','gettysburg',7500,45000,3,'South Central Pennsylvania','Adams',['17325'],'Gettysburg, home to Gettysburg College and the national battlefield, is the Adams County seat.'],
  ['Wyomissing','wyomissing',11000,88000,2,'Berks County','Berks',['19610'],'Wyomissing is an affluent, planned Berks County borough on the western edge of Reading.'],
  ['Lebanon','lebanon-pa',26000,44000,3,'South Central Pennsylvania','Lebanon',['17042'],'Lebanon is the seat of Lebanon County in the fertile Lebanon Valley between Harrisburg and Reading.'],
  ['Williamsport','williamsport',27000,40000,3,'North Central Pennsylvania','Lycoming',['17701'],'Williamsport, birthplace of Little League and home to Lycoming College, anchors the West Branch Susquehanna Valley.'],
  ['Altoona','altoona',43000,42000,3,'Central Pennsylvania','Blair',['16601'],'Altoona is a railroad city in the Allegheny Mountains and the seat of Blair County.'],
  ['Johnstown','johnstown',18000,34000,3,'Western Pennsylvania','Cambria',['15901'],'Johnstown is a Cambria County steel-heritage city in the Conemaugh Valley of the Laurel Highlands.'],
  ['Bloomsburg','bloomsburg',14000,42000,3,'Central Pennsylvania','Columbia',['17815'],'Bloomsburg, home to a Commonwealth University campus, is the only incorporated town in Pennsylvania and the Columbia County seat.'],
  ['Pottsville','pottsville',13000,40000,3,'Coal Region','Schuylkill',['17901'],'Pottsville, home to the Yuengling brewery, is the Schuylkill County seat in the anthracite Coal Region.'],
  ['Sunbury','sunbury',9000,40000,3,'Central Pennsylvania','Northumberland',['17801'],'Sunbury is a Susquehanna River city and the Northumberland County seat in central Pennsylvania.'],
  ['Springfield','springfield-pa',24000,98000,2,'Main Line','Delaware',['19064'],'Springfield is an affluent residential township in Delaware County near the Main Line.'],
];
const esc=(s)=>s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
const meta={state:'Pennsylvania',stateSlug:'pennsylvania',ab:'PA'};
function fmt(c){const [name,slug,pop,inc,tier,region,county,zips,blurb]=c;const z=zips.map(x=>`'${x}'`).join(', ');return `  { name: '${esc(name)}', slug: '${slug}', state: '${meta.state}', stateSlug: '${meta.stateSlug}', stateAbbr: '${meta.ab}', population: ${pop}, medianIncome: ${inc}, tier: ${tier}, region: '${esc(region)}', county: '${esc(county)}', zips: [${z}], localBlurb: '${esc(blurb)}' },`;}
const file=`${DIR}/pennsylvania.ts`; let src=fs.readFileSync(file,'utf8');
const existing=new Set([...src.matchAll(/slug: '([^']+)'/g)].map(m=>m[1]));
const toAdd=CITIES.filter(c=>!existing.has(c[1])); const skipped=CITIES.filter(c=>existing.has(c[1])).map(c=>c[1]);
const idx=src.lastIndexOf('\n];'); src=src.slice(0,idx)+'\n'+toAdd.map(fmt).join('\n')+src.slice(idx);
fs.writeFileSync(file,src);
console.log(JSON.stringify({added:toAdd.length, skipped, total_after: existing.size+toAdd.length},null,2));
