import { getRecentAttempts, getWeakTopics } from "@/actions/student";
import ResultsClient from "./ResultsClient";

export default async function ResultsPage() {
  const [attempts, metrics] = await Promise.all([
    getRecentAttempts(1),
    getWeakTopics(3),
  ]);
  return <ResultsClient attempt={attempts[0] ?? null} metrics={metrics} />;
}
