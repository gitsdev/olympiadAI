import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./solver.css";

export const metadata: Metadata = {
  title: "AI Question Paper Solver | OlympiadIQ",
  description:
    "Upload a question paper (PDF or Word) and get a complete, formatted answer sheet with step-by-step solutions for Classes 1–10, CBSE, ICSE and Olympiads.",
  robots: { index: false, follow: false },
};

export default function QuestionPaperSolverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
