'use client';

import dynamic from 'next/dynamic';

/**
 * DeferredGlobals - a single client boundary that lazy-loads all NON-CRITICAL
 * app-wide widgets after hydration, in their own async chunks, so they never
 * inflate the initial per-page JavaScript bundle or the server-rendered HTML.
 *
 * Why this is safe (no layout shift, no behavior change):
 *  - Every component below renders `null` until an effect runs or a condition
 *    is met (a stale browser, an OAuth error param, an active impersonation
 *    session, a PWA install opportunity, an incoming call, etc.). Deferring
 *    their load by a tick therefore changes nothing users can perceive.
 *  - The messenger realtime listeners (GlobalCallListener, SessionKeepalive)
 *    are only meaningful for authenticated users, yet previously shipped their
 *    JS - and opened realtime work - on EVERY page, including the homepage,
 *    city pages, and research library that logged-out visitors and AI crawlers
 *    hit. Moving them behind `ssr: false` keeps them fully functional for signed
 *    in users while removing that cost from the public critical path.
 *
 * `ssr: false` dynamic imports are only permitted inside a Client Component,
 * which is why this wrapper exists (the root layout is a Server Component).
 */

const StaleBrowserBanner = dynamic(() => import('@/components/StaleBrowserBanner'), { ssr: false });
const OAuthErrorRedirect = dynamic(() => import('@/components/OAuthErrorRedirect'), { ssr: false });
const ImpersonationBanner = dynamic(() => import('@/components/ImpersonationBanner'), { ssr: false });
const PwaInstallPrompt = dynamic(() => import('@/components/PwaInstallPrompt'), { ssr: false });
const GlobalCallListener = dynamic(() => import('@/components/messenger/GlobalCallListener'), { ssr: false });
const FirstRunNotificationPrompt = dynamic(() => import('@/components/FirstRunNotificationPrompt'), { ssr: false });
const SessionKeepalive = dynamic(() => import('@/components/messenger/SessionKeepalive'), { ssr: false });
const WebVitalsReporter = dynamic(() => import('@/components/WebVitalsReporter'), { ssr: false });
const ScrollLockWatchdog = dynamic(() => import('@/components/ScrollLockWatchdog'), { ssr: false });

export default function DeferredGlobals() {
  return (
    <>
      <StaleBrowserBanner />
      <OAuthErrorRedirect />
      <ImpersonationBanner />
      <PwaInstallPrompt />
      <GlobalCallListener />
      <FirstRunNotificationPrompt />
      <SessionKeepalive />
      <WebVitalsReporter />
      <ScrollLockWatchdog />
    </>
  );
}
