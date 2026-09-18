import { requireAdmin } from "@/lib/admin/auth";

export const metadata = { robots: { index: false, follow: false } };

// Auth gate only — visual chrome (AdminShell) is applied per-page/section so
// each page can set its own title/subtitle/actions, matching the existing
// (student) app's AppShell-per-page pattern.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
