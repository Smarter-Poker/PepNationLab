'use client';

/**
 * AddressAutocompleteInput
 *
 * Reusable street-address type-ahead used by every editable address form
 * (onboarding warehouse, dashboard storefront config, checkout, saved
 * addresses, manual orders, admin shipping origins). As the user types the
 * street, it shows a debounced dropdown of clickable suggestions; clicking one
 * fills street/city/state/zip via the onSelect callback. Backed by
 * GET /api/shipping/address-autocomplete?q=. Best-effort: any failure just
 * shows no suggestions and the user keeps typing by hand. Address accuracy is
 * still backstopped by EasyPost validation wherever the form validates on save.
 *
 * It is a thin wrapper around a normal <input>: pass the same value/onChange
 * you already use, plus onSelect to receive the parsed parts. className/style
 * pass through so it matches each form's existing input styling.
 */

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

export type AddressParts = { street1: string; city: string; state: string; zip: string };
type AcItem = AddressParts & { label: string };

export default function AddressAutocompleteInput({
  value,
  onChange,
  onSelect,
  placeholder = 'Start Typing Your Address...',
  className,
  style,
  id,
  name,
  required,
  disabled,
  inputType = 'text',
  maxLength,
  // Default stays "off": this component renders its own suggestion listbox,
  // and the browser's native address autofill dropdown would overlay it.
  // Callers without the custom dropdown concern can pass e.g. "address-line1".
  autoComplete = 'off',
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (a: AddressParts) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  inputType?: string;
  maxLength?: number;
  autoComplete?: string;
}) {
  const [items, setItems] = useState<AcItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Skip the next query after a programmatic value change (suggestion pick or
  // initial prefill) so selecting a suggestion does not immediately re-open.
  const suppressRef = useRef(true);

  useEffect(() => {
    const q = value.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (suppressRef.current) { suppressRef.current = false; return; }
    // Only start once "enough data" is typed.
    if (q.length < 4) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale suggestions for a too-short query
      setItems([]); setOpen(false); setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/shipping/address-autocomplete?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        const next: AcItem[] = Array.isArray(json?.suggestions) ? json.suggestions : [];
        setItems(next);
        setOpen(next.length > 0);
      } catch {
        setItems([]); setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  useEffect(() => () => { if (blurRef.current) clearTimeout(blurRef.current); }, []);

  const pick = (s: AcItem) => {
    suppressRef.current = true;
    onSelect({ street1: s.street1 || value, city: s.city, state: s.state, zip: s.zip });
    setOpen(false);
    setItems([]);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        name={name}
        type={inputType}
        className={className}
        style={style}
        value={value}
        required={required}
        disabled={disabled}
        maxLength={maxLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { if (items.length > 0) setOpen(true); }}
        onBlur={() => { blurRef.current = setTimeout(() => setOpen(false), 150); }}
      />
      {open && items.length > 0 && (
        <div
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
            background: 'var(--bg-metal-dark, #0d1722)', border: '1px solid rgba(0,196,188,0.4)',
            borderRadius: 8, overflow: 'hidden', overflowY: 'auto', maxHeight: 280,
            boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
          }}
        >
          {items.map((s, i) => (
            <button
              key={`${s.label}-${i}`}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                padding: '10px 12px', background: 'transparent', border: 'none',
                borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                color: 'var(--grey-200, #D0DAE4)', fontSize: '0.84rem', cursor: 'pointer',
              }}
            >
              <MapPin size={14} style={{ color: 'var(--teal)', flexShrink: 0 }} />
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      )}
      {loading && (
        <div style={{ fontSize: '0.74rem', color: 'var(--grey-400, #8a97a5)', marginTop: 4 }}>Searching Addresses...</div>
      )}
    </div>
  );
}
