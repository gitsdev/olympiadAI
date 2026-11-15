import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Credits | OlympiadIQ",
  description: "Your OlympiadIQ credit balance, purchases and credit history.",
  robots: { index: false, follow: false },
};

export default function CreditsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
