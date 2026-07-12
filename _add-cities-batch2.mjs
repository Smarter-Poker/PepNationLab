import fs from 'fs';
const DIR = process.argv[2];
const BATCH = {
  nebraska: { state: 'Nebraska', stateSlug: 'nebraska', ab: 'NE', cities: [
    ['Hastings','hastings',25000,52000,3,'Central Nebraska','Adams',['68901'],'Hastings laboratories in central Nebraska source our high-purity peptides for metabolic and recovery research with third-party COAs.'],
    ['North Platte','north-platte',23000,52000,3,'Western Nebraska','Lincoln',['69101'],'North Platte research groups in western Nebraska rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Scottsbluff','scottsbluff',15000,48000,3,'Nebraska Panhandle','Scotts Bluff',['69361'],'Scottsbluff laboratories in the Nebraska Panhandle choose our verified-purity peptides for reproducible study protocols.'],
    ['Beatrice','beatrice',12000,46000,3,'Southeast Nebraska','Gage',['68310'],'Beatrice research teams in southeast Nebraska trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Blair','blair',8000,62000,2,'Omaha Metro','Washington',['68008'],'Blair research professionals in the Omaha metro select our high-purity peptides with full lot documentation.'],
    ['Seward','seward',8000,58000,3,'Lincoln Metro','Seward',['68434'],'Home to Concordia University Nebraska, Seward laboratories source our lot-traceable peptides backed by complete certificates of analysis.'],
  ]},
  'new-mexico': { state: 'New Mexico', stateSlug: 'new-mexico', ab: 'NM', cities: [
    ['Clovis','clovis',39000,46000,3,'Eastern New Mexico','Curry',['88101'],'Clovis laboratories in eastern New Mexico source our high-purity peptides for metabolic and recovery research with third-party COAs.'],
    ['Deming','deming',14000,32000,3,'Southwest New Mexico','Luna',['88030'],'Deming research groups in southwest New Mexico rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Silver City','silver-city',9000,38000,3,'Southwest New Mexico','Grant',['88061'],'Home to Western New Mexico University, Silver City laboratories choose our verified-purity peptides for reproducible study protocols.'],
    ['Sunland Park','sunland-park',17000,38000,3,'Las Cruces Metro','Dona Ana',['88063'],'Sunland Park research teams in the Las Cruces metro trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Portales','portales',12000,38000,3,'Eastern New Mexico','Roosevelt',['88130'],'Home to Eastern New Mexico University, Portales research groups select our high-purity peptides with full lot documentation.'],
    ['Bernalillo','bernalillo',9000,50000,3,'Albuquerque Metro','Sandoval',['87004'],'Bernalillo laboratories north of Albuquerque source our lot-traceable peptides backed by complete certificates of analysis.'],
  ]},
  kansas: { state: 'Kansas', stateSlug: 'kansas', ab: 'KS', cities: [
    ['Midwest City','midwest-city-ks-PLACEHOLDER',0,0,3,'x','x',['00000'],'placeholder'],
    ['Emporia','emporia',24000,44000,3,'East Central Kansas','Lyon',['66801'],'Home to Emporia State University, Emporia laboratories source our high-purity peptides for metabolic and recovery research with third-party COAs.'],
    ['Garden City','garden-city',28000,52000,3,'Southwest Kansas','Finney',['67846'],'Garden City research groups in southwest Kansas rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Dodge City','dodge-city',27000,52000,3,'Southwest Kansas','Ford',['67801'],'Dodge City laboratories on the high plains choose our verified-purity peptides for reproducible study protocols.'],
    ['Hays','hays',21000,46000,3,'Northwest Kansas','Ellis',['67601'],'Home to Fort Hays State University, Hays research teams trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Pittsburg','pittsburg',20000,40000,3,'Southeast Kansas','Crawford',['66762'],'Home to Pittsburg State University, Pittsburg laboratories select our high-purity peptides with full lot documentation.'],
    ['Junction City','junction-city',23000,48000,3,'Flint Hills','Geary',['66441'],'Junction City research groups in the Flint Hills source our lot-traceable peptides backed by complete certificates of analysis.'],
    ['Mission','mission',10000,68000,2,'Kansas City Metro','Johnson',['66202'],'Mission research professionals in Johnson County choose our high-purity peptides for longevity and recovery studies.'],
  ]},
  oklahoma: { state: 'Oklahoma', stateSlug: 'oklahoma', ab: 'OK', cities: [
    ['Midwest City','midwest-city',58000,52000,3,'Oklahoma City Metro','Oklahoma',['73110'],'Midwest City laboratories in the Oklahoma City metro source our high-purity peptides for metabolic and recovery research with third-party COAs.'],
    ['Muskogee','muskogee',36000,40000,3,'Green Country','Muskogee',['74401'],'Muskogee research groups in Green Country rely on our lot-traceable compounds and complete certificates of analysis.'],
    ['Shawnee','shawnee',31000,44000,3,'Central Oklahoma','Pottawatomie',['74801'],'Shawnee laboratories in central Oklahoma choose our verified-purity peptides for reproducible study protocols.'],
    ['Ponca City','ponca-city',24000,46000,3,'North Central Oklahoma','Kay',['74601'],'Ponca City research teams in north-central Oklahoma trust our documented, lot-traceable compounds and third-party analysis.'],
    ['Ardmore','ardmore',25000,46000,3,'Southern Oklahoma','Carter',['73401'],'Ardmore laboratories in southern Oklahoma select our high-purity peptides with full lot documentation.'],
    ['Claremore','claremore',20000,52000,3,'Green Country','Rogers',['74017'],'Home to Rogers State University, Claremore research groups source our lot-traceable peptides backed by complete certificates of analysis.'],
    ['Sapulpa','sapulpa',21000,50000,3,'Tulsa Metro','Creek',['74066'],'Sapulpa research professionals in the Tulsa metro choose our high-purity peptides for longevity and recovery studies.'],
  ]},
};
// remove placeholder guard row
BATCH.kansas.cities = BATCH.kansas.cities.filter(c=>c[1]!=='midwest-city-ks-PLACEHOLDER');

const esc = (s) => s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
function fmt(c, meta) {
  const [name,slug,pop,inc,tier,region,county,zips,blurb]=c;
  const z=zips.map(x=>`'${x}'`).join(', ');
  return `  { name: '${esc(name)}', slug: '${slug}', state: '${meta.state}', stateSlug: '${meta.stateSlug}', stateAbbr: '${meta.ab}', population: ${pop}, medianIncome: ${inc}, tier: ${tier}, region: '${esc(region)}', county: '${esc(county)}', zips: [${z}], localBlurb: '${esc(blurb)}' },`;
}
const report={};
for (const [slug,meta] of Object.entries(BATCH)) {
  const file=`${DIR}/${slug}.ts`;
  let src=fs.readFileSync(file,'utf8');
  const existing=new Set([...src.matchAll(/slug: '([^']+)'/g)].map(m=>m[1]));
  const toAdd=meta.cities.filter(c=>!existing.has(c[1]));
  const skipped=meta.cities.filter(c=>existing.has(c[1])).map(c=>c[1]);
  const lines=toAdd.map(c=>fmt(c,meta)).join('\n');
  const idx=src.lastIndexOf('\n];');
  src=src.slice(0,idx)+'\n'+lines+src.slice(idx);
  fs.writeFileSync(file,src);
  report[slug]={added:toAdd.length,skipped};
}
console.log(JSON.stringify(report,null,2));
