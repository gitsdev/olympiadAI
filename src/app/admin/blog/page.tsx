import Link from "next/link";
import { Plus } from "lucide-react";
import { listAllPosts } from "@/actions/blog";
import { OABadge } from "@/components/ui";
import { DeletePostButton } from "./DeletePostButton";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminBlogList() {
  const posts = await listAllPosts();

  return (
    <main className="max-w-[1100px] mx-auto px-5 sm:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-black tracking-tight" style={{ fontFamily: "var(--font-display)", fontSize: "24px", color: "var(--ink-900)" }}>
            Blog posts
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--fg-muted)" }}>{posts.length} total</p>
        </div>
        <Link
          href="/admin/blog/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-md)] text-[13.5px] font-semibold text-white"
          style={{ background: "var(--cobalt-500)" }}
        >
          <Plus size={15} /> New post
        </Link>
      </div>

      <div className="rounded-[var(--r-lg)] border overflow-hidden" style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}>
        {posts.length === 0 ? (
          <p className="p-6 text-[14px]" style={{ color: "var(--fg-muted)" }}>No posts yet. Create your first one.</p>
        ) : (
          <table className="w-full text-[13.5px]">
            <thead>
              <tr style={{ background: "var(--fill-100)", color: "var(--ink-700)" }}>
                <th className="text-left font-semibold p-3">Title</th>
                <th className="text-left font-semibold p-3 hidden sm:table-cell">Category</th>
                <th className="text-left font-semibold p-3">Status</th>
                <th className="text-left font-semibold p-3 hidden md:table-cell">Published</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-t" style={{ borderColor: "var(--line-200)" }}>
                  <td className="p-3">
                    <Link href={`/admin/blog/${p.id}/edit`} className="font-semibold hover:underline" style={{ color: "var(--ink-900)" }}>
                      {p.title}
                    </Link>
                    <div className="text-[11.5px] mt-0.5" style={{ color: "var(--fg-subtle)" }}>/blog/{p.slug}</div>
                  </td>
                  <td className="p-3 hidden sm:table-cell" style={{ color: "var(--ink-700)" }}>{p.category}</td>
                  <td className="p-3">
                    <OABadge tone={p.status === "published" ? "green" : "amber"}>{p.status}</OABadge>
                  </td>
                  <td className="p-3 hidden md:table-cell" style={{ color: "var(--ink-700)" }}>{formatDate(p.published_at)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-3">
                      {p.status === "published" && (
                        <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "var(--brand)" }}>
                          View
                        </a>
                      )}
                      <Link href={`/admin/blog/${p.id}/edit`} className="hover:underline" style={{ color: "var(--brand)" }}>
                        Edit
                      </Link>
                      <DeletePostButton id={p.id} title={p.title} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
