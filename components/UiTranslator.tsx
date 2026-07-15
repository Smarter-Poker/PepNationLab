'use client';

/**
 * UiTranslator - runtime trilingual layer for the whole app.
 *
 * When the signed-in user has chosen Chinese (the manufacturer language
 * toggle in the drawer, or the manufacturer dashboard settings tab), this
 * component walks the rendered DOM and swaps every RECOGNIZED static English
 * string for its zh-CN / zh-TW translation from lib/i18n/ui-dict. It then
 * watches DOM mutations so client-side navigation, tab switches, modals, and
 * toasts are translated the moment they render.
 *
 * Guarantees, by construction:
 * - Dynamic data (names, emails, product titles, order ids, amounts) never
 *   matches a dictionary entry, so it passes through untouched.
 * - Images, icons, and image-based buttons are never modified.
 * - Text the dictionary does not know stays English instead of breaking.
 * - Only text nodes and placeholder/title/aria-label attributes are touched;
 *   DOM structure is never changed, so React reconciliation stays intact.
 * - Inputs, textareas, selects, scripts, styles, and anything inside a
 *   [data-no-translate] subtree are skipped.
 *
 * The active locale comes from localStorage ('pnl_locale', shared with the
 * manufacturer i18n layer) plus a same-tab 'pnl-locale-changed' CustomEvent
 * dispatched by the Navbar toggle, so switching language applies instantly.
 */

import { useEffect, useRef, useState } from 'react';
import { isLocale } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n/manufacturer-dict';
import { uiTranslate } from '@/lib/i18n/ui-dict';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE', 'IFRAME', 'CANVAS', 'SVG']);
const ATTRS = ['placeholder', 'title', 'aria-label'] as const;

type ZhLocale = 'zh-CN' | 'zh-TW';

function shouldSkip(el: Element | null): boolean {
  if (!el) return true;
  if (SKIP_TAGS.has(el.tagName)) return true;
  if ((el as HTMLElement).isContentEditable) return true;
  if (el.closest('[data-no-translate]')) return true;
  return false;
}

function translateTextNode(node: Text, locale: ZhLocale): void {
  const current = node.nodeValue ?? '';
  const trimmed = current.trim();
  if (!trimmed || trimmed.length < 2) return;
  const translated = uiTranslate(trimmed, locale);
  if (translated && translated !== trimmed) {
    const lead = current.slice(0, current.indexOf(trimmed.charAt(0)));
    const trailStart = current.lastIndexOf(trimmed.charAt(trimmed.length - 1)) + 1;
    const trail = current.slice(trailStart);
    node.nodeValue = `${lead}${translated}${trail}`;
  }
}

function walkAndTranslate(root: Node, locale: ZhLocale): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      return shouldSkip(n.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  let cur = walker.nextNode();
  while (cur) {
    nodes.push(cur as Text);
    cur = walker.nextNode();
  }
  for (const n of nodes) translateTextNode(n, locale);

  const scope: Element[] = [];
  if (root instanceof Element) {
    scope.push(root, ...Array.from(root.querySelectorAll('[placeholder], [title], [aria-label]')));
  } else {
    scope.push(...Array.from(document.querySelectorAll('[placeholder], [title], [aria-label]')));
  }
  for (const el of scope) {
    if (shouldSkip(el) && !(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) continue;
    for (const attr of ATTRS) {
      const v = el.getAttribute(attr);
      if (v && v.trim().length > 1) {
        const t = uiTranslate(v.trim(), locale);
        if (t && t !== v.trim()) el.setAttribute(attr, t);
      }
    }
  }
}

export default function UiTranslator() {
  const [locale, setLocale] = useState<Locale>('en');
  const hadTranslated = useRef(false);

  useEffect(() => {
    const read = () => {
      try {
        const stored = window.localStorage.getItem('pnl_locale');
        setLocale(isLocale(stored) ? stored : 'en');
      } catch {
        setLocale('en');
      }
    };
    read();
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (isLocale(detail)) setLocale(detail);
    };
    window.addEventListener('pnl-locale-changed', onCustom);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener('pnl-locale-changed', onCustom);
      window.removeEventListener('storage', read);
    };
  }, []);

  useEffect(() => {
    if (locale === 'en') {
      // Translated text cannot be reliably un-translated in place; a reload
      // re-renders everything in English. Only fires after a real switch.
      if (hadTranslated.current) window.location.reload();
      return undefined;
    }
    const zh = locale as ZhLocale;
    hadTranslated.current = true;

    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        observer.disconnect();
        walkAndTranslate(document.body, zh);
        observe();
      });
    });
    const observe = () =>
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    walkAndTranslate(document.body, zh);
    observe();
    return () => observer.disconnect();
  }, [locale]);

  return null;
}
