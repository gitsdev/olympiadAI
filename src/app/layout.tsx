import type { Metadata } from "next";
import localFont from "next/font/local";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import { AttributionCapture } from "@/components/attribution/AttributionCapture";
import { GlobalSpinner } from "@/components/layout/GlobalSpinner";

// Self-hosted (Latin, variable weight) rather than next/font/google, so the
// build never depends on fetching from Google Fonts — Turbopack's Google
// font loader failed on Vercel for Bricolage Grotesque.
const bricolage = localFont({
  src: "./fonts/bricolage-grotesque-latin.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
});

const hanken = localFont({
  src: "./fonts/hanken-grotesk-latin.woff2",
  variable: "--font-hanken",
  weight: "100 900",
  display: "swap",
});

const jetbrains = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  variable: "--font-jetbrains",
  weight: "100 800",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.olympiadiq.in";
const TITLE = "OlympiadIQ — Your personal Olympiad coach";
const DESCRIPTION =
  "AI-powered Olympiad preparation for CBSE & ICSE students, Classes 1–10. An AI tutor grounded in your syllabus, adaptive mock tests, and a readiness score that tells you exactly what to fix. Start free with 25 credits.";

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
        <AttributionCapture />
        <GlobalSpinner />
      </body>
      {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
      )}
    </html>
  );
}
