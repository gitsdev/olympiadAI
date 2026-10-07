import { notFound } from "next/navigation";
import { getPostForEdit } from "@/actions/blog";
import { PostEditor } from "../../PostEditor";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit Blog Post | OlympiadIQ Admin",
  description: "Edit an existing OlympiadIQ blog post.",
};

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPostForEdit(id);
  if (!post) notFound();
  return <PostEditor initial={post} />;
}
