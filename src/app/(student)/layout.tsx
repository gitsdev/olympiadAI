import { getStudentProfile } from "@/actions/student";
import { StudentProvider, type StudentUser } from "@/contexts/StudentContext";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const student = await getStudentProfile();

  const user: StudentUser = {
    name:        student.profile?.full_name  ?? "Student",
    email:       student.profile?.email      ?? "",
    board:       student.board,
    cls:         student.class_level,
    streakDays:  student.streak_days,
    totalPoints: student.total_points,
    subjects:    (student.subjects ?? []) as string[],
  };

  return <StudentProvider user={user}>{children}</StudentProvider>;
}
