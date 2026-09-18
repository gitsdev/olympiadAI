import type { AdminSubjectProgress, AdminTopicProgress } from "@/types/admin";

export interface PerformanceInsight {
  label: string;
  detail: string;
  tone: "positive" | "neutral";
}

/**
 * Purely derived from stored metrics — never labels a student "weak"/"poor";
 * uses neutral framing ("needs more practice") per the product's policy.
 */
export function computeInsights(
  subjects: AdminSubjectProgress[],
  topics: AdminTopicProgress[],
): PerformanceInsight[] {
  const insights: PerformanceInsight[] = [];
  const withData = subjects.filter((s) => s.tests_completed > 0 || s.questions_attempted > 0);

  if (withData.length > 0) {
    const strongest = [...withData].sort((a, b) => b.progress_pct - a.progress_pct)[0];
    insights.push({
      label: "Strongest subject",
      detail: `${strongest.subject} — ${Math.round(strongest.progress_pct)}% mastery across ${strongest.tests_completed} tests`,
      tone: "positive",
    });
  }

  const attemptedTopics = topics.filter((t) => t.attempts_count > 0);
  if (attemptedTopics.length > 0) {
    const best = [...attemptedTopics].sort((a, b) => b.accuracy_rate - a.accuracy_rate)[0];
    insights.push({
      label: "Highest accuracy topic",
      detail: `${best.topic_name} (${best.subject}) — ${Math.round(best.accuracy_rate)}% accuracy`,
      tone: "positive",
    });

    const needsPractice = [...attemptedTopics].sort((a, b) => a.accuracy_rate - b.accuracy_rate)[0];
    if (needsPractice.accuracy_rate < 70) {
      insights.push({
        label: "Opportunity for improvement",
        detail: `${needsPractice.topic_name} (${needsPractice.subject}) — ${Math.round(needsPractice.accuracy_rate)}% accuracy, needs more practice`,
        tone: "neutral",
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      label: "Not enough data yet",
      detail: "Insights appear once the student completes a few tests or practice sessions.",
      tone: "neutral",
    });
  }

  return insights;
}
