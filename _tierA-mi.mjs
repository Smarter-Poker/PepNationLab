import fs from 'fs';
const DIR = process.argv[2];
const CITIES = [
  // Detroit metro
  ['Warren','warren',139000,55000,3,'Metro Detroit','Macomb',['48089','48093'],'Warren is Michigan third-largest city, an automotive-manufacturing hub in Macomb County north of Detroit.'],
  ['Southfield','southfield',77000,58000,3,'Metro Detroit','Oakland',['48075','48076'],'Southfield is a corporate office hub in southern Oakland County bordering northwest Detroit.'],
  ['Dearborn Heights','dearborn-heights',63000,58000,3,'Metro Detroit','Wayne',['48127'],'Dearborn Heights is a Wayne County suburb west of Dearborn in the Detroit metro.'],
  ['Taylor','taylor',63000,55000,3,'Metro Detroit','Wayne',['48180'],'Taylor is a Downriver suburb in Wayne County southwest of Detroit.'],
  ['Westland','westland',85000,58000,3,'Metro Detroit','Wayne',['48185','48186'],'Westland is a large residential Wayne County suburb west of Detroit.'],
  ['Canton','canton',98000,95000,2,'Metro Detroit','Wayne',['48187','48188'],'Canton is an affluent, fast-growing township in western Wayne County between Detroit and Ann Arbor.'],
  ['Roseville','roseville',47000,52000,3,'Metro Detroit','Macomb',['48066'],'Roseville is a Macomb County suburb along the Gratiot Avenue corridor northeast of Detroit.'],
  ['St. Clair Shores','st-clair-shores',59000,62000,2,'Metro Detroit','Macomb',['48080','48081'],'St. Clair Shores is a Lake St. Clair waterfront suburb in Macomb County.'],
  ['Madison Heights','madison-heights',30000,55000,3,'Metro Detroit','Oakland',['48071'],'Madison Heights is an inner-ring Oakland County suburb along the I-75 corridor.'],
  ['Auburn Hills','auburn-hills',24000,72000,2,'Metro Detroit','Oakland',['48326'],'Auburn Hills is an Oakland County technology and automotive R&D hub, home to Oakland University.'],
  ['Pontiac','pontiac',61000,40000,3,'Metro Detroit','Oakland',['48341'],'Pontiac is the Oakland County seat, a former automotive city north of Detroit.'],
  ['Ferndale','ferndale',20000,68000,2,'Metro Detroit','Oakland',['48220'],'Ferndale is a walkable, revitalized inner-ring suburb just north of Detroit in Oakland County.'],
  ['Berkley','berkley',15000,88000,2,'Metro Detroit','Oakland',['48072'],'Berkley is an affluent, family-oriented Oakland County suburb near Royal Oak.'],
  ['Brighton','brighton',7500,72000,2,'Metro Detroit','Livingston',['48116'],'Brighton is a lake-country Livingston County city between Detroit and Lansing.'],
  ['Howell','howell',10000,62000,2,'Metro Detroit','Livingston',['48843'],'Howell is the Livingston County seat in the fast-growing corridor west of Detroit.'],
  ['Waterford','waterford',72000,68000,2,'Metro Detroit','Oakland',['48328','48329'],'Waterford is a lake-dotted Oakland County township northwest of Pontiac.'],
  ['Wixom','wixom',17000,82000,2,'Metro Detroit','Oakland',['48393'],'Wixom is a western Oakland County city along the I-96 technology corridor.'],
  ['Milford','milford',6500,95000,2,'Metro Detroit','Oakland',['48381'],'Milford is an affluent village on the Huron River in western Oakland County.'],
  ['Grosse Pointe Woods','grosse-pointe-woods',15000,105000,1,'Metro Detroit','Wayne',['48236'],'Grosse Pointe Woods is one of the affluent Grosse Pointe communities on Lake St. Clair.'],
  ['Wyandotte','wyandotte',24000,55000,3,'Metro Detroit','Wayne',['48192'],'Wyandotte is a historic Downriver city on the Detroit River in Wayne County.'],
  ['Southgate','southgate',30000,58000,3,'Metro Detroit','Wayne',['48195'],'Southgate is a Downriver Wayne County suburb south of Detroit.'],
  ['Farmington','farmington',11000,78000,2,'Metro Detroit','Oakland',['48336'],'Farmington is a historic Oakland County city surrounded by Farmington Hills.'],
  // Grand Rapids metro
  ['Wyoming','wyoming',77000,58000,3,'West Michigan','Kent',['49509','49519'],'Wyoming is a Kent County city directly southwest of Grand Rapids.'],
  ['Kentwood','kentwood',54000,60000,3,'West Michigan','Kent',['49508','49512'],'Kentwood is a fast-growing, diverse Kent County suburb southeast of Grand Rapids.'],
  ['Grandville','grandville',16000,68000,2,'West Michigan','Kent',['49418'],'Grandville is a Grand River suburb in Kent County southwest of Grand Rapids.'],
  ['Rockford','rockford',6500,88000,2,'West Michigan','Kent',['49341'],'Rockford is an affluent Rogue River town in northern Kent County, home to Wolverine Worldwide.'],
  ['Ada','ada',15000,130000,1,'West Michigan','Kent',['49301'],'Ada is an affluent township east of Grand Rapids, home to Amway world headquarters.'],
  // Other metros
  ['Portage','portage',49000,62000,3,'Southwest Michigan','Kalamazoo',['49002','49024'],'Portage is a Kalamazoo County city, home to Stryker and Pfizer manufacturing south of Kalamazoo.'],
  ['Battle Creek','battle-creek',52000,45000,3,'Southwest Michigan','Calhoun',['49015','49017'],'Battle Creek, the Cereal City and home of Kellogg, is the seat of Calhoun County.'],
  ['Jackson','jackson',31000,40000,3,'South Central Michigan','Jackson',['49201','49203'],'Jackson is the Jackson County seat midway between Detroit and the Michigan state capital.'],
  ['Muskegon','muskegon',38000,42000,3,'West Michigan','Muskegon',['49441','49442'],'Muskegon is a Lake Michigan port city and the seat of Muskegon County.'],
  ['Mount Pleasant','mount-pleasant',26000,42000,3,'Central Michigan','Isabella',['48858'],'Mount Pleasant, home to Central Michigan University, is the Isabella County seat.'],
  ['Marquette','marquette',20000,45000,3,'Upper Peninsula','Marquette',['49855'],'Marquette, home to Northern Michigan University, is the largest city in the Upper Peninsula on Lake Superior.'],
  ['Bay City','bay-city',33000,44000,3,'Great Lakes Bay','Bay',['48706','48708'],'Bay City is a Saginaw River port and the seat of Bay County in the Great Lakes Bay region.'],
  ['Petoskey','petoskey',6000,58000,2,'Northern Michigan','Emmet',['49770'],'Petoskey is an affluent Little Traverse Bay resort town and the Emmet County seat.'],
  ['Trenton','trenton',18000,68000,2,'Metro Detroit','Wayne',['48183'],'Trenton is a Downriver Detroit River community in Wayne County.'],
];
const esc=(s)=>s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
const meta={state:'Michigan',stateSlug:'michigan',ab:'MI'};
function fmt(c){const [name,slug,pop,inc,tier,region,county,zips,blurb]=c;const z=zips.map(x=>`'${x}'`).join(', ');return `  { name: '${esc(name)}', slug: '${slug}', state: '${meta.state}', stateSlug: '${meta.stateSlug}', stateAbbr: '${meta.ab}', population: ${pop}, medianIncome: ${inc}, tier: ${tier}, region: '${esc(region)}', county: '${esc(county)}', zips: [${z}], localBlurb: '${esc(blurb)}' },`;}
const file=`${DIR}/michigan.ts`; let src=fs.readFileSync(file,'utf8');
const existing=new Set([...src.matchAll(/slug: '([^']+)'/g)].map(m=>m[1]));
const toAdd=CITIES.filter(c=>!existing.has(c[1])); const skipped=CITIES.filter(c=>existing.has(c[1])).map(c=>c[1]);
const idx=src.lastIndexOf('\n];'); src=src.slice(0,idx)+'\n'+toAdd.map(fmt).join('\n')+src.slice(idx);
fs.writeFileSync(file,src);
console.log(JSON.stringify({added:toAdd.length, skipped, total_after: existing.size+toAdd.length},null,2));
