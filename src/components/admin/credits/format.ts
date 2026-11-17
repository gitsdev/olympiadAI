const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata",
});

export function fmtDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : "—";
}

export const FEATURE_LABELS: Record<string, string> = {
  ai_tutor: "AI Tutor",
  mock_test: "Mock Tests",
  practice: "Practice",
  friend_battle: "Battle with Friends",
  brain_booster: "Brain Booster",
  question_paper_solver: "Question Paper Solver",
};
