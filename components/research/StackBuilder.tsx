'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Layers, AlertTriangle, Info, ShieldAlert, CheckCircle2, 
  Download, Calendar, Plus, Trash2, Edit, Save, RefreshCw 
} from 'lucide-react';
import { 
  analyzeCartWarnings, 
  calculateStackSynergy, 
  type Compound, 
  type CartWarning 
} from '@/lib/compounds';
import { toast } from 'sonner';

interface StackBuilderProps {
  compounds: Compound[];
}

const LEVEL_STYLE: Record<CartWarning['level'], { color: string; bg: string; border: string }> = {
  danger: { color: '#FF6B6B', bg: 'rgba(229,62,62,0.12)', border: 'rgba(229,62,62,0.4)' },
  warning: { color: '#F6AD55', bg: 'rgba(246,173,85,0.12)', border: 'rgba(246,173,85,0.4)' },
  info: { color: '#00C4BC', bg: 'rgba(0,196,188,0.10)', border: 'rgba(0,196,188,0.4)' },
};

function LevelIcon({ level }: { level: CartWarning['level'] }) {
  if (level === 'danger') return <ShieldAlert size={18} aria-hidden="true" />;
  if (level === 'warning') return <AlertTriangle size={18} aria-hidden="true" />;
  return <Info size={18} aria-hidden="true" />;
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((x) => setB.has(x));
}

function parseHalfLife(c: Compound): number {
  if (c.measured_half_life_hours) return c.measured_half_life_hours;
  if (c.predicted_half_life_hours) return c.predicted_half_life_hours;
  if (c.half_life) {
    const match = c.half_life.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      return parseFloat(match[1]);
    }
  }
  return 24; // Default to 24 hours
}

interface DoseItem {
  slug: string;
  dose: number;
  unit: 'mcg' | 'mg';
}

interface ProtocolDay {
  day: string;
  compounds: DoseItem[];
}

interface ProtocolWeek {
  weekNumber: number;
  schedule: ProtocolDay[];
  notes: string;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function StackBuilder({ compounds }: StackBuilderProps) {
  const selectable = useMemo(
    () => compounds.filter((c) => !c.is_stack).sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [compounds]
  );
  const stacks = useMemo(() => compounds.filter((c) => c.is_stack), [compounds]);
  const bySlug = useMemo(() => new Map(compounds.map((c) => [c.slug, c])), [compounds]);

  const [selected, setSelected] = useState<string[]>([]);
  const [protocol, setProtocol] = useState<ProtocolWeek[]>([]);
  const [activeWeek, setActiveWeek] = useState<number>(1);
  const [generatingProtocol, setGeneratingProtocol] = useState(false);
  const [aiProtocolText, setAiProtocolText] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState('');

  const selectedCompounds = useMemo(
    () => selected.map((s) => bySlug.get(s)).filter((c): c is Compound => Boolean(c)),
    [selected, bySlug]
  );

  const warnings = useMemo(
    () => (selectedCompounds.length > 0 ? analyzeCartWarnings(selectedCompounds) : []),
    [selectedCompounds]
  );

  const synergyAnalysis = useMemo(
    () => calculateStackSynergy(selectedCompounds),
    [selectedCompounds]
  );

  const documentedMatch = useMemo(() => {
    if (selected.length < 2) return null;
    return stacks.find((st) => sameSet(st.stack_components, selected)) ?? null;
  }, [selected, stacks]);

  // SVG half-life curves data
  const timelinePoints = useMemo(() => {
    if (selectedCompounds.length === 0) return [];
    const points: Array<{ slug: string; color: string; coords: Array<{ x: number; y: number }> }> = [];
    const colors = ['#00E5FF', '#68D391', '#F6AD55', '#D6BCFA', '#ECFDF5'];
    
    selectedCompounds.forEach((c, idx) => {
      const hl = parseHalfLife(c);
      const coords = [];
      const color = colors[idx % colors.length];
      
      // Plot decay over 72 hours
      for (let t = 0; t <= 72; t += 2) {
        // C(t) = 100 * (0.5)^(t / hl)
        const conc = 100 * Math.pow(0.5, t / hl);
        coords.push({ x: t, y: conc });
      }
      points.push({ slug: c.slug, color, coords });
    });
    
    return points;
  }, [selectedCompounds]);

  function toggle(slug: string) {
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
    setProtocol([]); // Clear stale protocol when stack contents change
    setAiProtocolText('');
  }

  // Generate Default Schedule locally
  const handleGenerateDefaultProtocol = () => {
    if (selectedCompounds.length === 0) return;
    const defaultProtocol: ProtocolWeek[] = [];
    
    for (let w = 1; w <= 12; w++) {
      const schedule: ProtocolDay[] = DAYS_OF_WEEK.map(day => {
        const dayCompounds: DoseItem[] = [];
        
        selectedCompounds.forEach(c => {
          const freq = (c.typical_frequency || '').toLowerCase();
          let shouldAdd = false;
          
          if (freq.includes('daily')) {
            shouldAdd = true;
          } else if (freq.includes('3x') || freq.includes('three')) {
            shouldAdd = ['Monday', 'Wednesday', 'Friday'].includes(day);
          } else if (freq.includes('2x') || freq.includes('twice') || freq.includes('every other')) {
            shouldAdd = ['Tuesday', 'Thursday', 'Saturday'].includes(day);
          } else if (freq.includes('weekly') || freq.includes('1x')) {
            shouldAdd = day === 'Monday';
          } else {
            shouldAdd = ['Monday', 'Wednesday', 'Friday'].includes(day); // default fallback
          }

          if (shouldAdd) {
            dayCompounds.push({
              slug: c.slug,
              dose: c.slug.toLowerCase().includes('bpc') ? 250 : c.slug.toLowerCase().includes('tb') ? 2 : 1,
              unit: c.slug.toLowerCase().includes('tb') ? 'mg' : 'mcg',
            });
          }
        });

        return { day, compounds: dayCompounds };
      });

      defaultProtocol.push({
        weekNumber: w,
        schedule,
        notes: `Week ${w} research metrics evaluation checklist. Check reconstitution status and monitor test subjects daily.`,
      });
    }

    setProtocol(defaultProtocol);
    setActiveWeek(1);
    toast.success('Generated 12-Week Interactive Protocol Grid');
  };

  // Refine protocol via Gemini AI API
  const handleRefineWithGemini = async () => {
    if (selectedCompounds.length === 0) return;
    setGeneratingProtocol(true);
    
    try {
      const res = await fetch('/api/researcher/ai-protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compounds: selectedCompounds.map(c => c.display_name),
          goal: documentedMatch?.display_name || `Optimization stack of ${selectedCompounds.map(c => c.display_name).join(' and ')}`
        })
      });

      if (!res.ok) {
        toast.error('AI refinement failed. Using local protocol.');
        if (protocol.length === 0) handleGenerateDefaultProtocol();
        return;
      }

      const data = await res.json();
      setAiProtocolText(data.protocol);
      if (protocol.length === 0) {
        handleGenerateDefaultProtocol();
      }
      toast.success('Gemini AI Protocol Schedule Appended Below');
    } catch {
      toast.error('Connection issue with AI endpoint.');
      if (protocol.length === 0) handleGenerateDefaultProtocol();
    } finally {
      setGeneratingProtocol(false);
    }
  };

  // Edit dose values in grid
  const handleUpdateDose = (weekNum: number, dayName: string, slug: string, newDose: number) => {
    setProtocol(prev => prev.map(w => {
      if (w.weekNumber !== weekNum) return w;
      return {
        ...w,
        schedule: w.schedule.map(d => {
          if (d.day !== dayName) return d;
          return {
            ...d,
            compounds: d.compounds.map(c => c.slug === slug ? { ...c, dose: newDose } : c)
          };
        })
      };
    }));
  };

  // Remove dose item from a day
  const handleRemoveDose = (weekNum: number, dayName: string, slug: string) => {
    setProtocol(prev => prev.map(w => {
      if (w.weekNumber !== weekNum) return w;
      return {
        ...w,
        schedule: w.schedule.map(d => {
          if (d.day !== dayName) return d;
          return {
            ...d,
            compounds: d.compounds.filter(c => c.slug !== slug)
          };
        })
      };
    }));
  };

  // Add dose item to a day
  const handleAddDose = (weekNum: number, dayName: string, slug: string) => {
    const defaultDose = slug.toLowerCase().includes('tb') ? 2 : 250;
    const defaultUnit = slug.toLowerCase().includes('tb') ? 'mg' : 'mcg';

    setProtocol(prev => prev.map(w => {
      if (w.weekNumber !== weekNum) return w;
      return {
        ...w,
        schedule: w.schedule.map(d => {
          if (d.day !== dayName) return d;
          if (d.compounds.some(c => c.slug === slug)) return d; // already exists
          return {
            ...d,
            compounds: [...d.compounds, { slug, dose: defaultDose, unit: defaultUnit as any }]
          };
        })
      };
    }));
  };

  // Save Notes editing
  const handleStartEditingNotes = (notes: string) => {
    setTempNotes(notes);
    setEditingNotes(true);
  };

  const handleSaveNotes = (weekNum: number) => {
    setProtocol(prev => prev.map(w => {
      if (w.weekNumber !== weekNum) return w;
      return { ...w, notes: tempNotes };
    }));
    setEditingNotes(false);
    toast.success('Week Notes Saved');
  };

  // CSV Export
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,Week,Day,Compound,Dose,Unit\r\n';
    protocol.forEach(w => {
      w.schedule.forEach(s => {
        s.compounds.forEach(c => {
          csvContent += `${w.weekNumber},${s.day},${c.slug},${c.dose},${c.unit}\r\n`;
        });
      });
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pepnation_protocol_stack_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded Protocol CSV');
  };

  // iCal (.ics) Export
  const handleExportICal = () => {
    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PepNationLab//Protocol Planner//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];
    
    const baseDate = new Date();
    // Round to next Monday
    const day = baseDate.getDay();
    const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
    const startMonday = new Date(baseDate.setDate(diff));

    protocol.forEach(w => {
      w.schedule.forEach(s => {
        const dayOffsets: Record<string, number> = {
          'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3,
          'Friday': 4, 'Saturday': 5, 'Sunday': 6
        };
        const offset = dayOffsets[s.day] || 0;
        const eventDate = new Date(startMonday.getTime() + (w.weekNumber - 1) * 7 * 24 * 3600 * 1000 + offset * 24 * 3600 * 1000);
        const dateStr = eventDate.toISOString().slice(0, 10).replace(/-/g, '');
        
        s.compounds.forEach(c => {
          icsLines.push('BEGIN:VEVENT');
          icsLines.push(`UID:uid_week${w.weekNumber}_${s.day}_${c.slug}_${Date.now()}@pepnationlab.com`);
          icsLines.push(`DTSTAMP:${dateStr}T090000Z`);
          icsLines.push(`DTSTART;VALUE=DATE:${dateStr}`);
          icsLines.push(`SUMMARY:Peptide Research Dose: ${c.slug.toUpperCase()} (${c.dose} ${c.unit})`);
          icsLines.push(`DESCRIPTION:Scheduled dose for Week ${w.weekNumber} day ${s.day} of peptide stack evaluation. Study-use only.`);
          icsLines.push('END:VEVENT');
        });
      });
    });
    icsLines.push('END:VCALENDAR');
    
    const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `pepnation_protocol_stack_${Date.now()}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded Protocol iCal Calendar File');
  };

  return (
    <div className="glass-panel" style={{ padding: 0 }}>
      <div className="glass-panel">
        <div className="" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <Layers size={22} color="#00C4BC" aria-hidden="true" />
            <h2 style={{ margin: 0, color: '#FFFFFF', fontSize: '1.35rem', fontWeight: 700 }}>Guided Stack Builder & Planner</h2>
          </div>
          <p style={{ margin: '0 0 var(--space-4)', color: '#A8B4C0', fontSize: '0.95rem', lineHeight: 1.55 }}>
            Select Two Or More Compounds To See Synergy Index Gauges, Active Half-Life Concentration Decays, And Create Fully Customizable 12-Week Dosing Protocol Sheets.
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginBottom: 'var(--space-5)',
            }}
          >
            {selectable.map((c) => {
              const isOn = selected.includes(c.slug);
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => toggle(c.slug)}
                  aria-pressed={isOn}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '999px',
                    border: `1px solid ${isOn ? '#00C4BC' : '#1D2D3E'}`,
                    background: isOn ? 'rgba(0,196,188,0.14)' : '#0F1923',
                    color: isOn ? '#00C4BC' : '#D0DAE4',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    fontWeight: isOn ? 700 : 400,
                    transition: 'all 0.2s',
                  }}
                >
                  {c.display_name}
                </button>
              );
            })}
          </div>

          {selected.length < 2 ? (
            <p style={{ color: '#A8B4C0', margin: 0 }}>Select At Least Two Compounds To Evaluate A Combination.</p>
          ) : (
            <>
              {/* Synergy Index & Risk Gauge Section */}
              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
                  gap: 16, 
                  background: 'rgba(0,0,0,0.2)', 
                  border: '1px solid rgba(255,255,255,0.06)', 
                  borderRadius: 12, 
                  padding: 16, 
                  marginBottom: 16 
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#A8B4C0', marginBottom: 8, letterSpacing: '0.05em' }}>
                    Stack Synergy Index
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 60, height: 60, borderRadius: '50%', border: '4px solid #162230', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <svg width="60" height="60" style={{ transform: 'rotate(-90deg)', position: 'absolute', top: -4, left: -4 }}>
                        <circle 
                          cx="30" 
                          cy="30" 
                          r="26" 
                          fill="transparent" 
                          stroke="#00E5FF" 
                          strokeWidth="4" 
                          strokeDasharray={2 * Math.PI * 26} 
                          strokeDashoffset={2 * Math.PI * 26 * (1 - synergyAnalysis.synergyIndex / 100)} 
                        />
                      </svg>
                      <strong style={{ fontSize: 16, color: '#FFFFFF' }}>{synergyAnalysis.synergyIndex}</strong>
                    </div>
                    <div>
                      <strong style={{ color: '#00E5FF', fontSize: 14 }}>{synergyAnalysis.synergyIndex >= 75 ? 'Optimal Match' : synergyAnalysis.synergyIndex >= 50 ? 'Viable Stack' : 'Poor Match'}</strong>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#A8B4C0', lineHeight: 1.3 }}>{synergyAnalysis.synergyExplanation}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#A8B4C0', marginBottom: 8, letterSpacing: '0.05em' }}>
                    Cumulative Stack Risk
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span 
                      style={{ 
                        padding: '6px 12px', 
                        borderRadius: 6, 
                        fontWeight: 800, 
                        fontSize: 13, 
                        textTransform: 'uppercase',
                        background: synergyAnalysis.riskLevel === 'critical' ? 'rgba(239,68,68,0.16)' : synergyAnalysis.riskLevel === 'high' ? 'rgba(245,158,11,0.16)' : 'rgba(16,185,129,0.16)', 
                        color: synergyAnalysis.riskLevel === 'critical' ? '#FF6B6B' : synergyAnalysis.riskLevel === 'high' ? '#F6AD55' : '#68D391',
                        border: `1px solid ${synergyAnalysis.riskLevel === 'critical' ? '#FF6B6B' : synergyAnalysis.riskLevel === 'high' ? '#F6AD55' : '#68D391'}4D`
                      }}
                    >
                      {synergyAnalysis.riskLevel}
                    </span>
                    <p style={{ margin: 0, fontSize: 11, color: '#A8B4C0', lineHeight: 1.3 }}>
                      {synergyAnalysis.riskLevel === 'critical' ? 'High alert. Incompatible mechanisms detected. Do not study together.' : synergyAnalysis.riskLevel === 'high' ? 'High risk. Overlapping secondary parameters. Monitor subjects closely.' : 'Standard laboratory handling profile.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Half-Life Decay Curves Overlay Graph */}
              <div 
                style={{ 
                  background: 'rgba(0,0,0,0.3)', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  borderRadius: 12, 
                  padding: 16, 
                  marginBottom: 16 
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#A8B4C0', marginBottom: 10, letterSpacing: '0.05em' }}>
                  Concentration Decay Curves Overlay (72 Hours)
                </div>
                <div style={{ height: 100, position: 'relative' }}>
                  <svg width="100%" height="100%" viewBox="0 0 400 100" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                    {/* grid lines */}
                    <line x1="0" y1="50" x2="400" y2="50" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3,3" />
                    <line x1="0" y1="95" x2="400" y2="95" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                    
                    {timelinePoints.map((tp, idx) => (
                      <path
                        key={tp.slug}
                        d={tp.coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${(c.x / 72) * 400} ${95 - (c.y / 100) * 85}`).join(' ')}
                        fill="none"
                        stroke={tp.color}
                        strokeWidth="2"
                        style={{ opacity: 0.85 }}
                      />
                    ))}
                  </svg>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#A8B4C0', marginTop: 6, fontFamily: 'monospace' }}>
                  <span>0 hrs (Injection)</span>
                  <span>24 hrs</span>
                  <span>48 hrs</span>
                  <span>72 hrs</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                  {selectedCompounds.map((c, idx) => {
                    const colors = ['#00E5FF', '#68D391', '#F6AD55', '#D6BCFA', '#ECFDF5'];
                    return (
                      <span key={c.slug} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#FFFFFF' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[idx % colors.length] }} />
                        <span className="calc-no-capitalize">{c.display_name} (T<sub>1/2</sub>: {parseHalfLife(c)}h)</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {documentedMatch ? (
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(104,211,145,0.12)',
                    border: '1px solid rgba(104,211,145,0.4)',
                    marginBottom: 'var(--space-4)',
                  }}
                >
                  <div style={{ color: '#68D391', flexShrink: 0, marginTop: '0.1rem' }}>
                    <CheckCircle2 size={18} aria-hidden="true" />
                  </div>
                  <div>
                    <p style={{ margin: 0, color: '#68D391', fontWeight: 700 }}>
                      Documented Combination:{' '}
                      <Link href={`/research/${documentedMatch.slug}`} style={{ color: '#68D391' }}>
                        {documentedMatch.display_name}
                      </Link>
                    </p>
                    {documentedMatch.stack_rationale && (
                      <p style={{ margin: '0.35rem 0 0', color: '#D0DAE4', fontSize: '0.9rem', lineHeight: 1.5 }}>
                        {documentedMatch.stack_rationale}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(0,196,188,0.10)',
                    border: '1px solid rgba(0,196,188,0.4)',
                    marginBottom: 'var(--space-4)',
                    color: '#D0DAE4',
                    fontSize: '0.9rem',
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: '#00C4BC' }}>Not A Studied Combination.</strong> This Exact
                  Set Does Not Match A Documented Stack In The Library. Review Each Compound
                  Individually Before Considering Any Combination.
                </div>
              )}

              {warnings.length > 0 && (
                <div style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 16 }}>
                  {warnings.map((w, i) => {
                    const s = LEVEL_STYLE[w.level];
                    return (
                      <div
                        key={`${w.title}-${i}`}
                        role="note"
                        style={{
                          display: 'flex',
                          gap: 'var(--space-3)',
                          padding: 'var(--space-4)',
                          borderRadius: 'var(--radius-md)',
                          background: s.bg,
                          border: `1px solid ${s.border}`,
                        }}
                      >
                        <div style={{ color: s.color, flexShrink: 0, marginTop: '0.1rem' }}>
                          <LevelIcon level={w.level} />
                        </div>
                        <div>
                          <p style={{ margin: 0, color: s.color, fontWeight: 700 }}>{w.title}</p>
                          <p style={{ margin: '0.35rem 0 0', color: '#D0DAE4', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            {w.detail}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Protocol Creation CTA */}
              {protocol.length === 0 ? (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button 
                    type="button" 
                    onClick={handleGenerateDefaultProtocol}
                    style={{ background: '#00C4BC', color: '#000', border: 'none', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Calendar size={16} />
                    Generate 12-Week Interactive Protocol Grid
                  </button>
                  <button 
                    type="button" 
                    onClick={handleRefineWithGemini}
                    disabled={generatingProtocol}
                    style={{ background: 'transparent', color: '#00E5FF', border: '1px solid #00E5FF', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <RefreshCw size={16} className={generatingProtocol ? 'animate-spin' : ''} />
                    {generatingProtocol ? 'Refining...' : 'Refine with Gemini AI'}
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                    <h3 style={{ margin: 0, color: '#FFFFFF', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Calendar size={18} color="#00C4BC" />
                      12-Week Interactive Protocol Planner
                    </h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        type="button" 
                        onClick={handleExportCSV}
                        style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#FFFFFF', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Download size={14} /> CSV
                      </button>
                      <button 
                        type="button" 
                        onClick={handleExportICal}
                        style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#FFFFFF', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Download size={14} /> iCal Calendar
                      </button>
                    </div>
                  </div>

                  {/* Week Tabs */}
                  <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <button
                        key={i + 1}
                        type="button"
                        onClick={() => setActiveWeek(i + 1)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: activeWeek === i + 1 ? '#00C4BC' : 'rgba(255,255,255,0.04)',
                          color: activeWeek === i + 1 ? '#000000' : '#A8B4C0',
                          border: activeWeek === i + 1 ? 'none' : '1px solid rgba(255,255,255,0.06)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Week {i + 1}
                      </button>
                    ))}
                  </div>

                  {/* Active Week Dosing Grid */}
                  <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                    {protocol.find(w => w.weekNumber === activeWeek)?.schedule.map((s) => (
                      <div 
                        key={s.day} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          background: 'rgba(255,255,255,0.02)', 
                          border: '1px solid rgba(255,255,255,0.05)', 
                          borderRadius: 8, 
                          padding: '10px 14px',
                          flexWrap: 'wrap',
                          gap: 12
                        }}
                      >
                        <strong style={{ width: 90, color: '#FFFFFF', fontSize: 13 }}>{s.day}</strong>
                        <div style={{ display: 'flex', flex: 1, gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          {s.compounds.map((c) => (
                            <div 
                              key={c.slug} 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 6, 
                                background: 'rgba(0,196,188,0.06)', 
                                border: '1px solid rgba(0,196,188,0.2)', 
                                borderRadius: 6, 
                                padding: '4px 8px',
                                fontSize: 12
                              }}
                            >
                              <span style={{ color: '#00C4BC', fontWeight: 700 }}>{c.slug.toUpperCase()}</span>
                              <input 
                                type="number" 
                                value={c.dose} 
                                onChange={(e) => handleUpdateDose(activeWeek, s.day, c.slug, Number(e.target.value) || 0)}
                                style={{ width: 45, background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.3)', color: '#FFFFFF', textAlign: 'center', padding: 0, outline: 'none', fontFamily: 'monospace' }}
                              />
                              <span style={{ color: '#A8B4C0' }}>{c.unit}</span>
                              <button 
                                type="button" 
                                onClick={() => handleRemoveDose(activeWeek, s.day, c.slug)}
                                style={{ background: 'transparent', border: 'none', color: '#FF6B6B', cursor: 'pointer', display: 'flex', padding: 2 }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                          
                          {/* Dropdown to add missing compounds to this day */}
                          {selectedCompounds.filter(sc => !s.compounds.some(c => c.slug === sc.slug)).length > 0 && (
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAddDose(activeWeek, s.day, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              style={{ background: 'transparent', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 6, color: '#A8B4C0', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}
                            >
                              <option value="">+ Add Peptide</option>
                              {selectedCompounds
                                .filter(sc => !s.compounds.some(c => c.slug === sc.slug))
                                .map(sc => <option key={sc.slug} value={sc.slug}>{sc.display_name}</option>)
                              }
                            </select>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Week Notes */}
                  <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <strong style={{ fontSize: 12, textTransform: 'uppercase', color: '#00C4BC', letterSpacing: '0.05em' }}>Week {activeWeek} Notes & Milestones</strong>
                      {!editingNotes ? (
                        <button 
                          type="button" 
                          onClick={() => handleStartEditingNotes(protocol.find(w => w.weekNumber === activeWeek)?.notes || '')}
                          style={{ background: 'transparent', border: 'none', color: '#00E5FF', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Edit size={12} /> Edit Notes
                        </button>
                      ) : (
                        <button 
                          type="button" 
                          onClick={() => handleSaveNotes(activeWeek)}
                          style={{ background: 'transparent', border: 'none', color: '#68D391', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Save size={12} /> Save
                        </button>
                      )}
                    </div>
                    {!editingNotes ? (
                      <p style={{ margin: 0, fontSize: 13, color: '#D0DAE4', lineHeight: 1.5 }}>
                        {protocol.find(w => w.weekNumber === activeWeek)?.notes || 'No notes written for this week.'}
                      </p>
                    ) : (
                      <textarea
                        value={tempNotes}
                        onChange={(e) => setTempNotes(e.target.value)}
                        style={{ width: '100%', height: 60, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#FFFFFF', padding: 8, fontSize: 13, resize: 'none', outline: 'none' }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Gemini AI raw schedule text box */}
              {aiProtocolText && (
                <div style={{ marginTop: 20, padding: 16, background: 'rgba(0,229,255,0.02)', border: '1px solid rgba(0,229,255,0.12)', borderRadius: 12 }}>
                  <h4 style={{ margin: '0 0 10px', color: '#00E5FF', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Info size={14} />
                    Gemini AI Clinical Evaluation Synergy Review
                  </h4>
                  <div style={{ fontSize: 13, color: '#C8D2DC', lineHeight: 1.6, whiteSpace: 'pre-line', fontFamily: 'monospace' }}>
                    {aiProtocolText}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
