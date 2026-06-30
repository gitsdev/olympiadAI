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
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
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
