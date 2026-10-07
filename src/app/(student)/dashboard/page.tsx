import { getStudentProfile, getTodayPlan, getWeakTopics } from "@/actions/student";
import { generateStudyPlan } from "@/actions/study-plan";
import { getOrCreateStudentBattleStats } from "@/lib/battle/battle-data";
import DashboardClient from "./DashboardClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | OlympiadIQ",
  description:
    "Your OlympiadIQ dashboard — readiness score, daily study plan, streak, points and the topics to work on next for your Olympiad exams.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const student = await getStudentProfile();
  const [weakTopics, battleStats] = await Promise.all([
    getWeakTopics(3),
    getOrCreateStudentBattleStats(student.id),
  ]);

  let plan = await getTodayPlan();
  if (!plan) {
    plan = await generateStudyPlan();
  }

  return <DashboardClient student={student} plan={plan} weakTopics={weakTopics} battleStats={battleStats} />;
}
