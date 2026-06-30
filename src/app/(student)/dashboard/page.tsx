import { getStudentProfile, getTodayPlan, getWeakTopics } from "@/actions/student";
import { generateStudyPlan } from "@/actions/study-plan";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const [student, weakTopics] = await Promise.all([
    getStudentProfile(),
    getWeakTopics(3),
  ]);

  let plan = await getTodayPlan();
  if (!plan) {
    plan = await generateStudyPlan();
  }

  return <DashboardClient student={student} plan={plan} weakTopics={weakTopics} />;
}
