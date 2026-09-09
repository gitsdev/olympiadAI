import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/blog");

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "platform_admin") redirect("/dashboard");

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)" }}>
      <header className="border-b" style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}>
        <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-3.5 flex items-center gap-5">
          <Link href="/admin/blog" className="font-bold text-[15px]" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
            OlympiadIQ Admin
          </Link>
          <nav className="flex items-center gap-4 text-[13.5px]" style={{ color: "var(--ink-700)" }}>
            <Link href="/admin/blog" className="hover:underline">Blog posts</Link>
          </nav>
          <span className="flex-1" />
          <Link href="/blog" className="text-[13px] hover:underline" style={{ color: "var(--fg-muted)" }}>
            View blog ↗
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
