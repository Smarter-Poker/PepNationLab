import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartContext";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import SiteDisclaimerGate from "@/components/SiteDisclaimerGate";
import StaleBrowserBanner from "@/components/StaleBrowserBanner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "sonner";

export const viewport: Viewport = {
  themeColor: "#0A1018",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://pepnationlab.com"),
  title: "Pep Nation Lab | Premium Research Peptides",
  description: "Pep Nation Lab — Wholesale research peptide distribution for qualified researchers and institutions. All products for in vitro research use only.",
  keywords: "research peptides, peptide wholesale, laboratory research compounds",
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
    title: "Pep Nation Lab",
    description: "Premium research peptide distribution platform for qualified researchers.",
    url: "https://pepnationlab.com",
    siteName: "Pep Nation Lab",
    type: "website",
    images: ["/logo.svg"],
  },
  robots: {
    index: false,
    follow: false,
  },
};

// Inline script injected into <head> before React hydration.
// Reads localStorage synchronously to set data-theme on <html>
// BEFORE the first paint, preventing a flash of the wrong theme.
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
    <html lang="en">
      {/* No-flash script runs synchronously before page renders */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <StaleBrowserBanner />
          <SiteDisclaimerGate>
            <CartProvider>
              {children}
            </CartProvider>
          </SiteDisclaimerGate>
          <Toaster theme="dark" position="bottom-right" richColors />
          <ImpersonationBanner />
          <PwaInstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}
