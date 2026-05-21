import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartContext";

export const metadata: Metadata = {
  title: "Pep Nation Lab | Premium Research Peptides",
  description: "Pep Nation Lab — Wholesale research peptide distribution for qualified researchers and institutions. All products for in vitro research use only.",
  keywords: "research peptides, peptide wholesale, laboratory research compounds",
  openGraph: {
    title: "Pep Nation Lab",
    description: "Premium research peptide distribution platform for qualified researchers.",
    url: "https://pepnationlab.com",
    siteName: "Pep Nation Lab",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
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
      </body>
    </html>
  );
}

