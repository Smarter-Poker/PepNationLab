import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./globals-round2.css";
import { CartProvider } from "@/components/CartContext";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import SiteDisclaimerGate from "@/components/SiteDisclaimerGate";
import StaleBrowserBanner from "@/components/StaleBrowserBanner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "sonner";
import GlobalCallListener from "@/components/messenger/GlobalCallListener";
import SessionKeepalive from "@/components/messenger/SessionKeepalive";
import FirstRunNotificationPrompt from "@/components/FirstRunNotificationPrompt";
import FlashSaleBanner from "@/components/FlashSaleBanner";
import SupportButton from "@/components/messenger/SupportButton";

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
              {children}
            </CartProvider>
          </SiteDisclaimerGate>
          <Toaster theme="dark" position="bottom-right" richColors />
          <ImpersonationBanner />
          <PwaInstallPrompt />
          <GlobalCallListener />
          <FirstRunNotificationPrompt />
          <SessionKeepalive />
          {/* fix-56 #6: floating Support button on /messenger for non-admin users. */}
          <SupportButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
