import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.olympiadiq.in";
const TITLE = "OlympiadIQ — Your personal Olympiad coach";
const DESCRIPTION =
  "AI-powered Olympiad preparation for CBSE & ICSE students, Classes 1–10. An AI tutor grounded in your syllabus, adaptive mock tests, and a readiness score that tells you exactly what to fix — free for everyone.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["olympiad", "CBSE", "ICSE", "AI tutor", "math olympiad", "science olympiad"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "OlympiadIQ",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
  verification: { google: "o5Qs5U5BAg-PxtX9cfeyRRhkU6lZtOuyRL-3Pd4rsWI" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${hanken.variable} ${jetbrains.variable} h-full`}
      style={{
        /* Wire next/font CSS vars into the design token vars */
        ["--font-display" as string]: "var(--font-bricolage), 'Bricolage Grotesque', system-ui, sans-serif",
        ["--font-sans" as string]:    "var(--font-hanken), 'Hanken Grotesk', system-ui, sans-serif",
        ["--font-mono" as string]:    "var(--font-jetbrains), 'JetBrains Mono', ui-monospace, monospace",
      }}
    >
      <body className="min-h-full antialiased" style={{ fontFamily: "var(--font-sans)" }}>
        {children}
      </body>
    </html>
  );
}
