'use client';
import { useState, useRef } from 'react';
import { toast } from 'sonner';

// ─── Design tokens ────────────────────────────────────────────────────────────
export const RESEARCH_NOTE =
  'Research Use Only. Not Intended As Medical Advice Or Human Dosing.';

export const chromeOuterStyle: React.CSSProperties = {
  scrollMarginTop: 100,
  marginBottom: 28,
  borderRadius: 24,
  padding: '2px',
  background:
    'linear-gradient(135deg, rgba(0,229,255,0.3) 0%, rgba(104,211,145,0.05) 50%, rgba(0,229,255,0.3) 100%)',
  boxShadow: '0 16px 40px rgba(0,0,0,0.7), 0 0 24px rgba(0,229,255,0.04)',
  transition: 'all 0.3s ease',
};

export const chromeInnerStyle: React.CSSProperties = {
  borderRadius: 22,
  padding: 32,
  background: 'radial-gradient(circle at 50% 0%, #111622 0%, #080a0f 100%)',
  boxShadow: 'inset 0 0 30px rgba(0,0,0,0.9)',
};

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: '#9CA3AF',
  marginBottom: 8,
  textTransform: 'capitalize',
  letterSpacing: '0.05em',
};

const inputStyleBase: React.CSSProperties = {
  width: '100%',
  height: '46px',
  boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#F3F4F6',
  padding: '0 16px',
  borderRadius: 8,
  fontSize: 15,
  fontFamily: 'monospace',
  outline: 'none',
  transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
};

export const selectStyleBase: React.CSSProperties = {
  ...inputStyleBase,
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23A8B2C1' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 16px center',
  backgroundSize: '16px',
  paddingRight: '42px',
  cursor: 'pointer',
};

export const explainerStyle: React.CSSProperties = {
  color: '#9CA3AF',
  fontSize: 14,
  lineHeight: 1.6,
  margin: '0 0 20px',
};

export const resultStyle: React.CSSProperties = {
  marginTop: 20,
  padding: 20,
  borderRadius: 14,
  background: '#07090e',
  border: '1px solid rgba(0,229,255,0.2)',
  boxShadow: '0 4px 20px rgba(0,229,255,0.05), inset 0 0 15px rgba(0,229,255,0.02)',
  color: '#E5E7EB',
  fontSize: 16,
  fontFamily: 'monospace',
  textAlign: 'center',
  textTransform: 'capitalize',
};

export const noteStyle: React.CSSProperties = {
  marginTop: 18,
  marginBottom: 0,
  color: '#6B7280',
  fontSize: 11,
  fontStyle: 'italic',
};

// ─── Shared data ──────────────────────────────────────────────────────────────
export const GRAVY_VALUES: Record<string, number> = {
  A: 1.80, R: -4.50, N: -3.50, D: -3.50, C: 2.50, E: -3.50, Q: -3.50,
  G: -0.40, H: -3.20, I: 4.50, L: 3.80, K: -3.90, M: 1.90, F: 2.80,
  P: -1.60, S: -0.80, T: -0.70, W: -0.90, Y: -1.30, V: 4.20,
};

export interface CompoundListItem {
  slug: string;
  display_name: string;
  molecular_weight_da: number | null;
  sequence: string | null;
}

// ─── Styled primitives ────────────────────────────────────────────────────────
export function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <input
      {...props}
      className={`calc-no-capitalize ${props.className || ''}`.trim()}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...inputStyleBase,
        borderColor: focused ? '#00E5FF' : hovered ? 'rgba(0,229,255,0.35)' : 'rgba(255,255,255,0.08)',
        boxShadow: focused
          ? '0 0 12px rgba(0,229,255,0.25), inset 0 2px 4px rgba(0,0,0,0.5)'
          : hovered
            ? '0 0 8px rgba(0,229,255,0.1), inset 0 2px 4px rgba(0,0,0,0.2)'
            : 'inset 0 2px 4px rgba(0,0,0,0.2)',
        ...props.style,
      }}
    />
  );
}

export function StyledSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <select
      {...props}
      className={`calc-no-capitalize ${props.className || ''}`.trim()}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...selectStyleBase,
        borderColor: focused ? '#00E5FF' : hovered ? 'rgba(0,229,255,0.35)' : 'rgba(255,255,255,0.08)',
        boxShadow: focused
          ? '0 0 12px rgba(0,229,255,0.25), inset 0 2px 4px rgba(0,0,0,0.5)'
          : hovered
            ? '0 0 8px rgba(0,229,255,0.1), inset 0 2px 4px rgba(0,0,0,0.2)'
            : 'inset 0 2px 4px rgba(0,0,0,0.2)',
        ...props.style,
      }}
    />
  );
}

// ─── CalculatorHeader ─────────────────────────────────────────────────────────
export function CalculatorHeader({ title, why }: { title: string; why: string }) {
  return (
    <>
      <h2 style={{ margin: 0, color: '#FFFFFF', fontSize: 20, fontWeight: 800 }}>{title}</h2>
      <h3 style={{ margin: '12px 0 4px', color: '#A8B2C1', fontSize: 13, textTransform: 'capitalize', letterSpacing: '0.06em' }}>
        Why This Matters
      </h3>
      <p style={explainerStyle}>{why}</p>
    </>
  );
}

// ─── SaveToJournalButton ──────────────────────────────────────────────────────
export function SaveToJournalButton({
  title,
  noteText,
  compoundSlug = null,
}: {
  title: string;
  noteText: string;
  compoundSlug?: string | null;
}) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/researcher/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, note_text: noteText, compound_slug: compoundSlug }),
      });
      if (res.status === 401) {
        toast.error('Please Sign In To Save To Lab Journal');
      } else if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed To Save Note');
      } else {
        toast.success('Calculated Recipe Saved Successfully To Lab Journal');
      }
    } catch (err) {
      console.error(err);
      toast.error('An Error Occurred While Saving');
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={saving}
      aria-label={saving ? 'Saving to lab journal…' : 'Save result to lab journal'}
      role="status"
      style={{
        background: '#00C4BC',
        border: 'none',
        color: '#000',
        padding: '8px 16px',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
        cursor: saving ? 'not-allowed' : 'pointer',
        opacity: saving ? 0.7 : 1,
        transition: 'all 0.2s',
        marginTop: 12,
        alignSelf: 'flex-start',
      }}
    >
      {saving ? 'Saving…' : 'Save To Journal'}
    </button>
  );
}

// ─── CopyButton ───────────────────────────────────────────────────────────────
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Clipboard unavailable');
    }
  };
  return (
    <button
      type="button"
      onClick={handle}
      aria-label={`Copy ${label ?? 'result'} to clipboard`}
      title={`Copy ${label ?? 'result'}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        background: copied ? 'rgba(104,211,145,0.15)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${copied ? '#68D391' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 6,
        color: copied ? '#68D391' : '#A8B4C0',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.18s',
        marginLeft: 8,
        verticalAlign: 'middle',
      }}
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
      )}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ─── ResultCard ────────────────────────────────────────────────────────────────
export function ResultCard({
  label,
  value,
  color = '#00E5FF',
  copyValue,
}: {
  label: string;
  value: string;
  color?: string;
  copyValue?: string;
}) {
  return (
    <div style={{ padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
      <div style={{ color: '#9CA3AF', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ color, fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }} className="calc-no-capitalize">
        {value}
        {copyValue !== undefined && <CopyButton value={copyValue} label={label} />}
      </div>
    </div>
  );
}

// ─── VisualSyringe (shared between Reconstitution) ────────────────────────────
export interface VisualSyringeProps {
  ml: number;
  size: 0.3 | 0.5 | 1.0;
  type?: 'u100' | 'u40' | 'u80';
  onDrawMlChange?: (newMl: number) => void;
}

export function VisualSyringe({ ml, size, type = 'u100', onDrawMlChange }: VisualSyringeProps) {
  const maxMl = size;
  const pct = Math.min(100, Math.max(0, (ml / maxMl) * 100));
  const multiplier = type === 'u40' ? 40 : type === 'u80' ? 80 : 100;
  const units = Math.round(ml * multiplier);
  const maxUnits = Math.round(size * multiplier);
  const tickCount = size === 1.0 ? 10 : size === 0.5 ? 5 : 3;
  const subdivisions = size === 1.0 ? 100 : size === 0.5 ? 50 : 30;
  const [isDragging, setIsDragging] = useState(false);
  const barrelRef = useRef<HTMLDivElement>(null);

  const updateVolumeFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!barrelRef.current || !onDrawMlChange) return;
    const rect = barrelRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const relativeX = Math.min(width, Math.max(0, width - clickX));
    const pct2 = relativeX / width;
    onDrawMlChange(pct2 * size);
  };

  return (
    <div style={{ background: '#121620', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12, color: '#A8B4C0', fontFamily: 'monospace' }}>
        <span>Syringe Capacity: <span className="calc-no-capitalize">{size} mL ({maxUnits} Units Max, {type.toUpperCase()})</span></span>
        <span style={{ color: '#00E5FF', fontWeight: 'bold' }} className="calc-no-capitalize">{units} Units ({ml.toFixed(3)} mL)</span>
      </div>
      {ml > size ? (
        <div style={{ color: '#FF6B6B', fontSize: 13, textAlign: 'center', padding: '8px 0', border: '1px dashed rgba(255,107,107,0.3)', borderRadius: 6, background: 'rgba(255,107,107,0.05)' }}>
          Warning: Dose Volume <span className="calc-no-capitalize">({ml.toFixed(3)} mL)</span> Exceeds Syringe Capacity <span className="calc-no-capitalize">({size} mL)</span>.
        </div>
      ) : (
        <>
          {onDrawMlChange && (
            <div style={{ fontSize: 11, color: '#A8B2C1', marginBottom: 8, fontStyle: 'italic', textTransform: 'capitalize' }}>
              Click Or Drag Plunger Inside Barrel To Adjust Target Dose Volume
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', height: 60, paddingLeft: 40, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, width: 40, height: 8, background: '#4A5568', borderRadius: '4px 0 0 4px' }} />
            <div style={{ position: 'absolute', left: 0, width: 4, height: 24, background: '#4A5568', borderRadius: 2 }} />
            <div
              ref={barrelRef}
              role="slider"
              aria-label="Draw volume"
              aria-valuemin={0}
              aria-valuemax={maxUnits}
              aria-valuenow={units}
              tabIndex={0}
              onPointerDown={(e) => { setIsDragging(true); e.currentTarget.setPointerCapture(e.pointerId); updateVolumeFromEvent(e); }}
              onPointerMove={(e) => { if (isDragging) updateVolumeFromEvent(e); }}
              onPointerUp={(e) => { setIsDragging(false); e.currentTarget.releasePointerCapture(e.pointerId); }}
              style={{ flex: 1, height: 32, background: 'rgba(255,255,255,0.03)', border: '2px solid #718096', borderRadius: '0 4px 4px 0', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden', cursor: onDrawMlChange ? 'ew-resize' : 'default', touchAction: 'none' }}
            >
              <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, rgba(0,229,255,0.15) 0%, rgba(0,229,255,0.3) 100%)', borderLeft: '4px solid #00E5FF', transition: isDragging ? 'none' : 'width 0.4s ease-out' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none', padding: '0 2px' }}>
                {Array.from({ length: tickCount + 1 }).map((_, i) => {
                  const val = Math.round((tickCount - i) * (maxUnits / tickCount));
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'space-between' }}>
                      <div style={{ width: 2, height: 8, background: 'rgba(255,255,255,0.4)' }} />
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', transform: 'translateY(-2px)' }}>{val}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none', padding: '0 2px' }}>
                {Array.from({ length: subdivisions + 1 }).map((_, i) => {
                  if (i % (subdivisions / tickCount) === 0) return <div key={i} />;
                  return <div key={i} style={{ width: 1, height: 4, background: 'rgba(255,255,255,0.15)' }} />;
                })}
              </div>
            </div>
            <div style={{ width: 12, height: 8, background: '#718096', borderRadius: '0 2px 2px 0' }} />
            <div style={{ width: 30, height: 1, background: '#E2E8F0' }} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── sessionStorage helpers ───────────────────────────────────────────────────
export function ssGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = sessionStorage.getItem(`calc_${key}`);
    return raw !== null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function ssSet(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`calc_${key}`, JSON.stringify(value));
  } catch { /* quota */ }
}
