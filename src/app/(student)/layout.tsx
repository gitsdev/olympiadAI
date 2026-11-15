import { getStudentProfile } from "@/actions/student";
import { StudentProvider, type StudentUser } from "@/contexts/StudentContext";
import { createClient } from "@/lib/supabase/server";
import { tryGetOwnBalance } from "@/lib/credits/wallet";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const student = await getStudentProfile();
  // Fails soft (null → balance chip hidden) so the app never breaks on wallet errors.
  const creditBalance = await tryGetOwnBalance(await createClient(), student.profile_id);

  const user: StudentUser = {
    name:        student.profile?.full_name  ?? "Student",
    email:       student.profile?.email      ?? "",
    board:       student.board,
    cls:         student.class_level,
    streakDays:  student.streak_days,
    totalPoints: student.total_points,
    subjects:    (student.subjects ?? []) as string[],
    creditBalance,
  };

  return <StudentProvider user={user}>{children}</StudentProvider>;
}
