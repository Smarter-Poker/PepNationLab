'use client';

import { useState } from 'react';
import { vialQuantityPower } from '@/lib/research/calculators';
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
} from './_shared';

export function VialQuantitySection() {
  const [groups, setGroups] = useState('2');
  const [subjectsPerGroup, setSubjectsPerGroup] = useState('8');
  const [dosesPerSubjectPerWeek, setDosesPerSubjectPerWeek] = useState('2');
  const [studyDurationWeeks, setStudyDurationWeeks] = useState('4');
  const [mgPerDose, setMgPerDose] = useState('');
  const [mgPerVial, setMgPerVial] = useState('');
  const [overage, setOverage] = useState('15');

  const parsedGroups = Math.max(1, Math.floor(Number(groups) || 1));
  const parsedSubjects = Math.max(1, Math.floor(Number(subjectsPerGroup) || 1));
  const totalN = parsedGroups * parsedSubjects;

  const out = vialQuantityPower({
    groups: parsedGroups,
    subjectsPerGroup: parsedSubjects,
    dosesPerSubjectPerWeek: Math.max(1, Number(dosesPerSubjectPerWeek) || 1),
    studyDurationWeeks: Math.max(1, Math.floor(Number(studyDurationWeeks) || 1)),
    mgPerDose: Number(mgPerDose),
    mgPerVial: Number(mgPerVial),
    overagePct: Number(overage) || 0,
  });

  return (
    <section id="vial-quantity" style={chromeOuterStyle}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="In Vivo Study Cohort Design &amp; Procurement Tool"
          why="Synthesize Sample Cohorts And Schedule Studies. Dynamically Outputs Total Animal Cohort Mass Requirements And Coordinates Vial Quantities Needed Including Overage Bounds."
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Treatment Groups</div>
            <StyledInput type="number" min={1} step={1} value={groups} onChange={(e) => setGroups(e.target.value)} placeholder="E.g. 2" />
          </label>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Subjects Per Group</div>
            <StyledInput type="number" min={1} step={1} value={subjectsPerGroup} onChange={(e) => setSubjectsPerGroup(e.target.value)} placeholder="E.g. 8" />
          </label>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Doses Per Subject (Weekly)</div>
            <StyledSelect value={dosesPerSubjectPerWeek} onChange={(e) => setDosesPerSubjectPerWeek(e.target.value)}>
              <option value="7">Daily (7x / Week)</option>
              <option value="3">Three Times Weekly (3x / Week)</option>
              <option value="2">Twice Weekly (2x / Week)</option>
              <option value="1">Weekly (1x / Week)</option>
            </StyledSelect>
          </label>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Study Duration (Weeks)</div>
            <StyledInput type="number" min={1} step={1} value={studyDurationWeeks} onChange={(e) => setStudyDurationWeeks(e.target.value)} placeholder="E.g. 4" />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Mg Per Dose</div>
            <StyledInput type="number" step="0.001" value={mgPerDose} onChange={(e) => setMgPerDose(e.target.value)} placeholder="E.g. 0.250" />
          </label>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Mg Per Vial</div>
            <StyledInput type="number" step="0.01" value={mgPerVial} onChange={(e) => setMgPerVial(e.target.value)} placeholder="E.g. 5" />
          </label>
          <label style={{ display: 'block' }}>
            <div style={labelStyle}>Overage Buffer (%)</div>
            <StyledInput type="number" step="any" min="0" max="100" value={overage} onChange={(e) => setOverage(e.target.value)} placeholder="E.g. 15" />
          </label>
        </div>

        {out && (
          <div style={{ margin: '16px 0', background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 11, color: '#A8B4C0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Cohort Summary Timeline</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center', fontSize: 13 }}>
              <div style={{ padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                <span style={{ display: 'block', color: '#A8B4C0', fontSize: 10 }}>TOTAL SUBJECTS (N)</span>
                <strong style={{ fontSize: 16, color: '#FFF' }} className="calc-no-capitalize">{totalN}</strong>
              </div>
              <div style={{ padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                <span style={{ display: 'block', color: '#A8B4C0', fontSize: 10 }}>DOSES PER SUBJECT</span>
                <strong style={{ fontSize: 16, color: '#FFF' }} className="calc-no-capitalize">{Math.round(Number(dosesPerSubjectPerWeek) * Number(studyDurationWeeks))}</strong>
              </div>
              <div style={{ padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                <span style={{ display: 'block', color: '#A8B4C0', fontSize: 10 }}>STUDY WEEKS</span>
                <strong style={{ fontSize: 16, color: '#FFF' }} className="calc-no-capitalize">{studyDurationWeeks}</strong>
              </div>
            </div>
          </div>
        )}

        <div style={resultStyle} aria-live="polite">
          {!out ? 'Enter Valid Inputs.' : (
            <>
              Vials Needed: <strong style={{ color: '#00E5FF', fontSize: 20 }} className="calc-no-capitalize">{out.vialsNeeded.toLocaleString()}</strong>{'  '}|{'  '}
              Per-Subject Mass: <strong className="calc-no-capitalize">{Number(out.perSubjectMg).toFixed(2)} mg</strong>{'  '}|{'  '}
              Total Mass: <strong className="calc-no-capitalize">{Number(out.totalMg).toFixed(2)} mg</strong>
            </>
          )}
        </div>

        {out && (
          <SaveToJournalButton
            title="Study Procurement Plan"
            noteText={`Treatment Groups: ${groups}
Subjects Per Group: ${subjectsPerGroup} (Total N: ${totalN})
Doses Per Subject (Weekly): ${dosesPerSubjectPerWeek}
Study Duration: ${studyDurationWeeks} Weeks
Mg Per Dose: ${mgPerDose}
Mg Per Vial: ${mgPerVial}
Overage Buffer: ${overage}%
Total Vials Needed: ${out.vialsNeeded}
Per-Subject Mass: ${Number(out.perSubjectMg).toFixed(2)} mg
Total Mass Needed: ${Number(out.totalMg).toFixed(2)} mg`}
          />
        )}

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}
