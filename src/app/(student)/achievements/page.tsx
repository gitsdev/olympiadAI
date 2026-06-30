import { getStudentProfile } from "@/actions/student";
import { createClient } from "@/lib/supabase/server";
import AchievementsClient from "./AchievementsClient";

async function getEarnedBadgeKeys(studentId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("achievements")
    .select("badge_key")
    .eq("student_id", studentId);
  return (data ?? []).map((r) => r.badge_key);
}

export default async function AchievementsPage() {
  const student = await getStudentProfile();
  const earnedKeys = await getEarnedBadgeKeys(student.id);

  return (
    <AchievementsClient
      earnedKeys={earnedKeys}
      totalPoints={student.total_points}
      streakDays={student.streak_days}
    />
  );
}
