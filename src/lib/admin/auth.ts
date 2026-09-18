import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
}

/**
 * Every admin page, server action and route handler must call this itself —
 * do not rely on the /admin layout alone. Mirrors the platform_admin check
 * already used by src/actions/blog.ts.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", (user as User).id)
    .single();

  const row = profile as { role?: string; full_name?: string } | null;
  if (!row || row.role !== "platform_admin") {
    redirect("/dashboard");
  }
  return { id: user.id, email: user.email ?? "", fullName: row!.full_name ?? "Admin" };
}

export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return (profile as { role?: string } | null)?.role === "platform_admin";
}
