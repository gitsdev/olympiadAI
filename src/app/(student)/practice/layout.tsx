import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Practice Questions | OlympiadIQ",
  description:
    "Practise unlimited Olympiad-style questions by subject and topic — MCQ, HOTS and reasoning problems with instant, step-by-step explanations.",
  robots: { index: false, follow: false },
};

export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
