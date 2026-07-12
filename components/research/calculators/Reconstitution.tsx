'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { drawVolumeMl } from '@/lib/research/calculators';
import { toast } from 'sonner';
import {
  VisualSyringe,
  StyledInput,
  StyledSelect,
  CalculatorHeader,
  SaveToJournalButton,
  chromeOuterStyle,
  chromeInnerStyle,
  labelStyle,
  resultStyle,
  noteStyle,
  RESEARCH_NOTE,
  type CompoundListItem,
} from './_shared';

const POPULAR_PEPTIDES = [
  { name: 'Custom (Enter Manually)', vialMass: '10', defaultDose: '1', unit: 'mg' },
  { name: 'BPC-157', vialMass: '5', defaultDose: '250', unit: 'mcg' },
  { name: 'TB-500', vialMass: '5', defaultDose: '1', unit: 'mg' },
  { name: 'CJC-1295 / Ipamorelin', vialMass: '5', defaultDose: '300', unit: 'mcg' },
  { name: 'Tirzepatide', vialMass: '10', defaultDose: '1', unit: 'mg' },
  { name: 'Semaglutide', vialMass: '5', defaultDose: '0.25', unit: 'mg' },
  { name: 'Retatrutide', vialMass: '10', defaultDose: '1', unit: 'mg' },
  { name: 'GHK-Cu', vialMass: '50', defaultDose: '1', unit: 'mg' },
  { name: 'Melanotan II', vialMass: '10', defaultDose: '250', unit: 'mcg' },
  { name: 'PT-141', vialMass: '10', defaultDose: '1', unit: 'mg' },
  { name: 'MOTS-c', vialMass: '10', defaultDose: '1', unit: 'mg' },
];

export function ReconstitutionSection({ compounds }: { compounds: CompoundListItem[] }) {
  const [peptide, setPeptide] = useState(POPULAR_PEPTIDES[0].name);
  const [vialMass, setVialMass] = useState('10');
  const [diluentMl, setDiluentMl] = useState('2');
  const [desiredMass, setDesiredMass] = useState('1');
  const [unit, setUnit] = useState('mg');
  const [syringeSize, setSyringeSize] = useState<0.3 | 0.5 | 1.0>(1.0);
  const [syringeType, setSyringeType] = useState<'u100' | 'u40' | 'u80'>('u100');
  const [diluentType, setDiluentType] = useState<'bac-water' | 'acetic-acid'>('bac-water');
  const [showGuide, setShowGuide] = useState(false);

  const peptideList = useMemo(() => {
    const dbPeptides = compounds.map(c => ({
      name: c.display_name,
      vialMass: '10',
      defaultDose: '1',
      unit: 'mg',
    }));
    return [...POPULAR_PEPTIDES, ...dbPeptides];
  }, [compounds]);

  const handlePeptideChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setPeptide(val);
    const found = peptideList.find(p => p.name === val);
    if (found && found.name !== 'Custom (Enter Manually)') {
      setVialMass(found.vialMass || '10');
      setDesiredMass(found.defaultDose || '1');
      setUnit(found.unit || 'mg');
      setDiluentMl('2');
    } else {
      setVialMass('');
      setDesiredMass('1');
      setDiluentMl('');
      setUnit('mg');
    }
  };

  const vMass = Number(vialMass);
  const dilMl = Number(diluentMl);
  const dMassNumeric = Number(desiredMass);
  const dMassMg = unit === 'mcg' ? dMassNumeric / 1000 : dMassNumeric;

  const drawMl = drawVolumeMl(vMass, dilMl, dMassMg);

  const isIgf = peptide.toLowerCase().includes('igf');

  useEffect(() => {
    if (isIgf) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setDiluentType('acetic-acid');
    } else {
      setDiluentType('bac-water');
    }
  }, [isIgf]);

  const syringeMultiplier = syringeType === 'u40' ? 40 : syringeType === 'u80' ? 80 : 100;

  const handleDrawMlChange = (newMl: number) => {
    if (vMass <= 0 || dilMl <= 0) return;
    const concentration = vMass / dilMl; // mg/mL
    const desiredMg = newMl * concentration;
    const finalVal = unit === 'mcg' ? desiredMg * 1000 : desiredMg;
    const rounded = Number(finalVal.toFixed(3));
    setDesiredMass(rounded.toString());
  };

  const totalDoses = dMassMg > 0 ? vMass / dMassMg : 0;
  const showExhaustionWarning = dMassMg > vMass;

  const getStabilityAdvice = () => {
    const name = peptide.toLowerCase();
    if (name.includes('tirzepatide') || name.includes('semaglutide') || name.includes('retatrutide')) {
      return {
        title: 'GLP-1 Stability Advice',
        advice: 'GLP-1 Receptor Agonists Are Highly Sensitive To Thermal Stress And Vigorous Mechanical Agitation. Store At <span class="calc-no-capitalize">36-46°F (2-8°C)</span> And Protect From Light. Do Not Freeze. Reconstituted Vials Remain Thermally Stable For Up To 28 Days Under Proper Refrigeration. Swirl Gently To Mix; Do Not Shake.',
      };
    } else if (name.includes('bpc-157') || name.includes('bpc157')) {
      return {
        title: 'BPC-157 Stability Advice',
        advice: 'BPC-157 Exhibits High Structural Resilience Compared To Most Peptides. However, Reconstituted Solutions In Bacteriostatic Water Must Be Kept Refrigerated At <span class="calc-no-capitalize">36-46°F</span> To Prevent Degradation And Inhibit Bacterial Proliferation. Reconstituted Solutions Are Best Used Within 30 Days.',
      };
    } else if (name.includes('igf') || name.includes('lr3')) {
      return {
        title: 'IGF-1 Stability Advice',
        advice: 'IGF-1 Analogues Precipitate Rapidly In Standard Aqueous Solutions. Reconstitute In <span class="calc-no-capitalize">0.6%</span> Acetic Acid As Recommended Above To Maintain Stability. Keep Reconstituted Solutions Refrigerated At <span class="calc-no-capitalize">36-46°F</span> And Use Within 14 Days For Maximum Active Recoverability.',
      };
    } else {
      return {
        title: 'Standard Peptide Stability Advice',
        advice: 'Lyophilized Peptides Are Fragile Biomolecules. Once Reconstituted, Keep Refrigerated At <span class="calc-no-capitalize">36-46°F (2-8°C)</span>. Protect Vials From Vibration, Thermal Shock, And Ultraviolet Light. Swirl Gently To Dissolve; Never Shake Reconstituted Vials.',
      };
    }
  };

  const stability = getStabilityAdvice();

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) {
      toast.error('Pop-Up Blocker Prevented Opening The Print Layout. Please Enable Pop-Ups.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Reconstitution Protocol Sheet - ${peptide}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #111827;
              padding: 40px;
              max-width: 600px;
              margin: 0 auto;
            }
            .card {
              border: 2px solid #10B981;
              border-radius: 12px;
              padding: 24px;
              background: #F9FAFB;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            }
            h1 {
              font-size: 20px;
              color: #047857;
              margin-top: 0;
              border-bottom: 2px solid #E5E7EB;
              padding-bottom: 12px;
              text-transform: capitalize;
            }
            .recipe-item {
              margin: 16px 0;
              font-size: 15px;
              line-height: 1.5;
            }
            .recipe-label {
              font-weight: bold;
              color: #4B5563;
              text-transform: capitalize;
            }
            .recipe-value {
              font-family: monospace;
              font-size: 16px;
              color: #111827;
              font-weight: bold;
            }
            .alert-box {
              background: #E6F7F6;
              border-left: 4px solid #00C4BC;
              padding: 12px;
              margin-top: 20px;
              border-radius: 4px;
              font-size: 13px;
              color: #0B4F4C;
            }
            .footer {
              margin-top: 30px;
              font-size: 11px;
              color: #9CA3AF;
              text-align: center;
              font-style: italic;
            }
            @media print {
              body { padding: 0; }
              .card { border: 1px solid #10B981; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Reconstitution Protocol Sheet</h1>
            <div class="recipe-item">
              <span class="recipe-label">Peptide Compound:</span>
              <span class="recipe-value">${peptide}</span>
            </div>
            <div class="recipe-item">
              <span class="recipe-label">Vial Mass:</span>
              <span class="recipe-value">${vMass} mg</span>
            </div>
            <div class="recipe-item">
              <span class="recipe-label">Reconstitution Diluent:</span>
              <span class="recipe-value">${dilMl} mL (${diluentType === 'bac-water' ? 'Bacteriostatic Water' : '0.6% Acetic Acid'})</span>
            </div>
            <div class="recipe-item">
              <span class="recipe-label">Desired Target Dose:</span>
              <span class="recipe-value">${dMassNumeric} ${unit}</span>
            </div>
            <div class="recipe-item" style="background: #ECFDF5; padding: 12px; border-radius: 8px; border: 1px solid #A7F3D0; margin-top: 20px;">
              <span class="recipe-label" style="font-size: 16px; color: #065F46;">Recommended Syringe Draw:</span>
              <span class="recipe-value" style="font-size: 22px; color: #047857; display: block; margin-top: 4px;">
                ${drawMl !== null && isFinite(drawMl) ? Math.round(drawMl * syringeMultiplier) : 0} Units (${syringeType.toUpperCase()})
              </span>
              <span style="font-size: 12px; color: #065F46; display: block; margin-top: 2px;">
                (${drawMl !== null && isFinite(drawMl) ? drawMl.toFixed(3) : 0} mL drawn on a ${syringeSize} mL insulin syringe)
              </span>
            </div>

            ${isIgf ? `
              <div class="alert-box">
                IGF-1 Stability Notice: Diluted In 0.6% Acetic Acid To Maintain Long-Term Solubility And Prevent Rapid Isoelectric Precipitation.
              </div>
            ` : ''}

            <div class="footer">
              ${RESEARCH_NOTE}
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <section id="reconstitution" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="Reconstitution & Syringe Calculator"
          why="Lyophilized Peptide Preparation Guidelines. Select Standard Compounds, Configure Diluent Matrices, And Visually Confirm Draw Volumes Using Standard Insulin Syringe Models."
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 16 }}>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Step 1: Select Peptide</div>
            <StyledSelect value={peptide} onChange={handlePeptideChange}>
              {peptideList.map((p, idx) => <option key={`${p.name}-${idx}`} value={p.name}>{p.name}</option>)}
            </StyledSelect>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Step 2: Vial Mass (<span className="calc-no-capitalize">MG</span>)</div>
            <StyledInput type="number" step="any" min={0} value={vialMass} placeholder="e.g. 5" onChange={(e) => setVialMass(e.target.value)} />
          </label>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Step 3: Diluent Added (<span className="calc-no-capitalize">mL</span>)</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              {['concentrated (1mL)', 'standard (2mL)', 'diluted (3mL)'].map(mode => {
                const ml = mode.includes('1mL') ? '1' : mode.includes('3mL') ? '3' : '2';
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDiluentMl(ml)}
                    style={{
                      padding: '6px 12px', borderRadius: 6, fontWeight: 700, fontSize: '0.8rem', textTransform: 'capitalize',
                      background: diluentMl === ml ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.05)',
                      border: diluentMl === ml ? '1px solid #00E5FF' : '1px solid rgba(255,255,255,0.1)',
                      color: diluentMl === ml ? '#00E5FF' : '#A8B4C0',
                      cursor: 'pointer', transition: 'all 0.2s', flex: 1,
                    }}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
            <StyledInput type="number" step="any" min={0} value={diluentMl} placeholder="e.g. 2" onChange={(e) => setDiluentMl(e.target.value)} />
          </label>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Diluent Type</div>
            <StyledSelect value={diluentType} onChange={(e) => setDiluentType(e.target.value as 'bac-water' | 'acetic-acid')}>
              <option value="bac-water">Bacteriostatic Water</option>
              <option value="acetic-acid">Acetic Acid (0.6%)</option>
            </StyledSelect>
          </label>
        </div>

        {isIgf && (
          <div style={{ color: '#F6AD55', fontSize: 13, padding: '8px 12px', border: '1px solid rgba(246,173,85,0.3)', borderRadius: 6, background: 'rgba(246,173,85,0.05)', marginBottom: 12 }}>
            Stability Warning: <span className="calc-no-capitalize">IGF-1</span> Family Peptides Precipitate Quickly In Neutral <span className="calc-no-capitalize">pH</span> (Bacteriostatic Water). Reconstituting In <span className="calc-no-capitalize">0.6%</span> Acetic Acid Maintains Solubility And Shelf-Stability.
          </div>
        )}

        <div aria-live="polite" style={{ ...resultStyle, marginTop: 12 }}>
          {vMass > 0 && dilMl > 0 ? (
            <div style={{ color: '#00E5FF', fontWeight: 800, fontSize: 18 }}>
              Add {dilMl} <span className="calc-no-capitalize">mL</span> Of {diluentType === 'bac-water' ? 'Bacteriostatic Water' : '0.6% Acetic Acid'} To The Vial.
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8, color: '#68D391' }}>
                Concentration: {(vMass / dilMl).toFixed(2)} mg / mL ({((vMass / dilMl) * 1000).toFixed(0)} mcg / mL)
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 14 }}>Enter Vial Mass And Diluent Volume Above.</div>
          )}
        </div>

        <h3 style={{ margin: '24px 0 8px', color: '#FFFFFF', fontSize: 16 }}>Draw Volume & Syringe Visualizer</h3>
        <p style={{ color: '#A8B4C0', fontSize: 14, marginBottom: 16 }}>
          Input Desired Target Dose To Map Pulling Volume To Tick Marks.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Desired Target Dose</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <StyledInput style={{ flex: 1 }} type="number" step="any" min={0} value={desiredMass} placeholder="e.g. 1" onChange={(e) => setDesiredMass(e.target.value)} />
              <StyledSelect style={{ width: 90 }} value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="mcg" className="calc-no-capitalize">mcg</option>
                <option value="mg" className="calc-no-capitalize">mg</option>
              </StyledSelect>
            </div>
          </label>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Insulin Syringe Capacity</div>
            <StyledSelect value={syringeSize} onChange={(e) => setSyringeSize(Number(e.target.value) as 0.3 | 0.5 | 1.0)}>
              <option value="1.0"><span className="calc-no-capitalize">1.0 mL</span> ({syringeMultiplier} Units Max)</option>
              <option value="0.5"><span className="calc-no-capitalize">0.5 mL</span> ({Math.round(0.5 * syringeMultiplier)} Units Max)</option>
              <option value="0.3"><span className="calc-no-capitalize">0.3 mL</span> ({Math.round(0.3 * syringeMultiplier)} Units Max)</option>
            </StyledSelect>
          </label>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Syringe Concentration Type</div>
            <StyledSelect value={syringeType} onChange={(e) => setSyringeType(e.target.value as 'u100' | 'u40' | 'u80')}>
              <option value="u100">U-100 (Standard, 100 U/mL)</option>
              <option value="u40">U-40 (Veterinary, 40 U/mL)</option>
              <option value="u80">U-80 (Specialized, 80 U/mL)</option>
            </StyledSelect>
          </label>
        </div>

        {drawMl !== null && isFinite(drawMl) && drawMl > 0 ? (
          <>
            <div aria-live="polite" style={{ ...resultStyle, marginTop: 20 }}>
              To Draw A Dose Of <strong>{dMassNumeric} <span className="calc-no-capitalize">{unit}</span></strong>, Pull Liquid To:
              <span style={{ fontSize: 28, color: '#68D391', fontWeight: 800, display: 'block', margin: '8px 0' }}>
                {Math.round(drawMl * syringeMultiplier)} Units ({syringeType.toUpperCase()})
              </span>
              <span style={{ fontSize: 13, color: '#A8B4C0' }}>
                (<span className="calc-no-capitalize">{drawMl.toFixed(3)} mL</span> Of Working Solution)
              </span>

              {!showExhaustionWarning && totalDoses > 0 && (
                <div style={{ marginTop: 16, borderTop: '1px dashed rgba(0, 229, 255, 0.2)', paddingTop: 12, fontSize: 13, color: '#A8B4C0' }}>
                  Timeline Summary: This <span className="calc-no-capitalize">{vMass} mg</span> Vial Yields Approximately <strong>{Math.floor(totalDoses)}</strong> Draws Of <span className="calc-no-capitalize">{dMassNumeric} {unit}</span>.
                </div>
              )}
            </div>

            {showExhaustionWarning && (
              <div style={{ color: '#FF6B6B', fontSize: 13, padding: '12px', border: '1px dashed rgba(255,107,107,0.3)', borderRadius: 6, background: 'rgba(255,107,107,0.05)', marginTop: 12, textAlign: 'center' }}>
                Warning: Desired Target Dose <span className="calc-no-capitalize">({dMassNumeric} {unit})</span> Exceeds Total Vial Capacity <span className="calc-no-capitalize">({vMass} mg)</span>. Please Adjust Vial Mass Or Desired Target Dose.
              </div>
            )}

            {drawMl !== null && isFinite(drawMl) && drawMl > syringeSize && (
              <div style={{ color: '#FF6B6B', fontSize: 13, padding: '12px', border: '1px dashed rgba(255,107,107,0.3)', borderRadius: 6, background: 'rgba(255,107,107,0.05)', marginTop: 12, textAlign: 'center' }}>
                Warning: This Draw <span className="calc-no-capitalize">({drawMl.toFixed(2)} mL)</span> Exceeds Your Selected <span className="calc-no-capitalize">{syringeSize} mL</span> Syringe. Use A Larger Syringe, Split The Dose Across Multiple Draws, Or Increase The Concentration By Using Less Diluent.
              </div>
            )}

            <VisualSyringe ml={drawMl} size={syringeSize} type={syringeType} onDrawMlChange={handleDrawMlChange} />
          </>
        ) : (
          <div style={{ ...resultStyle, marginTop: 20, fontSize: 14 }}>Enter A Desired Dose Above.</div>
        )}

        {/* Dynamic Stability Advice Section */}
        <div style={{ marginTop: 20, padding: 16, borderRadius: 10, background: 'rgba(0, 229, 255, 0.02)', border: '1px solid rgba(0, 229, 255, 0.1)', color: '#A8B2C1', fontSize: 13, lineHeight: 1.5 }}>
          <h4 style={{ margin: '0 0 6px', color: '#00E5FF', fontSize: 14, fontWeight: 700 }}>
            {stability.title}
          </h4>
          <p style={{ margin: 0 }} dangerouslySetInnerHTML={{ __html: stability.advice }} />
        </div>

        {vMass > 0 && dilMl > 0 && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <SaveToJournalButton
              title={`Reconstitution Recipe - ${peptide}`}
              noteText={`Peptide Name: ${peptide}
Vial Mass: ${vMass} mg
Diluent Volume: ${dilMl} mL (${diluentType === 'bac-water' ? 'Bacteriostatic Water' : '0.6% Acetic Acid'})
Target Dose: ${dMassNumeric} ${unit}
Syringe Type: ${syringeType.toUpperCase()} (${syringeMultiplier} U/mL)
Recommended Syringe Draw: ${drawMl !== null && isFinite(drawMl) ? Math.round(drawMl * syringeMultiplier) : 0} Units (On A ${syringeSize} mL Syringe)`}
              compoundSlug={compounds.find(c => c.display_name === peptide)?.slug || null}
            />
            <button
              type="button"
              onClick={handlePrint}
              style={{
                background: 'transparent',
                border: '1px solid #00E5FF',
                color: '#00E5FF',
                padding: '8px 16px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginTop: 12,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 229, 255, 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              Print Protocol Sheet
            </button>
          </div>
        )}

        {/* Needle Gauge & Syringe Ticks Reference Guide */}
        <div style={{ marginTop: 24, borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 16 }}>
          <button
            type="button"
            aria-expanded={showGuide}
            onClick={() => setShowGuide(!showGuide)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#A8B2C1',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: 0,
            }}
          >
            <svg
              style={{ transform: showGuide ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', width: 16, height: 16 }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            Needle Gauge & Syringe Ticks Reference Guide
          </button>

          {showGuide && (
            <div style={{ marginTop: 12, padding: 16, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: '#9CA3AF', lineHeight: 1.6 }}>
              <h4 style={{ margin: '0 0 8px', color: '#FFFFFF', fontSize: 14 }}>Reading Insulin Syringe Tick Marks</h4>
              <p style={{ margin: '0 0 12px' }}>
                Insulin Syringes Are Divided Into Units Rather Than Milliliters. For A Standard <span className="calc-no-capitalize">U-100</span> Concentration:
              </p>
              <ul style={{ margin: '0 0 16px', paddingLeft: 20 }}>
                <li><strong style={{ color: '#E5E7EB' }}>1.0 <span className="calc-no-capitalize">mL</span> Syringe:</strong> Each Tick Mark Represents 2 Units (<span className="calc-no-capitalize">0.02 mL</span>). Major Numbers Are Placed Every 10 Units.</li>
                <li><strong style={{ color: '#E5E7EB' }}>0.5 <span className="calc-no-capitalize">mL</span> Syringe:</strong> Each Tick Mark Represents 1 Unit (<span className="calc-no-capitalize">0.01 mL</span>). Major Numbers Are Placed Every 5 Or 10 Units.</li>
                <li><strong style={{ color: '#E5E7EB' }}>0.3 <span className="calc-no-capitalize">mL</span> Syringe:</strong> Each Tick Mark Represents 1 Unit (<span className="calc-no-capitalize">0.01 mL</span>) Or 0.5 Units (<span className="calc-no-capitalize">0.005 mL</span>). Major Numbers Are Placed Every 5 Units.</li>
              </ul>

              <h4 style={{ margin: '0 0 8px', color: '#FFFFFF', fontSize: 14 }}>Selecting Needle Gauge Sizes</h4>
              <p style={{ margin: '0 0 12px' }}>
                Needle Gauge (G) Measures The Thickness Of The Needle. Larger Gauge Numbers Indicate Thinner Needles:
              </p>
              <ul style={{ margin: '0 0 16px', paddingLeft: 20 }}>
                <li><strong style={{ color: '#E5E7EB' }} className="calc-no-capitalize">31G (31 Gauge):</strong> Ultra-Thin Needle. Provides Minimal Discomfort. Recommended For Standard Aqueous Solutions.</li>
                <li><strong style={{ color: '#E5E7EB' }} className="calc-no-capitalize">30G (30 Gauge):</strong> Slightly Thicker. Best For Viscous Diluents Or When Drawing Is Slow.</li>
                <li><strong style={{ color: '#E5E7EB' }} className="calc-no-capitalize">29G (29 Gauge):</strong> Thicker Shaft. Suitable For Large Draw Volumes Or Viscous Carriers.</li>
              </ul>

              <h4 style={{ margin: '0 0 8px', color: '#FFFFFF', fontSize: 14 }}>Subcutaneous Injection Guidelines</h4>
              <p style={{ margin: 0 }}>
                Subcutaneous Injections Are Placed Into The Fat Layer Directly Below The Skin. Typical Needle Lengths Range From <span className="calc-no-capitalize">4mm</span> To <span className="calc-no-capitalize">8mm</span> (5/16 Inch). Always Maintain Strict Aseptic Techniques, Disinfecting Vial Stopper Seals Prior To Extraction.
              </p>
            </div>
          )}
        </div>

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}
