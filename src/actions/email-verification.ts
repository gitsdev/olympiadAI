"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEmailOtpPending, issueVerificationCode, verifyCode } from "@/lib/email-verification";

export async function verifyEmailOtp(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isEmailOtpPending(user.app_metadata)) redirect("/onboarding");

  const result = await verifyCode(user.id, String(formData.get("code") ?? ""));
  if (!result.ok) return { error: result.error, notice: "" };

  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function resendEmailOtp() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");
  if (!isEmailOtpPending(user.app_metadata)) redirect("/dashboard");

  const result = await issueVerificationCode({
    id: user.id,
    email: user.email,
    name: (user.user_metadata?.full_name as string | undefined) ?? "",
  });
  if (!result.ok) return { error: result.error, notice: "", retryAfterSeconds: result.retryAfterSeconds };

  return { error: "", notice: `A new code is on its way to ${user.email}.` };
}
