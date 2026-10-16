"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ATTRIBUTION_COOKIE, classifySource, parseAttribution } from "@/lib/attribution";
import { issueVerificationCode } from "@/lib/email-verification";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email:    formData.get("email")    as string,
    password: formData.get("password") as string,
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const fullName = (formData.get("full_name") as string).trim();
  const email    = (formData.get("email")     as string).trim();
  const password =  formData.get("password")  as string;

  if (password.length < 6) return { error: "Password must be at least 6 characters." };

  // Created via the admin API (not auth.signUp) so Supabase never sends its own
  // confirmation email — the email is verified by our Brevo OTP instead, and
  // the email_otp_pending flag keeps the user on /verify-email until then.
  const { createServiceClient } = await import("@/lib/supabase/service");
  const service = createServiceClient();
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: "student" },
    app_metadata: { email_otp_pending: true },
  });

  if (error) {
    if (error.code === "email_exists" || /already.*registered/i.test(error.message)) {
      return { error: "An account with this email already exists. Try signing in instead." };
    }
    return { error: error.message };
  }
  if (!data.user) return { error: "Signup failed — please try again." };

  // Create the profile row using service role so RLS and triggers are not a factor
  const attribution = parseAttribution((await cookies()).get(ATTRIBUTION_COOKIE)?.value);
  const { error: profileError } = await service.from("profiles").upsert(
    {
      id:        data.user.id,
      email,
      full_name: fullName || email.split("@")[0],
      role:      "student",
      signup_source:      classifySource(attribution),
      signup_attribution: attribution,
      email_verified:     false,
    },
    { onConflict: "id" }
  );

  if (profileError) return { error: profileError.message };

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: signInError.message };

  // A failed send isn't fatal — /verify-email offers "Resend code".
  await issueVerificationCode({ id: data.user.id, email, name: fullName });

  revalidatePath("/", "layout");
  redirect("/verify-email");
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const email = (formData.get("email") as string).trim();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/reset-password`,
  });

  // Always report success, whether or not the email is registered — avoids leaking which emails exist.
  return { error: "" };
}

export async function updatePassword(formData: FormData) {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (password !== confirmPassword) return { error: "Passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function changePassword(formData: FormData) {
  const currentPassword = formData.get("current_password") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (password !== confirmPassword) return { error: "New passwords don't match." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Not signed in." };

  // Re-verify identity with the current password before allowing the change —
  // updateUser() alone doesn't check it, so a hijacked/left-open session could
  // otherwise silently lock the real owner out.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) return { error: "Current password is incorrect." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  return { error: "" };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function getSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
