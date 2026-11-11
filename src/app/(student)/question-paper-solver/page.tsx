"use client";

import { CheckCircle2, ListOrdered, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout";
import { JobHistory } from "@/components/question-paper/JobHistory";
import { UploadForm } from "@/components/question-paper/UploadForm";

const POINTS = [
  { Icon: ListOrdered, text: "Every question answered, in the original order and numbering" },
  { Icon: CheckCircle2, text: "Step-by-step maths, MCQ reasoning, diagrams interpreted" },
  { Icon: ShieldCheck, text: "Unclear questions are flagged for review, never guessed" },
];

export default function QuestionPaperSolverPage() {
  return (
    <AppShell title="AI Question Paper Solver" subtitle="Upload a paper, get a complete answer sheet">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-7 py-6 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
          <UploadForm />
          <div className="flex flex-col gap-5">
            <JobHistory />
            <ul className="flex flex-col gap-2.5 px-1">
              {POINTS.map(({ Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5 text-[12.5px]" style={{ color: "var(--ink-700)" }}>
                  <Icon size={16} className="shrink-0 mt-0.5" style={{ color: "var(--brand)" }} />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
