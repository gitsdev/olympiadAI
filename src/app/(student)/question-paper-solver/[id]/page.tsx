"use client";

import { use } from "react";
import { AppShell } from "@/components/layout";
import { JobView } from "@/components/question-paper/JobView";

export default function QuestionPaperJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell title="AI Question Paper Solver" subtitle="Your answer sheet">
      <JobView id={id} />
    </AppShell>
  );
}
