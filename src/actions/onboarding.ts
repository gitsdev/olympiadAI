"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Board, Subject } from "@/types/database";

export async function saveOnboarding(data: {
  board: Board;
  classLevel: number;
  subjects: Subject[];
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("students").upsert(
    {
      profile_id:      user.id,
      board:           data.board,
      class_level:     data.classLevel,
      subjects:        data.subjects,
      streak_days:     0,
      readiness_score: 0,
      total_points:    0,
    },
    { onConflict: "profile_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  redirect("/practice");
}
