import { TrendChart } from "./TrendChart";
import type { AdminTestAttemptRow } from "@/types/admin";

export function MockTestPerformanceChart({ attempts }: { attempts: AdminTestAttemptRow[] }) {
  const completed = attempts
    .filter((a) => a.status === "completed")
    .slice()
    .reverse(); // oldest -> newest for a left-to-right trend

  const data = completed.map((a, i) => ({
    x: `T${i + 1}`,
    y: Math.round(a.score),
  }));

  return (
    <TrendChart
      data={data}
      formatY={(y) => `${y}%`}
      formatX={(x) => x}
      emptyLabel="No completed mock tests yet"
    />
  );
}
