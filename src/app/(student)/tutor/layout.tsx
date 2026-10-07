import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Tutor | OlympiadIQ",
  description:
    "Ask OlympiadIQ's AI tutor anything — step-by-step explanations grounded in your CBSE & ICSE syllabus, with worked examples and practice sets.",
  robots: { index: false, follow: false },
};

export default function TutorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
