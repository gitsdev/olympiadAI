import { requireAdmin } from "@/lib/admin/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminBlogLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <AdminShell adminName={admin.fullName} title="Blog" subtitle="Amazon-affiliate & SEO content">
      {children}
    </AdminShell>
  );
}
