import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_Devanagari } from "next/font/google";
import { BRAND, brandCssVars } from "@frontend/brand";
import "./globals.css";

const latin = Noto_Sans({ variable: "--font-latin", subsets: ["latin"] });
const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
});

export const metadata: Metadata = {
  title: BRAND.kavach,
  description:
    "Proof of sale recorded at payment time, so honest merchants are ready if a payment is put on hold.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="hi" className={`${latin.variable} ${devanagari.variable} h-full antialiased`}
      style={brandCssVars() as React.CSSProperties}
    >
      <body className="min-h-full bg-slate-200">{children}</body>
    </html>
  );
}
