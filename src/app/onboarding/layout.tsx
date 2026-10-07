import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set Up Your Profile | OlympiadIQ",
  description:
    "Tell OlympiadIQ your board, class and subjects so we can build a personalised Olympiad preparation plan for CBSE & ICSE Classes 1–10.",
  robots: { index: false, follow: false },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
