"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { asStudent, asMetrics } from "@/lib/supabase/types-helper";
import type { Subject, StudyPlanItem } from "@/types/database";

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

export async function generateStudyPlan() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: rawStudent } = await supabase
      .from("students")
      .select("id, board, class_level, subjects")
      .eq("profile_id", user.id)
      .single();

    const student = asStudent(rawStudent);
    if (!student) return null;

    const { data } = await supabase
      .from("performance_metrics")
      .select("subject, topic_name, mastery_score")
      .eq("student_id", student.id)
      .order("mastery_score", { ascending: true })
      .limit(5);

    const metrics = asMetrics(data);
    const subjects = (student.subjects ?? []) as Subject[];

    const weakSection = metrics.length > 0
      ? metrics.map((m) => `- ${m.subject}: ${m.topic_name} (mastery ${Math.round(Number(m.mastery_score))}%)`).join("\n")
      : `Subjects enrolled: ${subjects.join(", ") || "Mathematics, Science"}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `You are an Olympiad study coach. Generate a focused daily study plan for a ${student.board} Class ${student.class_level} student.

Weak topics to prioritise:
${weakSection}

Return ONLY a valid JSON array of 4–5 study tasks (no markdown):
[{
  "id": "1",
  "title": "Brief task description",
  "subject": "Mathematics",
  "subj": "Mathematics",
  "kind": "Concept",
  "minutes": 10,
  "done": false
}]

kind must be one of: Concept, Practice, Resource, Mock test.
Mix types. Keep total ≤ 60 min.`,
      }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
    const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let items: StudyPlanItem[];
    try {
      items = JSON.parse(jsonStr);
      if (!Array.isArray(items) || items.length === 0) return null;
    } catch {
      return null;
    }

    const totalMins = items.reduce((s, i) => s + (i.minutes ?? 0), 0);
    const today = new Date().toISOString().split("T")[0];

    const { data: plan } = await supabase
      .from("study_plans")
      .upsert(
        { student_id: student.id, plan_date: today, items, total_minutes: totalMins },
        { onConflict: "student_id,plan_date" }
      )
      .select()
      .single();

    revalidatePath("/dashboard");
    return plan ?? null;
  } catch {
    return null;
  }
}
