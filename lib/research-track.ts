'use client';

// Best-effort research engagement analytics (monograph tabs, calculators,
// external-doc opens, COA views). Mirrors lib/track.ts hardening: never
// throws, never blocks, sendBeacon-first transport, once-per-session dedupe
// for view-type events. Identity-free by design -- the sink table stores no
// user id and no IP.

import { getAnalyticsSessionId, getAnalyticsVisitorId } from '@/lib/track';

const DEDUPE_KEY_PREFIX = 'pnl_revt_';

type ResearchEventType =
  | 'page_view'
  | 'tab_view'
  | 'calculator_used'
  | 'external_doc_open'
  | 'coa_view'
  | 'match_result_click';

interface ResearchTrackExtra {
  path?: string;
  compound_slug?: string;
  tool?: string;
  url_host?: string;
  detail?: string;
}

const ONCE_PER_SESSION: ReadonlySet<string> = new Set(['page_view', 'coa_view']);

function alreadySentThisSession(event_type: string, path: string): boolean {
  if (!ONCE_PER_SESSION.has(event_type)) return false;
  try {
    const key = `${DEDUPE_KEY_PREFIX}${event_type}:${path}`;
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, '1');
    return false;
  } catch {
    return false;
  }
}

export function trackResearchEvent(
  event_type: ResearchEventType,
  extra?: ResearchTrackExtra,
): void {
  if (typeof window === 'undefined') return;
  try {
    const path = extra?.path ?? window.location.pathname;
    if (alreadySentThisSession(event_type, path)) return;

    const body: Record<string, unknown> = {
      event_type,
      session_id: getAnalyticsSessionId(),
      path: path.slice(0, 300),
    };
    const vid = getAnalyticsVisitorId();
    if (vid) body.visitor_id = vid;
    if (extra?.compound_slug) body.compound_slug = extra.compound_slug.slice(0, 120);
    if (extra?.tool) body.tool = extra.tool.slice(0, 60);
    if (extra?.url_host) body.url_host = extra.url_host.slice(0, 120);
    if (extra?.detail) body.detail = extra.detail.slice(0, 200);

    const url = '/api/research/events';
    const json = JSON.stringify(body);
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([json], { type: 'application/json' });
        if (navigator.sendBeacon(url, blob)) return;
      }
    } catch { /* fall through to fetch */ }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: json,
      keepalive: true,
    }).catch(() => { /* best-effort */ });
  } catch {
    /* never throw */
  }
}
