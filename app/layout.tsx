import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartContext";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          {children}
        </CartProvider>
        <Toaster theme="dark" position="bottom-right" richColors />
      </body>
    </html>
  );
}


