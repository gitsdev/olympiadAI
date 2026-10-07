import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learning Paths | OlympiadIQ",
  description:
    "Explore your OlympiadIQ learning paths — a knowledge graph of CBSE & ICSE chapters and concepts mapped to your Olympiad syllabus.",
  robots: { index: false, follow: false },
};

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return children;
}
