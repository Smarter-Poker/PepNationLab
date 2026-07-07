import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "./globals-round2.css";
import "./globals-admin-aliases.css";
import "./globals-mobile-fit.css";
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


export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8F5F0' },
    { media: '(prefers-color-scheme: dark)', color: '#0A1018' },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
    images: [{ url: "/og-card.png", width: 1200, height: 630, alt: "Pep Nation Lab — Premium Research Peptide Distribution" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@pepnationlab",
    title: "Pep Nation Lab | Premium Research Peptide Distribution",
    description: "Wholesale research peptide distribution for qualified researchers. 300+ RUO compounds.",
    images: ["/og-card.png"],
  },
  // Default: allow indexing. Private/authenticated pages override this with index:false.
  robots: {
    index: true,
    follow: true,
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
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
