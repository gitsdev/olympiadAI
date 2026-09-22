import { getStudentProfile, getTodayPlan, getWeakTopics } from "@/actions/student";
import { generateStudyPlan } from "@/actions/study-plan";
import { getOrCreateStudentBattleStats } from "@/lib/battle/battle-data";
import DashboardClient from "./DashboardClient";

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
