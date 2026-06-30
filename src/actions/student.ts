"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  asStudentWithProfile, asStudent, asMetrics, asPlan,
} from "@/lib/supabase/types-helper";
import type { Board, Subject } from "@/types/database";

// cache() deduplicates calls within the same React render (layout + page both call this)
export const getStudentProfile = cache(async function getStudentProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("students")
    .select("*, profile:profiles(full_name, email, avatar_url)")
    .eq("profile_id", user.id)
    .single();

  if (error || !data) redirect("/onboarding");
  return asStudentWithProfile(data)!;
});

export async function getTodayPlan() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rawStudent } = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  const student = asStudent(rawStudent);
  if (!student) return null;

  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("study_plans")
    .select("*")
    .eq("student_id", student.id)
    .eq("plan_date", today)
    .single();

  return asPlan(data);
}

export async function getWeakTopics(limit = 3) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rawStudent } = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  const student = asStudent(rawStudent);
  if (!student) return [];

  const { data } = await supabase
    .from("performance_metrics")
    .select("id, subject, topic_name, mastery_score")
    .eq("student_id", student.id)
    .order("mastery_score", { ascending: true })
    .limit(limit);

  return asMetrics(data);
}

export async function getRecentAttempts(limit = 5) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rawStudent } = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  const student = asStudent(rawStudent);
  if (!student) return [];

  const { data } = await supabase
    .from("test_attempts")
    .select("*")
    .eq("student_id", student.id)
    .order("completed_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as import("@/types/database").TestAttemptRow[];
}

export async function updateProfile(updates: {
  fullName: string;
  board: Board;
  classLevel: number;
  subjects: Subject[];
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [profileResult, studentResult] = await Promise.all([
    supabase
      .from("profiles")
      .update({ full_name: updates.fullName })
      .eq("id", user.id),
    supabase
      .from("students")
      .update({
        board:       updates.board,
        class_level: updates.classLevel,
        subjects:    updates.subjects,
      })
      .eq("profile_id", user.id),
  ]);

  if (profileResult.error) return { error: profileResult.error.message };
  if (studentResult.error) return { error: studentResult.error.message };

  revalidatePath("/", "layout");
  return { error: null };
}
