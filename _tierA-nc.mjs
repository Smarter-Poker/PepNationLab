import fs from 'fs';
const DIR = process.argv[2];
const CITIES = [
  // Charlotte metro
  ['Belmont','belmont',16000,62000,3,'Greater Charlotte','Gaston',['28012'],'Belmont is a Catawba River city in Gaston County just west of Charlotte, home to Belmont Abbey College.'],
  ['Mint Hill','mint-hill',28000,88000,2,'Greater Charlotte','Mecklenburg',['28227'],'Mint Hill is a residential town on Charlotte southeastern edge in Mecklenburg County.'],
  ['Pineville','pineville',10000,62000,3,'Greater Charlotte','Mecklenburg',['28134'],'Pineville is a small Mecklenburg County town anchoring Charlotte southern retail corridor.'],
  ['Monroe','monroe',36000,52000,3,'Greater Charlotte','Union',['28110'],'Monroe is the Union County seat southeast of Charlotte in the fast-growing I-74 corridor.'],
  ['Harrisburg','harrisburg-nc',20000,98000,2,'Greater Charlotte','Cabarrus',['28075'],'Harrisburg is an affluent, fast-growing Cabarrus County suburb northeast of Charlotte.'],
  ['Stallings','stallings',18000,95000,2,'Greater Charlotte','Union',['28104'],'Stallings is an affluent Union County town on the southeastern edge of the Charlotte metro.'],
  ['Denver','denver-nc',7000,88000,2,'Greater Charlotte','Lincoln',['28037'],'Denver is a fast-growing Lake Norman community in Lincoln County northwest of Charlotte.'],
  ['Mount Holly','mount-holly',18000,58000,3,'Greater Charlotte','Gaston',['28120'],'Mount Holly is a Catawba River city in Gaston County across from northwest Charlotte.'],
  ['Shelby','shelby',22000,42000,3,'Greater Charlotte','Cleveland',['28150'],'Shelby is the Cleveland County seat in the foothills west of Charlotte.'],
  ['Lincolnton','lincolnton',11000,45000,3,'Greater Charlotte','Lincoln',['28092'],'Lincolnton is the Lincoln County seat in the western Charlotte metro foothills.'],
  // Research Triangle
  ['Garner','garner',33000,72000,2,'Research Triangle','Wake',['27529'],'Garner is a Wake County suburb on Raleigh southern edge in the Research Triangle.'],
  ['Clayton','clayton',28000,78000,2,'Research Triangle','Johnston',['27520'],'Clayton is a fast-growing Johnston County town southeast of Raleigh, anchoring a pharmaceutical manufacturing corridor.'],
  ['Knightdale','knightdale',19000,80000,2,'Research Triangle','Wake',['27545'],'Knightdale is a fast-growing Wake County suburb just east of Raleigh.'],
  ['Wendell','wendell',12000,72000,2,'Research Triangle','Wake',['27591'],'Wendell is a rapidly expanding town in eastern Wake County near Raleigh.'],
  ['Hillsborough','hillsborough',9500,72000,2,'Research Triangle','Orange',['27278'],'Hillsborough is the historic Orange County seat on the Eno River between Durham and Chapel Hill.'],
  ['Sanford','sanford',30000,52000,3,'Research Triangle','Lee',['27330'],'Sanford is the Lee County seat southwest of the Triangle, a growing manufacturing hub.'],
  ['Pittsboro','pittsboro',6000,72000,2,'Research Triangle','Chatham',['27312'],'Pittsboro is the Chatham County seat southwest of Chapel Hill, beside the Chatham Park development.'],
  ['Smithfield','smithfield',12000,52000,3,'Research Triangle','Johnston',['27577'],'Smithfield is the Johnston County seat on the Neuse River southeast of Raleigh.'],
  // Piedmont Triad
  ['Kernersville','kernersville',27000,62000,2,'Piedmont Triad','Forsyth',['27284'],'Kernersville sits between Winston-Salem and Greensboro at the center of the Piedmont Triad.'],
  ['Clemmons','clemmons',22000,82000,2,'Piedmont Triad','Forsyth',['27012'],'Clemmons is an affluent Forsyth County suburb southwest of Winston-Salem on the Yadkin River.'],
  ['Burlington','burlington',59000,50000,3,'Piedmont Triad','Alamance',['27215'],'Burlington is the Alamance County hub between Greensboro and Durham, home to Labcorp headquarters.'],
  ['Graham','graham',17000,52000,3,'Piedmont Triad','Alamance',['27253'],'Graham is the Alamance County seat in the central Piedmont between the Triad and the Triangle.'],
  ['Asheboro','asheboro',27000,44000,3,'Piedmont Triad','Randolph',['27203'],'Asheboro is the Randolph County seat, home of the North Carolina Zoo at the geographic center of the state.'],
  ['Thomasville','thomasville',27000,45000,3,'Piedmont Triad','Davidson',['27360'],'Thomasville is a Davidson County furniture-heritage city just south of High Point.'],
  ['Lexington','lexington-nc',19000,42000,3,'Piedmont Triad','Davidson',['27292'],'Lexington is the Davidson County seat, famed for its barbecue, south of Winston-Salem.'],
  ['Mebane','mebane',18000,62000,2,'Piedmont Triad','Alamance',['27302'],'Mebane is a fast-growing town straddling Alamance and Orange counties between the Triad and Triangle.'],
  // Coast / East
  ['Jacksonville','jacksonville-nc',72000,52000,3,'Eastern North Carolina','Onslow',['28540'],'Jacksonville is the Onslow County seat beside Marine Corps Base Camp Lejeune on the North Carolina coast.'],
  ['New Bern','new-bern',32000,52000,3,'Eastern North Carolina','Craven',['28560'],'New Bern is the historic colonial capital at the confluence of the Neuse and Trent rivers.'],
  ['Leland','leland',28000,72000,2,'Cape Fear Coast','Brunswick',['28451'],'Leland is a fast-growing Brunswick County town across the Cape Fear River from Wilmington.'],
  ['Southport','southport',4000,68000,2,'Cape Fear Coast','Brunswick',['28461'],'Southport is a historic waterfront town at the mouth of the Cape Fear River in Brunswick County.'],
  ['Rocky Mount','rocky-mount',54000,42000,3,'Eastern North Carolina','Nash',['27804'],'Rocky Mount straddles the Tar River on the Nash-Edgecombe line along the I-95 corridor.'],
  ['Wilson','wilson',48000,44000,3,'Eastern North Carolina','Wilson',['27893'],'Wilson is a Coastal Plain city and the seat of Wilson County east of Raleigh.'],
  ['Goldsboro','goldsboro',34000,42000,3,'Eastern North Carolina','Wayne',['27530'],'Goldsboro is the Wayne County seat beside Seymour Johnson Air Force Base in eastern North Carolina.'],
  ['Kinston','kinston',20000,38000,3,'Eastern North Carolina','Lenoir',['28501'],'Kinston is the Lenoir County seat on the Neuse River in the eastern Coastal Plain.'],
  ['Elizabeth City','elizabeth-city',18000,45000,3,'Eastern North Carolina','Pasquotank',['27909'],'Elizabeth City is a Pasquotank River port and college town near the Outer Banks gateway.'],
  // Western NC
  ['Boone','boone',19000,38000,3,'Western North Carolina','Watauga',['28607'],'Boone, home to Appalachian State University, is the Watauga County seat high in the Blue Ridge.'],
  ['Hendersonville','hendersonville-nc',15000,52000,3,'Western North Carolina','Henderson',['28792'],'Hendersonville is the Henderson County seat in the Blue Ridge apple country south of Asheville.'],
  ['Statesville','statesville',29000,48000,3,'Western North Carolina','Iredell',['28677'],'Statesville is the Iredell County seat at the crossroads of I-40 and I-77 in the western Piedmont.'],
  ['Morganton','morganton',18000,45000,3,'Western North Carolina','Burke',['28655'],'Morganton is the Burke County seat in the Catawba Valley at the foot of the Blue Ridge.'],
  ['Waynesville','waynesville',10000,48000,3,'Western North Carolina','Haywood',['28786'],'Waynesville is the Haywood County seat in the Great Smoky Mountains west of Asheville.'],
  ['Brevard','brevard',8000,52000,3,'Western North Carolina','Transylvania',['28712'],'Brevard, home to Brevard College and the Pisgah National Forest, is the Transylvania County seat.'],
  ['Lenoir','lenoir',18000,42000,3,'Western North Carolina','Caldwell',['28645'],'Lenoir is the Caldwell County seat in the Catawba Valley foothills of western North Carolina.'],
  // Sandhills
  ['Southern Pines','southern-pines',15000,72000,2,'Sandhills','Moore',['28387'],'Southern Pines is an affluent golf and equestrian town in the Moore County Sandhills near Pinehurst.'],
  ['Aberdeen','aberdeen-nc',9000,58000,3,'Sandhills','Moore',['28315'],'Aberdeen is a Moore County town in the Sandhills golf country south of Southern Pines.'],
  ['Lumberton','lumberton',19000,38000,3,'Eastern North Carolina','Robeson',['28358'],'Lumberton is the Robeson County seat on the Lumber River along the I-95 corridor.'],
];
const esc=(s)=>s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
const meta={state:'North Carolina',stateSlug:'north-carolina',ab:'NC'};
function fmt(c){const [name,slug,pop,inc,tier,region,county,zips,blurb]=c;const z=zips.map(x=>`'${x}'`).join(', ');return `  { name: '${esc(name)}', slug: '${slug}', state: '${meta.state}', stateSlug: '${meta.stateSlug}', stateAbbr: '${meta.ab}', population: ${pop}, medianIncome: ${inc}, tier: ${tier}, region: '${esc(region)}', county: '${esc(county)}', zips: [${z}], localBlurb: '${esc(blurb)}' },`;}
const file=`${DIR}/north-carolina.ts`; let src=fs.readFileSync(file,'utf8');
const existing=new Set([...src.matchAll(/slug: '([^']+)'/g)].map(m=>m[1]));
const toAdd=CITIES.filter(c=>!existing.has(c[1])); const skipped=CITIES.filter(c=>existing.has(c[1])).map(c=>c[1]);
const idx=src.lastIndexOf('\n];'); src=src.slice(0,idx)+'\n'+toAdd.map(fmt).join('\n')+src.slice(idx);
fs.writeFileSync(file,src);
console.log(JSON.stringify({added:toAdd.length, skipped, total_after: existing.size+toAdd.length},null,2));
