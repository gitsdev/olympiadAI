"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  PENDING_ONBOARDING_COOKIE, PENDING_ONBOARDING_MAX_AGE_SECONDS,
  parsePending, serializePending, type PendingOnboarding,
} from "@/lib/onboarding-pending";

async function saveStudentRecord(userId: string, data: PendingOnboarding): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("students").upsert(
    {
      profile_id:      userId,
      board:           data.board,
      class_level:     data.classLevel,
      subjects:        data.subjects,
      streak_days:     0,
      readiness_score: 0,
      total_points:    0,
    },
    { onConflict: "profile_id" }
  );
  return error ? error.message : null;
}

// Logged-out visitors keep their choices in a short-lived cookie and go to
// signup; claimPendingOnboarding saves them once the account exists.
export async function saveOnboarding(data: PendingOnboarding) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    (await cookies()).set(PENDING_ONBOARDING_COOKIE, serializePending(data), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: PENDING_ONBOARDING_MAX_AGE_SECONDS,
    });
    redirect("/signup");
  }

  const error = await saveStudentRecord(user.id, data);
  if (error) return { error };

  revalidatePath("/dashboard");
  redirect("/practice");
}

export async function claimPendingOnboarding(): Promise<{ claimed: boolean; error?: string }> {
  const cookieStore = await cookies();
  const pending = parsePending(cookieStore.get(PENDING_ONBOARDING_COOKIE)?.value);
  if (!pending) return { claimed: false };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { claimed: false };

  const error = await saveStudentRecord(user.id, pending);
  if (error) return { claimed: false, error };

  cookieStore.delete(PENDING_ONBOARDING_COOKIE);
  revalidatePath("/dashboard");
  return { claimed: true };
}
