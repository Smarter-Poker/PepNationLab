import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
// Must load after globals.css: narrow mobile corrections maintained by the
// automated mobile guard. See app/mobile-guard.css.
import "./mobile-guard.css";
import { CartProvider } from "@/components/CartContext";
import { InAppBrowserProvider } from "@/components/InAppBrowser";
import SiteDisclaimerGate from "@/components/SiteDisclaimerGate";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "sonner";
import FlashSaleBanner from "@/components/FlashSaleBanner";
import FreeShippingBanner from "@/components/FreeShippingBanner";
import GlobalErrorReporter from "@/components/GlobalErrorReporter";
import UtmCapture from "@/components/UtmCapture";
// Non-critical global widgets (PWA/notification prompts, stale-browser + OAuth
// handlers, admin impersonation banner, messenger realtime listeners) are
// lazy-loaded client-side after hydration so they no longer ship in every
// page's initial JS bundle. Each renders null until an event/condition fires,
// so deferring them causes no layout shift. See components/DeferredGlobals.tsx.
import DeferredGlobals from "@/components/DeferredGlobals";
// A11y: app-wide reduced-motion support for framer-motion (WCAG 2.2.2/2.3.3).
import MotionProvider from "@/components/MotionProvider";
// Real-user measurement: Vercel Speed Insights (Core Web Vitals field data)
// and Web Analytics (privacy-friendly page views). Both render null and
// inject a lightweight script after hydration; they no-op harmlessly until
// the matching tabs are enabled on the Vercel project dashboard.
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-inter",
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8F5F0' },
    { media: '(prefers-color-scheme: dark)', color: '#0A1018' },
  ],
  width: "device-width",
  initialScale: 1,
  // Pinch zoom intentionally left enabled: maximumScale:1 / userScalable:false
  // fail accessibility audits (WCAG 1.4.4) and carry a Lighthouse penalty
  // that indirectly hurts search ranking.
  viewportFit: "cover",
  // Shrinks the visual viewport when the software keyboard appears.
  // This lets CSS flex layouts (like the messenger) adjust naturally
  // without JavaScript scroll hacks. Supported in Chrome 108+, Safari 16+.
  interactiveWidget: "resizes-visual",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://pepnationlab.com"),
  title: "Pep Nation Lab | Premium Research Peptide Distribution",
  description: "Wholesale research peptide distribution for qualified researchers. Access 300+ compounds including BPC-157, TB-500, Semaglutide, and Tirzepatide. All products for in vitro research use only.",
  keywords: "research peptides, peptide wholesale, laboratory research compounds, BPC-157, TB-500, Semaglutide, Tirzepatide, peptide research, RUO peptides, research grade peptides, peptide distribution",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "PNL",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/logo-mark.svg",
    shortcut: "/logo-mark.svg",
    // iOS ignores SVG apple-touch-icons; serve a 180x180 PNG.
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Pep Nation Lab | Premium Research Peptide Distribution",
    description: "Wholesale research peptide distribution platform for qualified researchers. 300+ RUO compounds with full research library, calculators, and match engine.",
    url: "https://pepnationlab.com",
    siteName: "Pep Nation Lab",
    type: "website",
    images: [{ url: "/og-card.png", width: 1200, height: 630, alt: "Pep Nation Lab - Premium Research Peptide Distribution" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@PepNationLab",
    creator: "@PepNationLab",
    title: "Pep Nation Lab | Premium Research Peptide Distribution",
    description: "Wholesale research peptide distribution for qualified researchers. 300+ RUO compounds.",
    images: ["/og-card.png"],
  },
  // Default: allow indexing. Private/authenticated pages override this with index:false.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  verification: {
    google: 'jydQ-YGi1jcmcK2C8gSJGS5wItC_ndEPdn_AbCsE20k',
    other: {
      'msvalidate.01': '7D606E07E1C0135E5AC562D094D54F53',
    },
  },
  other: {
    'format-detection': 'telephone=no, address=no, email=no, date=no',
  },
};

const NO_FLASH_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem('pnl-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        {/* Early connection to the Supabase origin. Product/storefront imagery,
            auth, and client data reads all hit this host on first navigation;
            preconnecting saves a DNS+TLS round trip on the critical path. */}
        <link rel="preconnect" href="https://ydsaqnnuwyvtyxgvrnys.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://ydsaqnnuwyvtyxgvrnys.supabase.co" />
        {/* RSS feed auto-discovery — enables feed readers and AI crawlers to
            locate the research-updates feed without visiting /feed.xml directly. */}
        <link rel="alternate" type="application/rss+xml" title="Pep Nation Lab Research Updates" href="/feed.xml" />
        {/* Global WebSite + Organization JSON-LD - present on every page.
            SearchAction enables Google Sitelinks Search Box in SERPs. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'WebSite',
                  '@id': 'https://pepnationlab.com/#website',
                  name: 'Pep Nation Lab',
                  url: 'https://pepnationlab.com',
                  description: 'Wholesale research peptide distribution platform for qualified researchers. 300+ RUO compounds with full research library, calculators, and AI match engine.',
                  publisher: { '@id': 'https://pepnationlab.com/#organization' },
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: {
                      '@type': 'EntryPoint',
                      urlTemplate: 'https://pepnationlab.com/research?q={search_term_string}',
                    },
                    'query-input': 'required name=search_term_string',
                  },
                },
                {
                  '@type': 'Organization',
                  '@id': 'https://pepnationlab.com/#organization',
                  name: 'Pep Nation Lab',
                  legalName: 'Pep Nation Lab LLC',
                  foundingDate: '2025',
                  url: 'https://pepnationlab.com',
                  logo: {
                    '@type': 'ImageObject',
                    '@id': 'https://pepnationlab.com/#logo',
                    url: 'https://pepnationlab.com/logo-mark.svg',
                    contentUrl: 'https://pepnationlab.com/logo-mark.svg',
                    width: 512,
                    height: 512,
                    caption: 'Pep Nation Lab',
                  },
                  image: { '@id': 'https://pepnationlab.com/#logo' },
                  description: 'Wholesale research peptide distribution for qualified researchers. All products for in vitro research use only. Not for human consumption.',
                  slogan: 'Research-First Peptide Distribution',
                  email: 'research@pepnationlab.com',
                  contactPoint: {
                    '@type': 'ContactPoint',
                    contactType: 'Customer Support',
                    email: 'research@pepnationlab.com',
                    availableLanguage: ['English'],
                  },
                  // Entity authority profiles — updated 2026-07-07.
                  // Consistency across all profiles (name/handle/website) is the ranking signal.
                  sameAs: [
                    'https://www.wikidata.org/wiki/Q140460136',
                    'https://x.com/PepNationLab',
                    'https://www.youtube.com/@pepnationlab',
                    'https://www.instagram.com/pepnationlab/',
                    'https://www.facebook.com/profile.php?id=61591787160330',
                    'https://www.crunchbase.com/organization/pep-nation-lab',
                    'https://www.reddit.com/user/PepNationLab/',
                    'https://www.bing.com/forbusiness/singleEntity?bizid=cefae10a-706b-4455-acdf-fbc9094f60a3',
                    'https://www.trustpilot.com/review/pepnationlab.com',
                    'https://www.tiktok.com/@pepnationlab',
                    'https://www.pinterest.com/PepNationLab/',
                  ],
                },
              ],
            }),
          }}
        />
      </head>
      <body>
        {/* A11y: skip link — first focusable element on every page (WCAG 2.4.1).
            Revealed on keyboard focus via .skip-link styles in globals.css. */}
        <a href="#main-content" className="skip-link">Skip To Main Content</a>
        <ThemeProvider>
          {/* App-wide capture of uncaught errors + unhandled promise rejections.
              Kept eager so it captures from first paint. */}
          <GlobalErrorReporter />
          {/* First-party acquisition attribution. Eager so first-touch UTM/
              referrer is recorded before the disclaimer gate or any client
              navigation. Renders null; no layout impact. */}
          <UtmCapture />
          {/* fix-56 #2: storefront-wide flash sale banner. Self-hides on /admin and /api.
              Kept eager (server-rendered) so an active sale banner does not pop in
              after hydration and shift layout. */}
          <FlashSaleBanner />
          <FreeShippingBanner />
          <SiteDisclaimerGate>
            <CartProvider>
              <InAppBrowserProvider>
                <MotionProvider>
                  {/* A11y: skip-link target (WCAG 2.4.1). tabIndex={-1} allows
                      programmatic focus without joining the tab order. */}
                  <main className="page-container" id="main-content" tabIndex={-1}>
                    {children}
                  </main>
                </MotionProvider>
              </InAppBrowserProvider>
            </CartProvider>
          </SiteDisclaimerGate>
          <Toaster theme="dark" position="bottom-right" richColors style={{ zIndex: 999999 }} />
          {/* All non-critical global widgets, loaded in their own async chunks
              after hydration instead of in every page's initial bundle. */}
          <DeferredGlobals />
          <Script src="/sw-register.js" strategy="afterInteractive" />
          {/* Real-user field measurement. Render null; scripts load after
              hydration, so no layout or LCP impact. */}
          <SpeedInsights />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
