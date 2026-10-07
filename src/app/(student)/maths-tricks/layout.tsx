import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maths Tricks & Shortcuts | OlympiadIQ",
  description:
    "Learn quick maths tricks from your AI tutor — speed addition, fast multiplication, squares, percentages and Olympiad-specific shortcuts for Classes 1–10.",
  robots: { index: false, follow: false },
};

export default function MathsTricksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
