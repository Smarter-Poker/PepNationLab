'use client';

import { useState, useMemo } from 'react';
import {
  concentrationConvert,
  RESIDUE_MASS,
  type ConcentrationUnit,
} from '@/lib/research/calculators';
import { toast } from 'sonner';
import {
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

const UNITS: ConcentrationUnit[] = ['mg/mL', 'mcg/mL', 'ng/mL', 'mmol/L', 'umol/L', 'nmol/L'];
const MASS_UNITS = new Set(['mg/mL', 'mcg/mL', 'ng/mL']);
const MOLAR_UNITS = new Set(['mmol/L', 'umol/L', 'nmol/L']);

function needsMW(from: ConcentrationUnit, to: ConcentrationUnit): boolean {
  return (MASS_UNITS.has(from) && MOLAR_UNITS.has(to)) ||
         (MOLAR_UNITS.has(from) && MASS_UNITS.has(to));
}

export function ConcentrationSection({ compounds }: { compounds: CompoundListItem[] }) {
  const [value, setValue] = useState('');
  const [from, setFrom] = useState<ConcentrationUnit>('mg/mL');
  const [to, setTo] = useState<ConcentrationUnit>('mcg/mL');
  const [mw, setMw] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [fetchingMw, setFetchingMw] = useState(false);

  const mwRequired = needsMW(from, to);

  const filteredCompounds = useMemo(() => {
    if (!searchQuery) return compounds.slice(0, 10);
    return compounds.filter(c =>
      c.display_name.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);
  }, [compounds, searchQuery]);

  const isRawSequence = useMemo(() => {
    const clean = searchQuery.replace(/\s+/g, '').toUpperCase();
    if (clean.length < 2) return false;
    return Array.from(clean).every(char => char in RESIDUE_MASS);
  }, [searchQuery]);

  const handleSelectCompound = (c: CompoundListItem) => {
    if (c.molecular_weight_da) {
      setMw(c.molecular_weight_da.toString());
    }
    setSearchQuery(c.display_name);
    setShowDropdown(false);
  };

  const handleUniProtLookup = async () => {
    if (!searchQuery) return;
    setFetchingMw(true);
    try {
      const res = await fetch(`https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(searchQuery)}&size=1`);
      if (res.ok) {
        const data = await res.json();
        const entry = data.results?.[0];
        if (entry) {
          const sequence = entry.sequence?.value;
          const name = entry.proteinDescription?.recommendedName?.fullName?.value || entry.uniProtkbId;

          if (sequence) {
            let mass = 18.0106; // H2O
            for (const aa of sequence.toUpperCase()) {
              mass += RESIDUE_MASS[aa] || 110; // average residue mass fallback
            }
            setMw(Math.round(mass).toString());
            toast.success(`UniProt: ${name} (MW: ${Math.round(mass)} Da)`);
          } else {
            toast.error('No sequence data found in UniProt.');
          }
        } else {
          toast.error('No UniProt match found.');
        }
      } else {
        toast.error('Failed to contact UniProt API.');
      }
    } catch {
      toast.error('Error looking up UniProt database.');
    } finally {
      setFetchingMw(false);
    }
  };

  const handleCalculateSequenceMw = () => {
    const clean = searchQuery.replace(/\s+/g, '').toUpperCase();
    let mass = 18.0106;
    for (const aa of clean) {
      mass += RESIDUE_MASS[aa] || 0;
    }
    setMw(mass.toFixed(2));
    toast.success(`Calculated from sequence: ${mass.toFixed(2)} Da`);
  };

  const result = concentrationConvert({
    value: Number(value),
    fromUnit: from,
    toUnit: to,
    molecularWeightDa: mwRequired ? (Number(mw) || null) : null,
  });

  return (
    <section id="concentration" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="Concentration Converter"
          why="Convert mass concentrations (mg/mL, mcg/mL, ng/mL) to molar metrics (mmol/L, µmol/L, nmol/L). Automatic library integration retrieves exact molecular weights."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Value</div>
            <StyledInput type="number" step="any" value={value} placeholder="e.g. 1.5" onChange={(e) => setValue(e.target.value)} />
          </label>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>From Unit</div>
            <StyledSelect value={from} onChange={(e) => setFrom(e.target.value as ConcentrationUnit)}>
              {UNITS.map((u) => <option key={u} value={u} className="calc-no-capitalize">{u}</option>)}
            </StyledSelect>
          </label>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>To Unit</div>
            <StyledSelect value={to} onChange={(e) => setTo(e.target.value as ConcentrationUnit)}>
              {UNITS.map((u) => <option key={u} value={u} className="calc-no-capitalize">{u}</option>)}
            </StyledSelect>
          </label>
        </div>

        {mwRequired && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 12, position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <div style={labelStyle}>Search Database or Sequence</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <StyledInput
                  type="text"
                  value={searchQuery}
                  placeholder="Peptide name or sequence..."
                  onFocus={() => setShowDropdown(true)}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                  style={{ flex: 1 }}
                />
                {isRawSequence ? (
                  <button
                    type="button"
                    onClick={handleCalculateSequenceMw}
                    style={{ padding: '0 12px', background: '#00C4BC', color: '#000', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Calc MW
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleUniProtLookup}
                    disabled={fetchingMw || !searchQuery}
                    style={{ padding: '0 12px', background: 'transparent', border: '1px solid #00E5FF', color: '#00E5FF', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {fetchingMw ? '...' : 'UniProt'}
                  </button>
                )}
              </div>
              {showDropdown && filteredCompounds.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#121620', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, zIndex: 10, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                  {filteredCompounds.map((c) => (
                    <div
                      key={c.slug}
                      onClick={() => handleSelectCompound(c)}
                      className="calc-no-capitalize"
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: '#E2E8F0' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {c.display_name} {c.molecular_weight_da ? `(${c.molecular_weight_da} Da)` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <label style={{ display: 'block' }}>
              <div style={labelStyle}>Molecular Weight (Da)</div>
              <StyledInput type="number" step="any" value={mw} onChange={(e) => setMw(e.target.value)} placeholder="Enter Da Manually..." />
            </label>
          </div>
        )}

        <div aria-live="polite" style={resultStyle}>
          {result === null
            ? 'Enter A Molecular Weight (Da) To Convert Between Mass And Molar Units.'
            : from === to
            ? <><span>Same Unit Selected - No Conversion Needed: </span><strong className="calc-no-capitalize">{Number(value).toPrecision(6)}</strong> <span className="calc-no-capitalize">{to}</span></>
            : <><span>Converted: </span><strong className="calc-no-capitalize">{result.toPrecision(6)}</strong> <span className="calc-no-capitalize">{to}</span></>
          }
        </div>

        {result !== null && (
          <SaveToJournalButton
            title={`Concentration Conversion${searchQuery ? ` - ${searchQuery}` : ''}`}
            noteText={`Input Value: ${value} ${from}
Converted Value: ${result.toPrecision(6)} ${to}
Molecular Weight: ${mw} Da
Peptide: ${searchQuery || 'Custom'}`}
            compoundSlug={compounds.find(c => c.display_name === searchQuery)?.slug || null}
          />
        )}

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}
