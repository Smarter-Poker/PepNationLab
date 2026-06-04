const fs = require('fs');
let content = fs.readFileSync('components/research/CalculatorSuite.tsx', 'utf8');

// POPULAR PEPTIDES DATA
const popularPeptides = `
const POPULAR_PEPTIDES = [
  { name: 'Custom (Enter Manually)', vialMass: '', defaultDose: '', unit: 'mcg' },
  { name: 'BPC-157', vialMass: '5', defaultDose: '250', unit: 'mcg' },
  { name: 'TB-500', vialMass: '5', defaultDose: '2.5', unit: 'mg' },
  { name: 'CJC-1295 / Ipamorelin', vialMass: '5', defaultDose: '300', unit: 'mcg' },
  { name: 'Tirzepatide', vialMass: '10', defaultDose: '2.5', unit: 'mg' },
  { name: 'Semaglutide', vialMass: '5', defaultDose: '0.25', unit: 'mg' },
  { name: 'Retatrutide', vialMass: '10', defaultDose: '2', unit: 'mg' },
  { name: 'GHK-Cu', vialMass: '50', defaultDose: '2', unit: 'mg' },
  { name: 'Melanotan II', vialMass: '10', defaultDose: '250', unit: 'mcg' },
  { name: 'PT-141', vialMass: '10', defaultDose: '1', unit: 'mg' },
  { name: 'MOTS-c', vialMass: '10', defaultDose: '5', unit: 'mg' }
];
`;

content = content.replace("function CalculatorHeader({ title, why }: { title: string; why: string }) {", popularPeptides + "\nfunction CalculatorHeader({ title, why }: { title: string; why: string }) {");

// New Reconstitution Function
const newReconstitution = `
function Reconstitution() {
  const [peptide, setPeptide] = useState(POPULAR_PEPTIDES[0].name);
  const [vialMass, setVialMass] = useState('');
  const [diluentMl, setDiluentMl] = useState('');
  const [desiredMass, setDesiredMass] = useState('');
  const [unit, setUnit] = useState('mcg');

  // When peptide changes, update defaults
  const handlePeptideChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setPeptide(val);
    const found = POPULAR_PEPTIDES.find(p => p.name === val);
    if (found && found.name !== 'Custom (Enter Manually)') {
      setVialMass(found.vialMass);
      setDesiredMass(found.defaultDose);
      setUnit(found.unit);
      setDiluentMl('2'); // standard recommendation
    } else {
      setVialMass('');
      setDesiredMass('');
      setDiluentMl('');
    }
  };

  const vMass = Number(vialMass);
  const dilMl = Number(diluentMl);
  // desiredMass in the helper expects mg, so convert if mcg
  const dMassNumeric = Number(desiredMass);
  const dMassMg = unit === 'mcg' ? dMassNumeric / 1000 : dMassNumeric;

  const drawMl = drawVolumeMl(vMass, dilMl, dMassMg);
  const drawUnits = drawMl !== null && isFinite(drawMl) ? Math.round(drawMl * 100) : null;

  return (
    <section id="reconstitution" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="Reconstitution Calculator"
          why="Most peptides ship freeze-dried. Reconstitution turns the powder into a usable working stock. Select your peptide or enter values manually to get plain-English preparation and drawing instructions."
        />
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 16 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Step 1: Select Peptide</div>
            <StyledSelect value={peptide} onChange={handlePeptideChange}>
              {POPULAR_PEPTIDES.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </StyledSelect>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Step 2: Vial Mass (mg)</div>
            <StyledInput type="number" step="any" min={0} value={vialMass} placeholder="e.g. 5" onChange={(e) => setVialMass(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Step 3: Bacteriostatic Water Added (mL)</div>
            <StyledInput type="number" step="any" min={0} value={diluentMl} placeholder="e.g. 2" onChange={(e) => setDiluentMl(e.target.value)} />
          </label>
        </div>

        <div style={{ ...resultStyle, marginTop: 20 }}>
          {vMass > 0 && dilMl > 0 ? (
            <div style={{ color: '#00E5FF', fontWeight: 800, fontSize: 18 }}>
              Add {dilMl} mL of sterile diluent to the vial.
            </div>
          ) : (
            <div>Enter vial mass and diluent volume above.</div>
          )}
        </div>

        <h3 style={{ margin: '24px 0 8px', color: '#FFFFFF', fontSize: 16 }}>Draw Volume Helper</h3>
        <p style={{ color: '#A8B4C0', fontSize: 14, marginBottom: 16 }}>
          How much do you want to draw for a single dose?
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <label style={{ display: "block" }}>
            <div style={labelStyle}>Desired Target Dose</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <StyledInput style={{ flex: 1 }} type="number" step="any" min={0} value={desiredMass} placeholder="e.g. 250" onChange={(e) => setDesiredMass(e.target.value)} />
              <StyledSelect style={{ width: 80 }} value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="mcg">mcg</option>
                <option value="mg">mg</option>
              </StyledSelect>
            </div>
          </label>
        </div>

        <div style={{ ...resultStyle, marginTop: 20 }}>
          {drawMl !== null && isFinite(drawMl) && drawMl > 0 ? (
            <div>
              To draw a dose of <strong>{dMassNumeric} {unit}</strong>, pull the syringe to 
              <br/>
              <span style={{ fontSize: 24, color: '#68D391', fontWeight: 800, display: 'block', margin: '12px 0' }}>
                {drawUnits} units
              </span>
              <span style={{ fontSize: 13, color: '#A8B4C0' }}>(on a standard U-100 syringe. That is {drawMl.toFixed(3)} mL)</span>
            </div>
          ) : (
            <div>Enter a desired dose above.</div>
          )}
        </div>

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}
`;

// Regex replace multi-line block
content = content.replace(/function Reconstitution\(\) \{[\s\S]*?<\/section>\s*\);\s*\}/, newReconstitution.trim());

// Remove defaults from DilutionSection
content = content.replace(/const \[stock, setStock\] = useState\('100'\);/, "const [stock, setStock] = useState('');");
content = content.replace(/const \[factor, setFactor\] = useState\('10'\);/, "const [factor, setFactor] = useState('');");
content = content.replace(/const \[steps, setSteps\] = useState\('5'\);/, "const [steps, setSteps] = useState('');");

// Remove defaults from ConcentrationSection
content = content.replace(/const \[value, setValue\] = useState\('1'\);/, "const [value, setValue] = useState('');");
content = content.replace(/const \[mw, setMw\] = useState\('3367'\);/, "const [mw, setMw] = useState('');");

// Remove defaults from StabilitySection
content = content.replace(/const \[shelf, setShelf\] = useState\('28'\);/, "const [shelf, setShelf] = useState('');");
content = content.replace(/const \[tFrom, setTFrom\] = useState\('4'\);/, "const [tFrom, setTFrom] = useState('');");
content = content.replace(/const \[tTo, setTTo\] = useState\('25'\);/, "const [tTo, setTTo] = useState('');");
content = content.replace(/const \[ea, setEa\] = useState\('83'\);/, "const [ea, setEa] = useState('');");

// Remove defaults from CostSection
content = content.replace(/const \[price, setPrice\] = useState\('120'\);/, "const [price, setPrice] = useState('');");
content = content.replace(/const \[mass, setMass\] = useState\('5'\);/, "const [mass, setMass] = useState('');");
content = content.replace(/const \[dose, setDose\] = useState\('250'\);/, "const [dose, setDose] = useState('');");

// Remove defaults from PoolingSection
content = content.replace(/const \[mass, setMass\] = useState\('5'\);/, "const [mass, setMass] = useState('');");
content = content.replace(/const \[count, setCount\] = useState\('3'\);/, "const [count, setCount] = useState('');");
content = content.replace(/const \[diluent, setDiluent\] = useState\('10'\);/, "const [diluent, setDiluent] = useState('');");

// Add Advanced Toggle logic to complex sections
const advancedToggle = `
  const [showAdvanced, setShowAdvanced] = useState(false);
`;

// HplcRtSection
content = content.replace(/function HplcRtSection\(\) \{/, "function HplcRtSection() {\\n" + advancedToggle);
content = content.replace(/const \[seq, setSeq\] = useState\('GIGAVLKVLTTGLPALISWIKRKRQQ'\);/, "const [seq, setSeq] = useState('');");
content = content.replace(/const \[start, setStart\] = useState\('5'\);/, "const [start, setStart] = useState('');");
content = content.replace(/const \[end, setEnd\] = useState\('65'\);/, "const [end, setEnd] = useState('');");
content = content.replace(/const \[gradient, setGradient\] = useState\('20'\);/, "const [gradient, setGradient] = useState('');");
content = content.replace(/<div style=\{\{ display: 'grid', gridTemplateColumns: 'repeat\(auto-fit, minmax\(150px, 1fr\)\)', gap: 12, marginTop: 12 \}\}>/m, 
  "<button type=\\"button\\" onClick={() => setShowAdvanced(!showAdvanced)} style={{ background: 'transparent', border: '1px solid rgba(168,178,193,0.3)', color: '#A8B2C1', padding: '6px 12px', borderRadius: 6, fontSize: 12, marginTop: 12, cursor: 'pointer' }}>{showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}</button>\\n      {showAdvanced && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 12 }}>");
content = content.replace(/(<label style=\{\{ display: "block" \}\}>\s*<div style=\{labelStyle\}>Gradient Length \(Min\)<\/div>[\s\S]*?<\/label>\s*<\/div>)/, "$1}");

// MassSpecSection
content = content.replace(/function MassSpecSection\(\) \{/, "function MassSpecSection() {\\n" + advancedToggle);
content = content.replace(/const \[seq, setSeq\] = useState\('GIGAVLKVLTTGLPALISWIKRKRQQ'\);/, "const [seq, setSeq] = useState('');");
content = content.replace(/const \[maxCharge, setMaxCharge\] = useState\('4'\);/, "const [maxCharge, setMaxCharge] = useState('');");
content = content.replace(/<div style=\{\{ display: 'grid', gridTemplateColumns: 'repeat\(auto-fit, minmax\(150px, 1fr\)\)', gap: 12, marginTop: 12 \}\}>/m, 
  "<button type=\\"button\\" onClick={() => setShowAdvanced(!showAdvanced)} style={{ background: 'transparent', border: '1px solid rgba(168,178,193,0.3)', color: '#A8B2C1', padding: '6px 12px', borderRadius: 6, fontSize: 12, marginTop: 12, cursor: 'pointer' }}>{showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}</button>\\n      {showAdvanced && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 12 }}>");
content = content.replace(/(<label style=\{\{ display: "block" \}\}>\s*<div style=\{labelStyle\}>Max Charge State<\/div>[\s\S]*?<\/label>\s*<\/div>)/, "$1}");

// SppsSection
content = content.replace(/function SppsSection\(\) \{/, "function SppsSection() {\\n" + advancedToggle);
content = content.replace(/const \[seq, setSeq\] = useState\('GIGAVLKVLTTGLPALISWIKRKRQQ'\);/, "const [seq, setSeq] = useState('');");
content = content.replace(/const \[scale, setScale\] = useState\('100'\);/, "const [scale, setScale] = useState('');");
content = content.replace(/const \[aaCost, setAaCost\] = useState\('10'\);/, "const [aaCost, setAaCost] = useState('');");
content = content.replace(/const \[resinCost, setResinCost\] = useState\('20'\);/, "const [resinCost, setResinCost] = useState('');");
content = content.replace(/<div style=\{\{ display: 'grid', gridTemplateColumns: 'repeat\(auto-fit, minmax\(150px, 1fr\)\)', gap: 12, marginTop: 12 \}\}>/m, 
  "<button type=\\"button\\" onClick={() => setShowAdvanced(!showAdvanced)} style={{ background: 'transparent', border: '1px solid rgba(168,178,193,0.3)', color: '#A8B2C1', padding: '6px 12px', borderRadius: 6, fontSize: 12, marginTop: 12, cursor: 'pointer' }}>{showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}</button>\\n      {showAdvanced && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 12 }}>");
content = content.replace(/(<label style=\{\{ display: "block" \}\}>\s*<div style=\{labelStyle\}>Resin Cost \(\$\/g\)<\/div>[\s\S]*?<\/label>\s*<\/div>)/, "$1}");

// SolubilitySection
content = content.replace(/function SolubilitySection\(\) \{/, "function SolubilitySection() {\\n" + advancedToggle);
content = content.replace(/const \[gravy, setGravy\] = useState\('0.5'\);/, "const [gravy, setGravy] = useState('');");
content = content.replace(/const \[pi, setPi\] = useState\('7.0'\);/, "const [pi, setPi] = useState('');");
content = content.replace(/const \[len, setLen\] = useState\('20'\);/, "const [len, setLen] = useState('');");
content = content.replace(/const \[pH, setPH\] = useState\('7.4'\);/, "const [pH, setPH] = useState('');");
content = content.replace(/<div style=\{\{ display: 'grid', gridTemplateColumns: 'repeat\(auto-fit, minmax\(150px, 1fr\)\)', gap: 12 \}\}>/m, 
  "<button type=\\"button\\" onClick={() => setShowAdvanced(!showAdvanced)} style={{ background: 'transparent', border: '1px solid rgba(168,178,193,0.3)', color: '#A8B2C1', padding: '6px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12, cursor: 'pointer' }}>{showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}</button>\\n      {showAdvanced && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>");
content = content.replace(/(<label style=\{\{ display: "block" \}\}>\s*<div style=\{labelStyle\}>Solution pH<\/div>[\s\S]*?<\/label>\s*<\/div>)/, "$1}");

// VialQuantitySection
content = content.replace(/function VialQuantitySection\(\) \{/, "function VialQuantitySection() {\\n" + advancedToggle);
content = content.replace(/const \[n, setN\] = useState\('30'\);/, "const [n, setN] = useState('');");
content = content.replace(/const \[doses, setDoses\] = useState\('12'\);/, "const [doses, setDoses] = useState('');");
content = content.replace(/const \[mgPerDose, setMgPerDose\] = useState\('0.25'\);/, "const [mgPerDose, setMgPerDose] = useState('');");
content = content.replace(/const \[mgPerVial, setMgPerVial\] = useState\('5'\);/, "const [mgPerVial, setMgPerVial] = useState('');");
content = content.replace(/<div style=\{\{ display: 'grid', gridTemplateColumns: 'repeat\(auto-fit, minmax\(150px, 1fr\)\)', gap: 12 \}\}>/m, 
  "<button type=\\"button\\" onClick={() => setShowAdvanced(!showAdvanced)} style={{ background: 'transparent', border: '1px solid rgba(168,178,193,0.3)', color: '#A8B2C1', padding: '6px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12, cursor: 'pointer' }}>{showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}</button>\\n      {showAdvanced && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>");
content = content.replace(/(<label style=\{\{ display: "block" \}\}>\s*<div style=\{labelStyle\}>Mg Per Vial<\/div>[\s\S]*?<\/label>\s*<\/div>)/, "$1}");

fs.writeFileSync('components/research/CalculatorSuite.tsx', content);
console.log('CalculatorSuite.tsx updated successfully.');
