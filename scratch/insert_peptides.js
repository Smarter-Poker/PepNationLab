const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const rawData = `
NJ1000	NAD+	1000mg × 10 vials	$175	$155	Custom Fixed Price
MS40	MOTS-C	40mg × 10 vials	$255	$220	Custom Fixed Price
K80	KLOW (TB10+BPC10+GHK50+KPV10)	80mg × 10 vials	$245	$215	Custom Fixed Price
TSM10	Tesamorelin	10mg × 10 vials	$180	$168	Custom Fixed Price
RT20	Retatrutide	20mg × 10 vials	$200	$130	Custom Fixed Price
XA10	Semax	10mg × 10 vials	$85	$80	Custom Fixed Price
BA10	Bac. water	10ml × 10 vials	$15	$15	Custom (3 Boxes = $45)
H10	HGH 191AA (Somatropin)	10iu × 10 vials	$58	$49	Adjusted (-15% Flat Disc.)
H15	HGH 191AA (Somatropin)	15iu × 10 vials	$80	$68	Adjusted (-15% Flat Disc.)
H24	HGH 191AA (Somatropin)	24iu × 10 vials	$120	$102	Adjusted (-15% Flat Disc.)
H36	HGH 191AA (Somatropin)	36iu × 10 vials	$160	$136	Adjusted (-15% Flat Disc.)
MT1	MT-1	10mg × 10 vials	$60	$51	Adjusted (-15% Flat Disc.)
ML10	MT-2 (Melanotan 2 Acetate)	10mg × 10 vials	$60	$51	Adjusted (-15% Flat Disc.)
P41	PT-141	10mg × 10 vials	$80	$68	Adjusted (-15% Flat Disc.)
DS5	DSIP	5mg × 10 vials	$50	$42	Adjusted (-15% Flat Disc.)
DS10	DSIP	10mg × 10 vials	$90	$76	Adjusted (-15% Flat Disc.)
SK5	Selank	5mg × 10 vials	$70	$59	Adjusted (-15% Flat Disc.)
SK10	Selank	10mg × 10 vials	$85	$72	Adjusted (-15% Flat Disc.)
XA5	Semax	5mg × 10 vials	$60	$56	Adjusted (-6.5% Semax Disc.)
OT5	Oxytocin Acetate	5mg × 10 vials	$60	$51	Adjusted (-15% Flat Disc.)
OT10	Oxytocin Acetate	10mg × 10 vials	$100	$85	Adjusted (-15% Flat Disc.)
ET10	Epithalon	10mg × 10 vials	$45	$38	Adjusted (-15% Flat Disc.)
ET50	Epithalon	50mg × 10 vials	$145	$123	Adjusted (-15% Flat Disc.)
BC5	BPC 157	5mg × 10 vials	$60	$51	Adjusted (-15% Flat Disc.)
BC10	BPC 157	10mg × 10 vials	$90	$76	Adjusted (-15% Flat Disc.)
BT5	TB500 (Thymosin B4 Acetate)	5mg × 10 vials	$80	$68	Adjusted (-15% Flat Disc.)
BT10	TB500 (Thymosin B4 Acetate)	10mg × 10 vials	$140	$119	Adjusted (-15% Flat Disc.)
BB10	BPC 5mg + TB 5mg	10mg × 10 vials	$115	$97	Adjusted (-15% Flat Disc.)
BB20	BPC 10mg + TB 10mg	20mg × 10 vials	$220	$187	Adjusted (-15% Flat Disc.)
AR50	AICAR	50mg × 10 vials	$75	$63	Adjusted (-15% Flat Disc.)
AP5	Adipotide	5mg × 10 vials	$150	$127	Adjusted (-15% Flat Disc.)
SM5	Semaglutide	5mg × 10 vials	$45	$38	Adjusted (-15% Flat Disc.)
SM10	Semaglutide	10mg × 10 vials	$60	$51	Adjusted (-15% Flat Disc.)
SM15	Semaglutide	15mg × 10 vials	$80	$68	Adjusted (-15% Flat Disc.)
SM20	Semaglutide	20mg × 10 vials	$95	$80	Adjusted (-15% Flat Disc.)
SM30	Semaglutide	30mg × 10 vials	$125	$106	Adjusted (-15% Flat Disc.)
2S10	SS-31	10mg × 10 vials	$100	$85	Adjusted (-15% Flat Disc.)
2S50	SS-31	50mg × 10 vials	$345	$293	Adjusted (-15% Flat Disc.)
TR5	Tirzepatide	5mg × 10 vials	$45	$38	Adjusted (-15% Flat Disc.)
TR10	Tirzepatide	10mg × 10 vials	$65	$55	Adjusted (-15% Flat Disc.)
TR15	Tirzepatide	15mg × 10 vials	$85	$72	Adjusted (-15% Flat Disc.)
TR20	Tirzepatide	20mg × 10 vials	$100	$85	Adjusted (-15% Flat Disc.)
TR30	Tirzepatide	30mg × 10 vials	$135	$114	Adjusted (-15% Flat Disc.)
TR40	Tirzepatide	40mg × 10 vials	$160	$136	Adjusted (-15% Flat Disc.)
TR60	Tirzepatide	60mg × 10 vials	$220	$187	Adjusted (-15% Flat Disc.)
TR70	Tirzepatide	70mg × 10 vials	$250	$212	Adjusted (-15% Flat Disc.)
TR80	Tirzepatide	80mg × 10 vials	$280	$238	Adjusted (-15% Flat Disc.)
TR90	Tirzepatide	90mg × 10 vials	$310	$263	Adjusted (-15% Flat Disc.)
TR100	Tirzepatide	100mg × 10 vials	$330	$280	Adjusted (-15% Flat Disc.)
TR120	Tirzepatide	120mg × 10 vials	$350	$297	Adjusted (-15% Flat Disc.)
G25	GHRP-2 Acetate	5mg × 10 vials	$35	$29	Adjusted (-15% Flat Disc.)
G210	GHRP-2 Acetate	10mg × 10 vials	$65	$55	Adjusted (-15% Flat Disc.)
G65	GHRP-6 Acetate	5mg × 10 vials	$35	$29	Adjusted (-15% Flat Disc.)
G610	GHRP-6 Acetate	10mg × 10 vials	$65	$55	Adjusted (-15% Flat Disc.)
CND5	CJC-1295 Without DAC	5mg × 10 vials	$85	$72	Adjusted (-15% Flat Disc.)
CND10	CJC-1295 Without DAC	10mg × 10 vials	$145	$123	Adjusted (-15% Flat Disc.)
CP10	CJC-1295 without DAC 5mg + IPA 5mg	10mg × 10 vials	$105	$89	Adjusted (-15% Flat Disc.)
CD5	CJC-1295 With DAC	5mg × 10 vials	$145	$123	Adjusted (-15% Flat Disc.)
SMO5	Sermorelin Acetate	5mg × 10 vials	$70	$59	Adjusted (-15% Flat Disc.)
SMO10	Sermorelin Acetate	10mg × 10 vials	$140	$119	Adjusted (-15% Flat Disc.)
G10K	HCG	10000IU × 10 vials	$140	$119	Adjusted (-15% Flat Disc.)
G5K	HCG	5000IU × 10 vials	$80	$68	Adjusted (-15% Flat Disc.)
5AD	AOD9604	5mg × 10 vials	$105	$89	Adjusted (-15% Flat Disc.)
10AD	AOD9604	10mg × 10 vials	$195	$165	Adjusted (-15% Flat Disc.)
IG01	IGF-1LR3	0.1mg × 10 vials	$50	$42	Adjusted (-15% Flat Disc.)
IG1	IGF-1LR3	1mg × 10 vials	$200	$170	Adjusted (-15% Flat Disc.)
TSM5	Tesamorelin	5mg × 10 vials	$115	$107	Adjusted (-6.6% Tesa Disc.)
TSM20	Tesamorelin	20mg × 10 vials	$330	$308	Adjusted (-6.6% Tesa Disc.)
IP5	Ipamorelin	5mg × 10 vials	$45	$38	Adjusted (-15% Flat Disc.)
IP10	Ipamorelin	10mg × 10 vials	$78	$66	Adjusted (-15% Flat Disc.)
HX5	Hexarelin Acetate	5mg × 10 vials	$100	$85	Adjusted (-15% Flat Disc.)
CU	GHK-CU	50mg × 10 vials	$40	$34	Adjusted (-15% Flat Disc.)
CU100	GHK-CU	100mg × 10 vials	$70	$59	Adjusted (-15% Flat Disc.)
AU	AHK-CU	50mg × 10 vials	$40	$34	Adjusted (-15% Flat Disc.)
AU100	AHK-CU	100mg × 10 vials	$70	$59	Adjusted (-15% Flat Disc.)
KS5	KissPeptin-10	5mg × 10 vials	$70	$59	Adjusted (-15% Flat Disc.)
KS10	KissPeptin-10	10mg × 10 vials	$110	$93	Adjusted (-15% Flat Disc.)
TY10	Thymalin	10mg × 10 vials	$70	$59	Adjusted (-15% Flat Disc.)
TA5	Thymosin Alpha-1	5mg × 10 vials	$100	$85	Adjusted (-15% Flat Disc.)
TA10	Thymosin Alpha-1	10mg × 10 vials	$170	$144	Adjusted (-15% Flat Disc.)
MS10	MOTS-C	10mg × 10 vials	$74	$64	Adjusted (-13.7% MOTS Disc.)
F410	FOXO4-DRI	10mg × 10 vials	$315	$267	Adjusted (-15% Flat Disc.)
375	LL37	5mg × 10 vials	$100	$85	Adjusted (-15% Flat Disc.)
RT5	Retatrutide	5mg × 10 vials	$80	$52	Adjusted (-35% Reta Disc.)
RT10	Retatrutide	10mg × 10 vials	$120	$78	Adjusted (-35% Reta Disc.)
RT15	Retatrutide	15mg × 10 vials	$150	$97	Adjusted (-35% Reta Disc.)
RT30	Retatrutide	30mg × 10 vials	$250	$162	Adjusted (-35% Reta Disc.)
RT40	Retatrutide	40mg × 10 vials	$290	$188	Adjusted (-35% Reta Disc.)
RT50	Retatrutide	50mg × 10 vials	$310	$201	Adjusted (-35% Reta Disc.)
RT60	Retatrutide	60mg × 10 vials	$330	$214	Adjusted (-35% Reta Disc.)
MT10	Melatonin	10mg × 10 vials	$70	$59	Adjusted (-15% Flat Disc.)
FR5	HGH Fragment 176-191	5mg × 10 vials	$105	$89	Adjusted (-15% Flat Disc.)
DR5	Dermorphin	5mg × 10 vials	$45	$38	Adjusted (-15% Flat Disc.)
DR10	Dermorphin	10mg × 10 vials	$75	$63	Adjusted (-15% Flat Disc.)
GTT	Glutathione	100mg × 10 vials	$50	$42	Adjusted (-15% Flat Disc.)
BA3	Bac. water	3ml × 10 vials	$7	$7	Standard
AA10	Acetic Acid 0.6%	10ml × 10 vials	$15	$15	Standard
CGL5	Cagrilintide	5mg × 10 vials	$125	$106	Adjusted (-15% Flat Disc.)
CGL10	Cagrilintide	10mg × 10 vials	$245	$208	Adjusted (-15% Flat Disc.)
CBL60	Cerebrolysin	60mg × 10 vials	$50	$42	Adjusted (-15% Flat Disc.)
NJ100	NAD+	100mg × 10 vials	$55	$49	Adjusted (-11.4% NAD+ Disc.)
NJ500	NAD+	500mg × 10 vials	$90	$80	Adjusted (-11.4% NAD+ Disc.)
BBG70	GLOW (TB10+BPC10+GHK50)	70mg × 10 vials	$220	$193	Adjusted (-12.2% KLOW Disc.)
RA10	ARA290 (Cibinetide)	10mg × 10 vials	$77	$65	Adjusted (-15% Flat Disc.)
KP10	KPV	10mg × 10 vials	$75	$63	Adjusted (-15% Flat Disc.)
VP10	VIP	10mg × 10 vials	$180	$153	Adjusted (-15% Flat Disc.)
CS10	Cagrilintide 5mg + Semaglutide 5mg	10mg × 10 vials	$185	$157	Adjusted (-15% Flat Disc.)
SUR10	Survotutide	10mg × 10 vials	$280	$238	Adjusted (-15% Flat Disc.)
NP810	SNAP-8	10mg × 10 vials	$50	$42	Adjusted (-15% Flat Disc.)
G75	HMG	75 IU × 10 vials	$70	$59	Adjusted (-15% Flat Disc.)
5AM	5-amino-1mq	5mg × 10 vials	$65	$55	Adjusted (-15% Flat Disc.)
50AM	5-amino-1mq	50mg × 10 vials	$115	$97	Adjusted (-15% Flat Disc.)
B12	B12	10mg × 10 vials	$15	$12	Adjusted (-15% Flat Disc.)
FN1	Follistatin	1mg × 10 vials	$255	$216	Adjusted (-15% Flat Disc.)
PN10	Pinealon	10mg × 10 vials	$70	$59	Adjusted (-15% Flat Disc.)
LE10	Lemon Bottle	10ml × 10 vials	$80	$68	Adjusted (-15% Flat Disc.)
LC600	L-carnitine	600mg × 10 vials	$50	$42	Adjusted (-15% Flat Disc.)
LC10	LIPO-C	10ml × 10 vials	$65	$55	Adjusted (-15% Flat Disc.)
LC216	L-Carnitine Blend (Multi-Ingredient)	10ml × 10 vials	$110	$93	Adjusted (-15% Flat Disc.)
`;

async function run() {
  const lines = rawData.trim().split('\n');
  const productsToInsert = lines.map(line => {
    const [sku, name, spec, basePriceRaw, adjustedPriceRaw, notes] = line.split('\t');
    
    // Parse price safely, removing $
    const baseCost = parseFloat(basePriceRaw.replace('$', ''));
    const adjustedCost = parseFloat(adjustedPriceRaw.replace('$', ''));

    // Create a slug from the name + sku to avoid conflicts
    const slug = (name + '-' + sku).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    return {
      sku: sku.trim(),
      name: name.trim(),
      slug: slug,
      category: 'Peptides',
      base_cost: baseCost,
      description: `Specification: ${spec} | Adjusted Agent Price: $${adjustedCost} | Notes: ${notes}`,
      is_active: true,
      in_stock: true,
      inventory_count: 100, // default placeholder
      weight_oz: 0.5
    };
  });

  // Insert the products
  const { data, error } = await supabase
    .from('products')
    .insert(productsToInsert);

  if (error) {
    console.error('Error inserting products:', error);
  } else {
    console.log(`Successfully upserted ${productsToInsert.length} products.`);
  }
}
run();
