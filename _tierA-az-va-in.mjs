import fs from 'fs';
const DIR = process.argv[2];
// [name, slug, pop, income, tier, region, county('' = none), [zips], blurb]
const BATCH = {
  arizona: { state:'Arizona', stateSlug:'arizona', ab:'AZ', cities:[
    ['Avondale','avondale',90000,68000,3,'Phoenix Metro','Maricopa',['85323','85392'],'Avondale is a fast-growing West Valley city in Maricopa County along the I-10 corridor.'],
    ['Litchfield Park','litchfield-park',7000,95000,2,'Phoenix Metro','Maricopa',['85340'],'Litchfield Park is an affluent, master-planned West Valley community near the Wigwam resort.'],
    ['Sun City','sun-city',40000,55000,3,'Phoenix Metro','Maricopa',['85351','85373'],'Sun City is the original Del Webb active-adult retirement community in the northwest Valley.'],
    ['Sun City West','sun-city-west',25000,62000,3,'Phoenix Metro','Maricopa',['85375'],'Sun City West is a Del Webb active-adult community on the West Valley edge of the Phoenix metro.'],
    ['Anthem','anthem',24000,105000,2,'Phoenix Metro','Maricopa',['85086'],'Anthem is an affluent master-planned community in far north Phoenix along I-17.'],
    ['Carefree','carefree',4000,140000,1,'Phoenix Metro','Maricopa',['85377'],'Carefree is an affluent desert town in the foothills north of Scottsdale.'],
    ['Apache Junction','apache-junction',42000,52000,3,'Phoenix Metro','Pinal',['85119','85120'],'Apache Junction sits at the foot of the Superstition Mountains on the East Valley edge.'],
    ['Maricopa','maricopa',68000,72000,2,'Phoenix Metro','Pinal',['85138','85139'],'Maricopa is one of the fastest-growing Pinal County cities south of the Phoenix metro.'],
    ['Casa Grande','casa-grande',60000,55000,3,'Central Arizona','Pinal',['85122','85194'],'Casa Grande is a Pinal County hub midway between Phoenix and Tucson along I-10.'],
    ['El Mirage','el-mirage',36000,55000,3,'Phoenix Metro','Maricopa',['85335'],'El Mirage is a growing West Valley city in Maricopa County near Surprise.'],
    ['Tolleson','tolleson',7500,52000,3,'Phoenix Metro','Maricopa',['85353'],'Tolleson is a West Valley logistics and food-processing hub in Maricopa County.'],
    ['Ahwatukee','ahwatukee',85000,88000,2,'Phoenix Metro','Maricopa',['85044','85048'],'Ahwatukee is an affluent Phoenix urban village tucked south of South Mountain.'],
    ['Sahuarita','sahuarita',36000,78000,2,'Tucson Metro','Pima',['85629'],'Sahuarita is a fast-growing master-planned town in the Santa Cruz Valley south of Tucson.'],
    ['Catalina Foothills','catalina-foothills',50000,95000,1,'Tucson Metro','Pima',['85718'],'Catalina Foothills is an affluent community in the Santa Catalina Mountains north of Tucson.'],
    ['Green Valley','green-valley',22000,55000,3,'Tucson Metro','Pima',['85614'],'Green Valley is a retirement community in the Santa Cruz Valley south of Tucson.'],
    ['Yuma','yuma',100000,50000,3,'Southwest Arizona','Yuma',['85364','85365'],'Yuma is an agricultural and military hub on the Colorado River in the far southwest corner of Arizona.'],
    ['Lake Havasu City','lake-havasu-city',58000,55000,3,'Western Arizona','Mohave',['86403','86404'],'Lake Havasu City is a Colorado River resort city and home of the relocated London Bridge.'],
    ['Bullhead City','bullhead-city',42000,48000,3,'Western Arizona','Mohave',['86429','86442'],'Bullhead City is a Colorado River city across from Laughlin in western Mohave County.'],
    ['Kingman','kingman',33000,48000,3,'Western Arizona','Mohave',['86401','86409'],'Kingman is the Mohave County seat on historic Route 66 in northwestern Arizona.'],
    ['Sierra Vista','sierra-vista',46000,55000,3,'Southern Arizona','Cochise',['85635'],'Sierra Vista, beside Fort Huachuca, is the largest city in Cochise County in southern Arizona.'],
    ['Prescott Valley','prescott-valley',48000,58000,3,'Central Arizona','Yavapai',['86314'],'Prescott Valley is a fast-growing town in the central Arizona highlands near Prescott.'],
    ['Payson','payson',16000,48000,3,'Central Arizona','Gila',['85541'],'Payson is a Mogollon Rim mountain town at the geographic center of Arizona.'],
    ['Show Low','show-low',12000,48000,3,'Eastern Arizona','Navajo',['85901'],'Show Low is a White Mountains resort town in Navajo County in eastern Arizona.'],
    ['Nogales','nogales',20000,38000,3,'Southern Arizona','Santa Cruz',['85621'],'Nogales is a border city and the Santa Cruz County seat on the Mexican frontier.'],
  ]},
  virginia: { state:'Virginia', stateSlug:'virginia', ab:'VA', cities:[
    ['Sterling','sterling',30000,105000,2,'Northern Virginia','Loudoun',['20164','20165'],'Sterling is a Loudoun County community in the Dulles technology corridor.'],
    ['Lorton','lorton',20000,120000,2,'Northern Virginia','Fairfax',['22079'],'Lorton is an affluent southern Fairfax County community near the Occoquan River.'],
    ['Stafford','stafford',35000,105000,2,'Northern Virginia','Stafford',['22554','22556'],'Stafford is a fast-growing county along the I-95 corridor between Fredericksburg and Washington.'],
    ['Gainesville','gainesville',18000,120000,2,'Northern Virginia','Prince William',['20155'],'Gainesville is an affluent, fast-growing western Prince William County community.'],
    ['Purcellville','purcellville',10000,130000,1,'Northern Virginia','Loudoun',['20132'],'Purcellville is an affluent town in Loudoun wine country at the foot of the Blue Ridge.'],
    ['Dumfries','dumfries',6000,88000,2,'Northern Virginia','Prince William',['22026'],'Dumfries is Virginia oldest chartered town, on the I-95 corridor in Prince William County.'],
    ['Warrenton','warrenton',10000,88000,2,'Northern Virginia','Fauquier',['20186','20187'],'Warrenton is the Fauquier County seat in the Virginia Piedmont hunt country.'],
    ['Glen Allen','glen-allen',16000,92000,2,'Greater Richmond','Henrico',['23059','23060'],'Glen Allen is an affluent northwestern Henrico County suburb of Richmond.'],
    ['Mechanicsville','mechanicsville',37000,82000,2,'Greater Richmond','Hanover',['23111','23116'],'Mechanicsville is a growing Hanover County suburb northeast of Richmond.'],
    ['Short Pump','short-pump',28000,110000,1,'Greater Richmond','Henrico',['23233'],'Short Pump is an affluent western Henrico County retail and residential hub.'],
    ['Chester','chester',22000,78000,2,'Greater Richmond','Chesterfield',['23831','23836'],'Chester is a Chesterfield County community south of Richmond along the I-95 corridor.'],
    ['Ashland','ashland',8000,68000,2,'Greater Richmond','Hanover',['23005'],'Ashland, home to Randolph-Macon College, is a railroad town in Hanover County north of Richmond.'],
    ['Colonial Heights','colonial-heights',18000,62000,3,'Greater Richmond','',['23834'],'Colonial Heights is an independent city on the Appomattox River south of Richmond.'],
    ['Petersburg','petersburg',33000,42000,3,'Greater Richmond','',['23803','23805'],'Petersburg is a historic independent city at the head of navigation on the Appomattox River.'],
    ['Hampton','hampton',137000,58000,3,'Hampton Roads','',['23666','23669'],'Hampton is an independent city on the Chesapeake Bay, home to Hampton University and NASA Langley.'],
    ['Portsmouth','portsmouth',97000,52000,3,'Hampton Roads','',['23704','23707'],'Portsmouth is an independent city and naval shipyard hub on the Elizabeth River.'],
    ['Suffolk','suffolk',100000,80000,2,'Hampton Roads','',['23434','23435'],'Suffolk is the largest city by area in Virginia, an independent city on the Nansemond River.'],
    ['Poquoson','poquoson',12000,105000,1,'Hampton Roads','',['23662'],'Poquoson is an affluent independent city on the Chesapeake Bay Peninsula.'],
    ['Smithfield','smithfield',9000,72000,2,'Hampton Roads','Isle of Wight',['23430'],'Smithfield is a historic ham-country town on the Pagan River in Isle of Wight County.'],
    ['Harrisonburg','harrisonburg',52000,42000,3,'Shenandoah Valley','',['22801','22802'],'Harrisonburg, home to James Madison University, is an independent city in the central Shenandoah Valley.'],
    ['Lynchburg','lynchburg',80000,48000,3,'Central Virginia','',['24501','24502'],'Lynchburg is a James River independent city and home to Liberty University in the Virginia Piedmont.'],
    ['Danville','danville',42000,38000,3,'Southern Virginia','',['24540','24541'],'Danville is a former tobacco and textile independent city on the Dan River at the North Carolina line.'],
    ['Winchester','winchester',28000,52000,3,'Shenandoah Valley','',['22601','22602'],'Winchester is a historic independent city and apple-country hub at the top of the Shenandoah Valley.'],
    ['Staunton','staunton',26000,50000,3,'Shenandoah Valley','',['24401'],'Staunton is a Shenandoah Valley independent city, birthplace of Woodrow Wilson and home to a Blackfriars Playhouse.'],
    ['Salem','salem',25000,55000,3,'Roanoke Valley','',['24153'],'Salem is an independent city in the Roanoke Valley, home to Roanoke College.'],
    ['Christiansburg','christiansburg',22000,55000,3,'New River Valley','Montgomery',['24073'],'Christiansburg is the Montgomery County seat in the New River Valley near Virginia Tech.'],
    ['Culpeper','culpeper',20000,62000,3,'Central Virginia','Culpeper',['22701'],'Culpeper is a historic Piedmont town and county seat along the US-29 corridor.'],
  ]},
  indiana: { state:'Indiana', stateSlug:'indiana', ab:'IN', cities:[
    ['Greenfield','greenfield',24000,62000,3,'Indianapolis Metro','Hancock',['46140'],'Greenfield is the Hancock County seat, birthplace of poet James Whitcomb Riley, east of Indianapolis.'],
    ['Franklin','franklin',26000,62000,3,'Indianapolis Metro','Johnson',['46131'],'Franklin, home to Franklin College, is the Johnson County seat south of Indianapolis.'],
    ['Danville','danville',10000,72000,2,'Indianapolis Metro','Hendricks',['46122'],'Danville is the Hendricks County seat west of Indianapolis.'],
    ['Mooresville','mooresville',10000,62000,2,'Indianapolis Metro','Morgan',['46158'],'Mooresville is a Morgan County town southwest of Indianapolis.'],
    ['Beech Grove','beech-grove',15000,52000,3,'Indianapolis Metro','Marion',['46107'],'Beech Grove is an enclave city within Marion County on the Indianapolis southeast side.'],
    ['Lawrence','lawrence',49000,62000,3,'Indianapolis Metro','Marion',['46226','46236'],'Lawrence is a Marion County city on the northeast side of Indianapolis at the former Fort Harrison.'],
    ['Speedway','speedway',13000,58000,3,'Indianapolis Metro','Marion',['46224'],'Speedway is an enclave town in Marion County, home of the Indianapolis Motor Speedway.'],
    ['McCordsville','mccordsville',9000,95000,2,'Indianapolis Metro','Hancock',['46055'],'McCordsville is a fast-growing, affluent Hancock County suburb northeast of Indianapolis.'],
    ['Merrillville','merrillville',36000,58000,3,'Northwest Indiana','Lake',['46410'],'Merrillville is a Lake County retail hub in the Region south of Gary.'],
    ['Crown Point','crown-point',33000,78000,2,'Northwest Indiana','Lake',['46307'],'Crown Point is the Lake County seat, a growing suburb in the Chicago-adjacent Region.'],
    ['Schererville','schererville',30000,82000,2,'Northwest Indiana','Lake',['46375'],'Schererville is an affluent Lake County suburb in the Illinois-adjacent Region.'],
    ['Highland','highland',24000,68000,2,'Northwest Indiana','Lake',['46322'],'Highland is a Lake County town in the Calumet Region near the Illinois line.'],
    ['Hammond','hammond',77000,48000,3,'Northwest Indiana','Lake',['46320','46324'],'Hammond is a Lake Michigan industrial city on the Illinois border, home to a Purdue University campus.'],
    ['Gary','gary',68000,34000,3,'Northwest Indiana','Lake',['46402','46408'],'Gary is a Lake Michigan steel city in Lake County southeast of Chicago.'],
    ['Portage','portage',38000,62000,3,'Northwest Indiana','Porter',['46368'],'Portage is a Lake Michigan city in Porter County beside the Indiana Dunes.'],
    ['Chesterton','chesterton',14000,72000,2,'Northwest Indiana','Porter',['46304'],'Chesterton is a Porter County town at the gateway to the Indiana Dunes National Park.'],
    ['Hobart','hobart',30000,58000,3,'Northwest Indiana','Lake',['46342'],'Hobart is a Lake County city around Lake George in the Calumet Region.'],
    ['Muncie','muncie',65000,38000,3,'East Central Indiana','Delaware',['47303','47304'],'Muncie, home to Ball State University, is the Delaware County seat on the White River.'],
    ['Anderson','anderson',55000,42000,3,'East Central Indiana','Madison',['46011','46013'],'Anderson is the Madison County seat on the White River northeast of Indianapolis.'],
    ['Kokomo','kokomo',59000,48000,3,'North Central Indiana','Howard',['46901','46902'],'Kokomo is a Howard County automotive-manufacturing city north of Indianapolis.'],
    ['Terre Haute','terre-haute',58000,40000,3,'Wabash Valley','Vigo',['47802','47803'],'Terre Haute, home to Indiana State and Rose-Hulman, is the Vigo County seat on the Wabash River.'],
    ['Elkhart','elkhart',53000,45000,3,'Michiana','Elkhart',['46514','46516'],'Elkhart, the RV capital of the world, is a Michiana city near the Michigan line.'],
    ['Mishawaka','mishawaka',50000,52000,3,'Michiana','St. Joseph',['46544','46545'],'Mishawaka is a St. Joseph River city adjoining South Bend in the Michiana region.'],
    ['Jeffersonville','jeffersonville',49000,55000,3,'Southern Indiana','Clark',['47130'],'Jeffersonville is an Ohio River city in Clark County across from Louisville.'],
    ['New Albany','new-albany',37000,48000,3,'Southern Indiana','Floyd',['47150'],'New Albany is the Floyd County seat on the Ohio River across from Louisville, home to IU Southeast.'],
    ['Richmond','richmond',35000,40000,3,'East Central Indiana','Wayne',['47374'],'Richmond, home to Earlham College, is the Wayne County seat on the Ohio state line.'],
  ]},
};
const esc=(s)=>s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
function fmt(c,meta){const [name,slug,pop,inc,tier,region,county,zips,blurb]=c;const z=zips.map(x=>`'${x}'`).join(', ');const cty=county?` county: '${esc(county)}',`:'';return `  { name: '${esc(name)}', slug: '${slug}', state: '${meta.state}', stateSlug: '${meta.stateSlug}', stateAbbr: '${meta.ab}', population: ${pop}, medianIncome: ${inc}, tier: ${tier}, region: '${esc(region)}',${cty} zips: [${z}], localBlurb: '${esc(blurb)}' },`;}
const report={};
for (const [slug,meta] of Object.entries(BATCH)) {
  const file=`${DIR}/${slug}.ts`; let src=fs.readFileSync(file,'utf8');
  const existing=new Set([...src.matchAll(/slug: '([^']+)'/g)].map(m=>m[1]));
  const toAdd=meta.cities.filter(c=>!existing.has(c[1])); const skipped=meta.cities.filter(c=>existing.has(c[1])).map(c=>c[1]);
  const idx=src.lastIndexOf('\n];'); src=src.slice(0,idx)+'\n'+toAdd.map(c=>fmt(c,meta)).join('\n')+src.slice(idx);
  fs.writeFileSync(file,src);
  report[slug]={added:toAdd.length,skipped,total_after:existing.size+toAdd.length};
}
console.log(JSON.stringify(report,null,2));
