'use client';

import React from 'react';
import { useAvailability, availabilityMessage, type AvailabilityField } from '@/lib/useAvailability';

interface Props {
  field: AvailabilityField;
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Called whenever the server issues / revokes a reservation token.
   *  The parent should POST this on submit so the slug is locked in. */
  onTokenChange?: (token: string | null) => void;
  /** Skip the live check entirely (e.g., form is submitting). */
  disabled?: boolean;
  /** UUID of the row owning the current value, so editing your own row
   *  doesn't flag a self-collision. */
  excludeId?: string | null;
  /** Min length before the live check kicks in. Default: slug/username 3,
   *  display_name 2. */
  minLength?: number;
  /** Default 400 ms. */
  debounceMs?: number;
  /** Renders a "pepnationlab.com/<slug>" pill under the input. Only
   *  applies when field === 'slug'. */
  urlPrefix?: string;
  /** Placeholder copy for the input. */
  placeholder?: string;
  /** Set required on the inner <input>. */
  required?: boolean;
  /** Pass through additional styling for the input. */
  inputStyle?: React.CSSProperties;
  /** When true, the input is wrapped in a brushed-pill (URL-style) frame
   *  matching the AgentStorefrontConfig slug field. */
  pillMode?: boolean;
  /** Color override for the label. */
  labelColor?: string;
  /** Optional id so labels in legacy forms can still associate. */
  inputId?: string;
  /** Optional autoCapitalize override (defaults to 'none' for slug/username). */
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters' | 'on' | 'off';
}

/**
 * Drop-in input + live availability surface. See lib/useAvailability.ts for
 * the hook contract.
 */
export function UniqueField(props: Props) {
  const {
    field,
    label,
    value,
    onChange,
    onTokenChange,
    disabled,
    excludeId,
    minLength,
    debounceMs,
    urlPrefix,
    placeholder,
    required,
    inputStyle,
    pillMode,
    labelColor,
    inputId,
    autoCapitalize,
  } = props;

  const defaultMin = field === 'display_name' ? 2 : 3;
  const check = useAvailability({
    field,
    value,
    excludeId,
    disabled,
    minLength: minLength ?? defaultMin,
    debounceMs,
  });
  const msg = availabilityMessage(check);

  React.useEffect(() => {
    if (onTokenChange) onTokenChange(check.reservationToken ?? null);
  }, [check.reservationToken, onTokenChange]);

  const id = inputId || `unique-field-${field}`;
  const statusId = `${id}-status`;
  const showInvalid = check.status === 'taken' || check.status === 'invalid' || check.status === 'reserved';

  // The slug field strips non-allowed characters as the user types so the
  // status row reflects the value that would actually be sent. Username
  // does NFKC + character filtering on the server, but we also filter
  // client-side so the visual matches what the server sees.
  function handleChange(raw: string) {
    if (field === 'slug') {
      onChange(raw.toLowerCase().replace(/[^a-z0-9-]/g, ''));
    } else if (field === 'username') {
      onChange(raw.replace(/[^a-zA-Z0-9_]/g, ''));
    } else {
      onChange(raw);
    }
  }

  const inputCore = (
    <input
      id={id}
      type="text"
      className="form-input"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      aria-invalid={showInvalid || undefined}
      aria-describedby={statusId}
      autoCapitalize={autoCapitalize ?? (field === 'display_name' ? 'words' : 'none')}
      autoCorrect="off"
      spellCheck={false}
      style={inputStyle}
    />
  );

  return (
    <div className="form-group" style={{ marginTop: 0 }}>
      <label
        className="form-label"
        htmlFor={id}
        style={labelColor ? { color: labelColor } : undefined}
      >
        {label}
      </label>

      {urlPrefix && field === 'slug' ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 46,
            background: 'var(--surface-3)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255,255,255,0.1)',
            paddingLeft: 'var(--space-3)',
            overflow: 'hidden',
          }}
        >
          <span style={{ fontSize: '0.85rem', color: 'var(--grey-400)', userSelect: 'none', flexShrink: 0 }}>
            {urlPrefix}
          </span>
          {React.cloneElement(inputCore, {
            style: {
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              height: '100%',
              paddingTop: 0,
              paddingBottom: 0,
              flex: 1,
              minWidth: 0,
              ...(inputStyle || {}),
            },
          })}
        </div>
      ) : pillMode ? (
        <div
          style={{
            height: 46,
            background: 'var(--surface-3)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255,255,255,0.1)',
            paddingLeft: 'var(--space-3)',
            paddingRight: 'var(--space-3)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {React.cloneElement(inputCore, {
            style: {
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              height: '100%',
              flex: 1,
              minWidth: 0,
              ...(inputStyle || {}),
            },
          })}
        </div>
      ) : (
        inputCore
      )}

      {/* Live status row */}
      {msg && (
        <div
          id={statusId}
          role="status"
          aria-live="polite"
          style={{
            marginTop: 6,
            fontSize: '0.78rem',
            color: msg.color,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            lineHeight: 1.3,
          }}
        >
          {/* Tone-specific icon - pure SVG, no emojis */}
          {msg.tone === 'success' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={msg.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {msg.tone === 'error' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={msg.color} strokeWidth="3" strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
          {msg.tone === 'warn' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={msg.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <circle cx="12" cy="17" r="0.5" />
            </svg>
          )}
          {msg.tone === 'info' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={msg.color} strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="7" x2="12" y2="13" />
              <circle cx="12" cy="17" r="0.5" />
            </svg>
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Suggestion chips (collision only) */}
      {check.suggestions.length > 0 && check.status === 'taken' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', marginBottom: 6 }}>
            Try One Of These:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {check.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleChange(s)}
                style={{
                  background: 'linear-gradient(180deg, rgba(192,184,168,0.18), rgba(192,184,168,0.08))',
                  border: '1px solid rgba(192,184,168,0.3)',
                  borderRadius: 999,
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  color: 'var(--silver)',
                  cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(180deg, rgba(192,184,168,0.3), rgba(192,184,168,0.15))';
                  e.currentTarget.style.borderColor = 'rgba(192,184,168,0.55)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(180deg, rgba(192,184,168,0.18), rgba(192,184,168,0.08))';
                  e.currentTarget.style.borderColor = 'rgba(192,184,168,0.3)';
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Live URL preview pill for slug fields when prefix is supplied */}
      {urlPrefix && field === 'slug' && value && (
        <div
          style={{
            marginTop: 6,
            fontSize: '0.72rem',
            color: 'var(--grey-400)',
            fontFamily: 'monospace',
          }}
        >
          Live URL: {urlPrefix}{value}
        </div>
      )}
    </div>
  );
}

export default UniqueField;
