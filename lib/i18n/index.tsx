'use client';

/**
 * Lightweight trilingual layer (EN / Simplified Chinese / Traditional
 * Chinese) for the surfaces a manufacturer account uses. No i18n framework:
 * a context provider, a t() hook, and a pill toggle.
 *
 * Persistence: localStorage ('pnl_locale') on every device, plus
 * profiles.locale through POST /api/manufacturer/locale when the signed-in
 * user is a manufacturer (fire-and-forget; harmless 403 for everyone else).
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SUPPORTED_LOCALES, LOCALE_LABELS, translate, type Locale } from '@/lib/i18n/manufacturer-dict';

const STORAGE_KEY = 'pnl_locale';

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => translate(key, 'en'),
});

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (SUPPORTED_LOCALES as string[]).includes(v);
}

export function LanguageProvider({
  children,
  initialLocale,
  syncToProfile = false,
}: {
  children: ReactNode;
  /** Server-known preference (profiles.locale) -- wins until the user toggles. */
  initialLocale?: string | null;
  /** When true, locale changes are also saved to the signed-in profile. */
  syncToProfile?: boolean;
}) {
  const [locale, setLocaleState] = useState<Locale>(isLocale(initialLocale) ? initialLocale : 'en');

  // The device-local choice wins over the server default once one exists.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLocale(stored)) setLocaleState(stored);
    } catch { /* storage unavailable -- keep the initial locale */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try { window.localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
    if (syncToProfile) {
      fetch('/api/manufacturer/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: l }),
      }).catch(() => { /* best-effort -- localStorage already holds it */ });
    }
  };

  const value = useMemo<I18nValue>(() => ({
    locale,
    setLocale,
    t: (key, vars) => translate(key, locale, vars),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/** Compact EN / 简体 / 繁體 pill toggle. */
export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  return (
    <div
      role="group"
      aria-label="Language"
      style={{
        display: 'inline-flex',
        gap: 2,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 999,
        padding: 2,
      }}
    >
      {SUPPORTED_LOCALES.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            aria-pressed={active}
            style={{
              border: 'none',
              cursor: 'pointer',
              borderRadius: 999,
              padding: compact ? '3px 9px' : '5px 12px',
              fontSize: compact ? '0.68rem' : '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
              background: active ? 'var(--teal, #00C4BC)' : 'transparent',
              color: active ? '#04221F' : 'var(--silver, #A8B4C0)',
              transition: 'background 0.15s ease, color 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {LOCALE_LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}
