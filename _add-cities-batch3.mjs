import fs from 'fs';
const DIR = process.argv[2];
const BATCH = {
  maine: { state: 'Maine', stateSlug: 'maine', ab: 'ME', cities: [
    ['Lewiston','lewiston',37000,45000,3,'Androscoggin Valley','Androscoggin',['04240'],'Lewiston laboratories in the Androscoggin Valley source our high-purity peptides for metabolic and recovery research with third-party COAs.'],
    ['Auburn','auburn',24000,50000,3,'Androscoggin Valley','Androscoggin',['04210'],'Auburn research groups in central Maine rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Biddeford','biddeford',22000,55000,3,'Southern Maine','York',['04005'],'Biddeford laboratories on the southern Maine coast choose our verified-purity peptides for reproducible study protocols.'],
    ['Saco','saco',20000,62000,2,'Southern Maine','York',['04072'],'Saco research teams in York County trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Westbrook','westbrook',20000,60000,2,'Greater Portland','Cumberland',['04092'],'Westbrook research professionals in the Portland metro select our high-purity peptides with full lot documentation.'],
    ['Brunswick','brunswick',21000,62000,2,'Midcoast Maine','Cumberland',['04011'],'Home to Bowdoin College, Brunswick laboratories source our lot-traceable peptides backed by complete certificates of analysis.'],
    ['Waterville','waterville',16000,42000,3,'Central Maine','Kennebec',['04901'],'Home to Colby College, Waterville research groups choose our high-purity peptides for reproducible metabolic research.'],
    ['Yarmouth','yarmouth',9000,95000,1,'Greater Portland','Cumberland',['04096'],'Yarmouth research professionals in affluent coastal Cumberland County rely on our verified purity and transparent third-party analysis.'],
  ]},
  'new-hampshire': { state: 'New Hampshire', stateSlug: 'new-hampshire', ab: 'NH', cities: [
    ['Dover','dover',32000,72000,2,'Seacoast New Hampshire','Strafford',['03820'],'Dover laboratories on the New Hampshire Seacoast source our high-purity peptides for metabolic and recovery research with third-party COAs.'],
    ['Rochester','rochester',33000,58000,3,'Seacoast New Hampshire','Strafford',['03867'],'Rochester research groups in Strafford County rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Salem','salem',30000,82000,2,'Southern New Hampshire','Rockingham',['03079'],'Salem laboratories near the Massachusetts line choose our verified-purity peptides for longevity and recovery studies.'],
    ['Derry','derry',34000,78000,2,'Southern New Hampshire','Rockingham',['03038'],'Derry research teams in Rockingham County trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Keene','keene',23000,52000,3,'Monadnock Region','Cheshire',['03431'],'Home to Keene State College, Keene laboratories select our high-purity peptides with full lot documentation.'],
    ['Londonderry','londonderry',26000,108000,2,'Southern New Hampshire','Rockingham',['03053'],'Londonderry research professionals in affluent Rockingham County source our lot-traceable peptides backed by complete certificates of analysis.'],
    ['Durham','durham',16000,70000,2,'Seacoast New Hampshire','Strafford',['03824'],'Home to the University of New Hampshire, Durham research groups choose our high-purity peptides for reproducible metabolic research.'],
    ['Amherst','amherst',11000,140000,1,'Greater Nashua','Hillsborough',['03031'],'Amherst research professionals in one of New Hampshire wealthiest towns rely on our verified purity and transparent third-party analysis.'],
  ]},
  idaho: { state: 'Idaho', stateSlug: 'idaho', ab: 'ID', cities: [
    ['Caldwell','caldwell',62000,52000,3,'Treasure Valley','Canyon',['83605'],'Caldwell laboratories in the Treasure Valley source our high-purity peptides for metabolic and recovery research with third-party COAs.'],
    ['Post Falls','post-falls',42000,62000,2,'North Idaho','Kootenai',['83854'],'Post Falls research groups in North Idaho rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Rexburg','rexburg',40000,40000,3,'Eastern Idaho','Madison',['83440'],'Home to Brigham Young University-Idaho, Rexburg laboratories choose our verified-purity peptides for reproducible study protocols.'],
    ['Kuna','kuna',27000,72000,2,'Treasure Valley','Ada',['83634'],'Kuna research teams in the Boise metro trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Lewiston','lewiston',34000,52000,3,'North Central Idaho','Nez Perce',['83501'],'Lewiston laboratories at the Idaho-Washington confluence select our high-purity peptides with full lot documentation.'],
    ['Star','star',15000,88000,2,'Treasure Valley','Ada',['83669'],'Star research professionals in the fast-growing Treasure Valley source our lot-traceable peptides backed by complete certificates of analysis.'],
    ['Hailey','hailey',9000,68000,2,'Wood River Valley','Blaine',['83333'],'Hailey laboratories in the Wood River Valley near Sun Valley choose our high-purity peptides for longevity and recovery studies.'],
  ]},
  montana: { state: 'Montana', stateSlug: 'montana', ab: 'MT', cities: [
    ['Butte','butte',35000,46000,3,'Southwest Montana','Silver Bow',['59701'],'Butte laboratories in southwest Montana source our high-purity peptides for metabolic and recovery research with third-party COAs.'],
    ['Belgrade','belgrade',12000,68000,2,'Gallatin Valley','Gallatin',['59714'],'Belgrade research groups in the Gallatin Valley rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Livingston','livingston',8500,52000,3,'Paradise Valley','Park',['59047'],'Livingston laboratories near Yellowstone choose our verified-purity peptides for reproducible study protocols.'],
    ['Havre','havre',9500,45000,3,'Hi-Line','Hill',['59501'],'Havre research teams on the Montana Hi-Line trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Hamilton','hamilton',5000,52000,3,'Bitterroot Valley','Ravalli',['59840'],'Hamilton laboratories in the Bitterroot Valley select our high-purity peptides with full lot documentation.'],
    ['Columbia Falls','columbia-falls',5500,55000,3,'Flathead Valley','Flathead',['59912'],'Columbia Falls research groups in the Flathead Valley source our lot-traceable peptides backed by complete certificates of analysis.'],
  ]},
};
const esc=(s)=>s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
function fmt(c,meta){const [name,slug,pop,inc,tier,region,county,zips,blurb]=c;const z=zips.map(x=>`'${x}'`).join(', ');return `  { name: '${esc(name)}', slug: '${slug}', state: '${meta.state}', stateSlug: '${meta.stateSlug}', stateAbbr: '${meta.ab}', population: ${pop}, medianIncome: ${inc}, tier: ${tier}, region: '${esc(region)}', county: '${esc(county)}', zips: [${z}], localBlurb: '${esc(blurb)}' },`;}
const report={};
for (const [slug,meta] of Object.entries(BATCH)) {
  const file=`${DIR}/${slug}.ts`; let src=fs.readFileSync(file,'utf8');
  const existing=new Set([...src.matchAll(/slug: '([^']+)'/g)].map(m=>m[1]));
  const toAdd=meta.cities.filter(c=>!existing.has(c[1])); const skipped=meta.cities.filter(c=>existing.has(c[1])).map(c=>c[1]);
  const lines=toAdd.map(c=>fmt(c,meta)).join('\n'); const idx=src.lastIndexOf('\n];');
  src=src.slice(0,idx)+'\n'+lines+src.slice(idx); fs.writeFileSync(file,src);
  report[slug]={added:toAdd.length,skipped};
}
console.log(JSON.stringify(report,null,2));
