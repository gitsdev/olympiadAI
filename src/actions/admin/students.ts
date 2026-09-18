"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/service";
import type { Board, Subject } from "@/types/database";

export async function setStudentAccountStatus(studentId: string, status: "active" | "suspended") {
  const admin = await requireAdmin();
  const service = createServiceClient();

  const { error } = await service.from("students").update({ account_status: status }).eq("id", studentId);
  if (error) return { error: error.message };

  await logAdminAction(admin.id, status === "suspended" ? "student_suspended" : "student_activated", "student", studentId);
  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath("/admin/students");
  return { error: null };
}

/** Sends the student the same self-service reset-password email they could
 * request themselves — the admin never sets or sees a password directly. */
export async function adminSendPasswordReset(studentId: string) {
  const admin = await requireAdmin();
  const service = createServiceClient();

  const { data: student } = await service
    .from("students")
    .select("profile:profiles(email)")
    .eq("id", studentId)
    .single();
  const email = (student as { profile?: { email?: string } } | null)?.profile?.email;
  if (!email) return { error: "Student email not found" };

  const { error } = await service.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/reset-password`,
  });
  if (error) return { error: error.message };

  await logAdminAction(admin.id, "password_reset_sent", "student", studentId);
  return { error: null };
}

export async function updateStudentDetails(studentId: string, updates: {
  fullName: string;
  board: Board;
  classLevel: number;
  subjects: Subject[];
}) {
  const admin = await requireAdmin();
  const service = createServiceClient();

  const { data: student } = await service.from("students").select("profile_id").eq("id", studentId).single();
  if (!student) return { error: "Student not found" };

  const [profileResult, studentResult] = await Promise.all([
    service.from("profiles").update({ full_name: updates.fullName }).eq("id", (student as { profile_id: string }).profile_id),
    service.from("students").update({
      board: updates.board,
      class_level: updates.classLevel,
      subjects: updates.subjects,
    }).eq("id", studentId),
  ]);

  if (profileResult.error) return { error: profileResult.error.message };
  if (studentResult.error) return { error: studentResult.error.message };

  await logAdminAction(admin.id, "student_updated", "student", studentId, { updates });
  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath("/admin/students");
  return { error: null };
}
