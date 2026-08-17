"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI, Type } from "@google/genai";
import { withRetry } from "@/lib/ai-retry";
import { asStudent, asMetrics } from "@/lib/supabase/types-helper";
import type { Subject, StudyPlanItem } from "@/types/database";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// flash-lite: fixed-shape schema output — fast and reliable under free-tier
// load. See api/questions/route.ts for the same choice and why.
const MODEL = "gemini-3.5-flash-lite";

const STUDY_PLAN_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id:      { type: Type.STRING },
      title:   { type: Type.STRING, description: "Brief task description" },
      subject: { type: Type.STRING },
      subj:    { type: Type.STRING, description: "Same value as subject" },
      kind:    { type: Type.STRING, enum: ["Concept", "Practice", "Resource", "Mock test"] },
      minutes: { type: Type.INTEGER },
      done:    { type: Type.BOOLEAN },
    },
    required: ["id", "title", "subject", "subj", "kind", "minutes", "done"],
  },
};

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

    const response = await withRetry(() => genai.models.generateContent({
      model: MODEL,
      contents: `You are an Olympiad study coach. Generate a focused daily study plan for a ${student.board} Class ${student.class_level} student.

Weak topics to prioritise:
${weakSection}

Generate 4–5 study tasks. Mix kinds. Keep total minutes ≤ 60.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: STUDY_PLAN_SCHEMA,
      },
    }));

    const raw = response.text ?? "[]";

    let items: StudyPlanItem[];
    try {
      items = JSON.parse(raw);
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
