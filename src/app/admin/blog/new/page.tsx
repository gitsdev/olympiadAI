import { PostEditor } from "../PostEditor";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Blog Post | OlympiadIQ Admin",
  description: "Write a new OlympiadIQ blog post.",
};

export const dynamic = "force-dynamic";

export default function NewPostPage() {
  return <PostEditor />;
}
