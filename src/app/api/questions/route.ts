import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // seconds — needed for sequential batch generation
import { createClient } from "@/lib/supabase/server";
import { generateQuestions, type GeneratedQuestion } from "@/lib/questions/generate";
import type { Board, Subject, Difficulty } from "@/types/database";

/* ── POST handler ──────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const {
      subject, topicName, difficulty, count = 10, classLevel, board,
    } = await req.json() as {
      subject: Subject; topicName: string; difficulty: Difficulty;
      count: number; classLevel: number; board: Board;
    };

    const questions = await generateQuestions({ subject, topicName, difficulty, count, classLevel, board });

    // Persist best-effort (don't block response) — only the client-facing
    // route does this; questions generated server-side for a battle (e.g.
    // the friend-invite accept flow) are already snapshotted into
    // battle_questions and don't need a separate copy in the general bank.
    const supabase = await createClient();
    persistQuestions(supabase, questions, subject, classLevel, board).catch(() => {});

    return NextResponse.json({ questions });
  } catch (err) {
    console.error("[/api/questions]", err);
    const message = err instanceof Error ? err.message : "Question generation failed.";
    const status = message.includes("isn't allowed") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/* ── Background persist ────────────────────────────────────────────── */
async function persistQuestions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  questions: GeneratedQuestion[],
  subject: Subject, classLevel: number, board: Board,
) {
  for (const q of questions) {
    const { data: inserted } = await supabase
      .from("questions")
      .insert({
        question_text: q.question_text, question_type: "MCQ",
        subject, class_level: classLevel, board,
        topic_name: q.topic_name, difficulty: q.difficulty,
        explanation: q.explanation,
        correct_answer_index: q.correct_answer_index,
        estimated_time_seconds: q.estimated_time_seconds,
      })
      .select("id")
      .single();

    const id = (inserted as unknown as { id: string } | null)?.id;
    if (id) {
      await supabase.from("question_options").insert(
        q.options.map((text, i) => ({
          question_id: id, option_text: text,
          option_index: i, is_correct: i === q.correct_answer_index,
        }))
      );
    }
  }
}
