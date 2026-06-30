import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { asConcepts, asResources, asQuestions } from "@/lib/supabase/types-helper";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query      = searchParams.get("q")?.trim() ?? "";
  const classLevel = parseInt(searchParams.get("class") ?? "7");
  const board      = (searchParams.get("board") ?? "CBSE") as "CBSE" | "ICSE";

  if (!query) return NextResponse.json({ results: [] });

  try {
    const supabase = await createClient();

    const [{ data: rawC }, { data: rawR }, { data: rawQ }] = await Promise.all([
      supabase.from("concepts")
        .select("id, title, subject, chapter_name, topic_name, difficulty")
        .eq("class_level", classLevel).eq("board", board)
        .textSearch("title", query, { type: "websearch" }).limit(4),
      supabase.from("resources")
        .select("id, title, resource_type, source_name, duration_seconds")
        .eq("class_level", classLevel).eq("board", board)
        .textSearch("title", query, { type: "websearch" }).limit(4),
      supabase.from("questions")
        .select("id, question_text, subject, topic_name, difficulty")
        .eq("class_level", classLevel).eq("board", board)
        .textSearch("question_text", query, { type: "websearch" }).limit(3),
    ]);

    const concepts   = asConcepts(rawC);
    const resources  = asResources(rawR);
    const questions  = asQuestions(rawQ);

    const results = [
      ...concepts.map((c) => ({
        id: c.id, type: "concept" as const, label: c.title,
        meta: `Concept · ${board} Cl ${classLevel}${c.chapter_name ? ` · ${c.chapter_name}` : ""}`,
      })),
      ...resources.map((r) => ({
        id: r.id,
        type: (r.resource_type === "video" ? "video" : "resource") as "video" | "resource",
        label: r.title,
        meta: `${r.resource_type === "video" ? "Video" : "Resource"} · ${r.source_name}${
          r.duration_seconds ? ` · ${Math.round(r.duration_seconds / 60)} min` : ""
        }`,
      })),
      ...questions.map((q) => ({
        id: q.id, type: "question" as const,
        label: q.question_text.slice(0, 80) + (q.question_text.length > 80 ? "…" : ""),
        meta: `Question · ${q.topic_name ?? q.subject} · ${q.difficulty}`,
      })),
    ];

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[/api/search]", err);
    return NextResponse.json({ results: [] });
  }
}
