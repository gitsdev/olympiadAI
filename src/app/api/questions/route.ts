import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // seconds — needed for sequential batch generation
import { createClient } from "@/lib/supabase/server";
import { generateQuestions, type GeneratedQuestion } from "@/lib/questions/generate";
import { chargeFeatureStart, refundFailedStart } from "@/lib/credits/feature";
import { deductErrorResponse, isValidIdempotencyKey } from "@/lib/credits/deduct";
import type { Board, Subject, Difficulty } from "@/types/database";

/* ── POST handler ──────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const {
      subject, topicName, difficulty, count = 10, classLevel, board, purpose, sessionId,
    } = await req.json() as {
      subject: Subject; topicName: string; difficulty: Difficulty;
      count: number; classLevel: number; board: Board;
      /** What the questions are for — decides which credit price applies. */
      purpose?: "practice" | "mock_test" | "battle";
      /** Client-generated id for this start; retries with it are never charged twice. */
      sessionId?: string;
    };

    const supabase = await createClient();

    // Credits: a Mock Test or Practice session is charged when it starts
    // (priced in /admin/credits/pricing; free while not enabled). Anything
    // that isn't explicitly a battle counts as practice, so leaving the
    // field out can't skip the charge. AI Battle is not charged here.
    let charged: { userId: string; transactionId: string } | null = null;
    if (purpose !== "battle") {
      const featureKey = purpose === "mock_test" ? "mock_test" : "practice";
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      const isAdmin = (profile as { role?: string } | null)?.role === "platform_admin";
      if (!isAdmin) {
        const charge = await chargeFeatureStart({
          userId: user.id,
          featureKey,
          sessionKey: isValidIdempotencyKey(sessionId) ? sessionId : crypto.randomUUID(),
          referenceId: sessionId ?? null,
          metadata: { subject, topic: topicName, count, difficulty },
        });
        if (!charge.ok) {
          const { status, body } = deductErrorResponse(charge);
          return NextResponse.json(body, { status });
        }
        if (charge.status === "charged" && charge.transactionId) {
          charged = { userId: user.id, transactionId: charge.transactionId };
        }
      }
    }

    let questions: GeneratedQuestion[];
    try {
      questions = await generateQuestions({ subject, topicName, difficulty, count, classLevel, board });
      if (!questions.length) throw new Error("No questions were generated.");
    } catch (err) {
      // The session never started — give the credits back.
      if (charged) await refundFailedStart({ ...charged, reason: "question generation failed" }).catch(() => undefined);
      throw err;
    }

    // Persist best-effort (don't block response) — only the client-facing
    // route does this; questions generated server-side for a battle (e.g.
    // the friend-invite accept flow) are already snapshotted into
    // battle_questions and don't need a separate copy in the general bank.
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
