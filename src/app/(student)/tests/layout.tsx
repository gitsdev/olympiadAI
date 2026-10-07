import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Olympiad Mock Tests | OlympiadIQ",
  description:
    "Take adaptive Olympiad mock tests for IMO, NSO, IEO, IGKO and more. Choose your Olympiad, configure the test and get a detailed score report.",
  robots: { index: false, follow: false },
};

export default function TestsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
