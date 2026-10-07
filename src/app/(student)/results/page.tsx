import { getRecentAttempts, getWeakTopics } from "@/actions/student";
import ResultsClient from "./ResultsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Test Results | OlympiadIQ",
  description:
    "Review your OlympiadIQ mock test results — score, accuracy by topic, time per question and the weak areas to focus on next.",
  robots: { index: false, follow: false },
};

export default async function ResultsPage() {
  const [attempts, metrics] = await Promise.all([
    getRecentAttempts(1),
    getWeakTopics(3),
  ]);
  return <ResultsClient attempt={attempts[0] ?? null} metrics={metrics} />;
}
