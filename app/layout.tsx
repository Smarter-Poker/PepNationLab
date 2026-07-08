import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { CartProvider } from "@/components/CartContext";
import { InAppBrowserProvider } from "@/components/InAppBrowser";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import PWAEnforcer from "@/components/PWAEnforcer";
import SiteDisclaimerGate from "@/components/SiteDisclaimerGate";
import StaleBrowserBanner from "@/components/StaleBrowserBanner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "sonner";
import GlobalCallListener from "@/components/messenger/GlobalCallListener";
import SessionKeepalive from "@/components/messenger/SessionKeepalive";
import FirstRunNotificationPrompt from "@/components/FirstRunNotificationPrompt";
import FlashSaleBanner from "@/components/FlashSaleBanner";

import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
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
    apple: "/logo-mark.svg",
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
                    // ── Tier 1: Knowledge Graph anchors ──────────────────────────
                    'https://www.wikidata.org/wiki/Q140460136',       // ✅ confirmed
                    // LinkedIn company page — add tomorrow after 24-hr new-account lockout lifts:
                    // 'https://www.linkedin.com/company/pepnationlab',
                    'https://x.com/PepNationLab',                     // ✅ confirmed
                    // ── Tier 2: Supporting authority profiles ────────────────────
                    'https://www.youtube.com/@pepnationlab',              // ✅ handle format
                    'https://www.instagram.com/pepnationlab/',         // ✅ confirmed
                    'https://www.facebook.com/profile.php?id=61591787160330', // ✅ Page confirmed
                    // ── Tier 3: Niche / B2B entity signals ──────────────────────
                    'https://www.crunchbase.com/organization/pep-nation-lab', // ✅ confirmed
                    'https://www.reddit.com/user/PepNationLab/',      // ✅ confirmed
                    // ── Additional: AI-model-weighted platforms ──────────────────
                    'https://www.bing.com/forbusiness/singleEntity?bizid=cefae10a-706b-4455-acdf-fbc9094f60a3', // ✅ Bing entity confirmed
                    'https://www.trustpilot.com/review/pepnationlab.com', // ✅ confirmed
                    'https://www.tiktok.com/@pepnationlab',            // ✅ confirmed
                    'https://www.pinterest.com/PepNationLab/',         // ✅ confirmed
                    // GitHub org — add when created:
                    // 'https://github.com/pepnationlab',
                  ],
                },
              ],
            }),
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          {/* fix-56 #2: storefront-wide flash sale banner. Self-hides on /admin and /api. */}
          <FlashSaleBanner />
          <StaleBrowserBanner />
          <SiteDisclaimerGate>
            <CartProvider>
              <InAppBrowserProvider>
                <div className="page-container">
                  {children}
                </div>
              </InAppBrowserProvider>
            </CartProvider>
          </SiteDisclaimerGate>
          <Toaster theme="dark" position="bottom-right" richColors />
          <ImpersonationBanner />
          <PwaInstallPrompt />
          <PWAEnforcer />
          <GlobalCallListener />
          <FirstRunNotificationPrompt />
          <SessionKeepalive />
          <Script src="/sw-register.js" strategy="afterInteractive" />
        </ThemeProvider>
      </body>
    </html>
  );
}
