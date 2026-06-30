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

export const metadata: Metadata = {
  title: "OlympiadAI — Your personal Olympiad coach",
  description:
    "AI-powered Olympiad preparation for CBSE & ICSE students. Learn concepts, practice questions, take mock tests, and track your improvement.",
  keywords: ["olympiad", "CBSE", "ICSE", "AI tutor", "math olympiad", "science olympiad"],
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
