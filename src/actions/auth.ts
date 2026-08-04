"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role: "student" },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/onboarding`,
    },
  });

  if (error) return { error: error.message };
  if (!data.user) return { error: "Signup failed — please try again." };

  // Create the profile row using service role so RLS and triggers are not a factor
  const { createServiceClient } = await import("@/lib/supabase/service");
  const service = createServiceClient();
  const { error: profileError } = await service.from("profiles").upsert(
    {
      id:        data.user.id,
      email,
      full_name: fullName || email.split("@")[0],
      role:      "student",
    },
    { onConflict: "id" }
  );

  if (profileError) return { error: profileError.message };

  revalidatePath("/", "layout");

  // No session yet — email confirmation required
  if (!data.session) redirect("/signup/confirm");

  redirect("/onboarding");
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
