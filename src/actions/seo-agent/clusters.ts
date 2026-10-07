"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { seoDb } from "@/lib/seo-agent/db";

/** Archives or restores a keyword cluster. Keywords themselves are untouched. */
export async function setClusterStatus(id: string, status: "ACTIVE" | "ARCHIVED"): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success || !["ACTIVE", "ARCHIVED"].includes(status)) {
    return { ok: false, error: "Invalid request." };
  }
  const db = await seoDb();
  const { error } = await db.from("seo_keyword_clusters").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/seo-agent", "layout");
  return { ok: true };
}
