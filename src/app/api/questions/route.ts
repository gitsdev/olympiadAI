import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateQuestions, MAX_QUESTION_COUNT, QuestionGenerationError, type GeneratedQuestion,
} from "@/lib/questions/generate";
import { chargeFeatureStart, refundFailedStart } from "@/lib/credits/feature";
import { deductErrorResponse, isValidIdempotencyKey } from "@/lib/credits/deduct";
import type { Board, Subject, Difficulty } from "@/types/database";

// Generation works against its own deadline (GENERATION_BUDGET_MS), kept
// well under this limit so the handler always gets to respond — and to
// refund the credits — instead of being killed by the platform mid-request.
export const maxDuration = 120;
const GENERATION_BUDGET_MS = 90_000;

/* ── POST handler ──────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const {
      subject, topicName, difficulty, count: rawCount = 10, classLevel, board, purpose, sessionId, stage,
    } = await req.json() as {
      subject: Subject; topicName: string; difficulty: Difficulty;
      count: number; classLevel: number; board: Board;
      /** What the questions are for — decides which credit price applies. */
      purpose?: "practice" | "mock_test" | "battle";
      /** Client-generated id for this start; retries with it are never charged twice. */
      sessionId?: string;
      /**
       * "charge": take the credits and return straight away, so the page can
       * show the new balance the moment the session starts. The page then
       * calls again with the same sessionId to generate — that call finds the
       * existing charge (no second deduction) and refunds it if generation fails.
       */
      stage?: "charge";
    };

    if (!subject || !difficulty || !board || !Number.isFinite(Number(classLevel))) {
      return NextResponse.json({ error: "Missing subject, difficulty, class or board." }, { status: 400 });
    }
    // Bounded: the price is per session, so an unbounded count would be free extra work.
    const count = Math.min(MAX_QUESTION_COUNT, Math.max(1, Math.floor(Number(rawCount) || 10)));

    // The two-stage start relies on the same id for both calls; without a
    // valid one each call would be charged separately.
    if (stage === "charge" && !isValidIdempotencyKey(sessionId)) {
      return NextResponse.json({ error: "Missing session id." }, { status: 400 });
    }

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
        // "duplicate" = already charged by the "charge" stage of this session.
        if ((charge.status === "charged" || charge.status === "duplicate") && charge.transactionId) {
          charged = { userId: user.id, transactionId: charge.transactionId };
        }
      }
    }
    // Admins, AI Battle and free (unpriced) sessions have nothing to take.
    if (stage === "charge") return NextResponse.json({ charged: charged !== null });

    let questions: GeneratedQuestion[];
    try {
      questions = await generateQuestions({
        subject, topicName, difficulty, count, classLevel: Number(classLevel), board,
        deadlineMs: startedAt + GENERATION_BUDGET_MS,
      });
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
    // after(): on serverless, un-awaited work can be frozen once the
    // response is sent; after() keeps the function alive until it finishes.
    // Saving is optional — it must never fail a request the student has
    // already been charged for, so scheduling errors fall back to a plain
    // fire-and-forget save.
    const persist = () => persistQuestions(supabase, questions, subject, Number(classLevel), board).catch((err) => {
      console.error("[/api/questions] persist failed:", err);
    });
    try { after(persist); } catch { void persist(); }

    return NextResponse.json({ questions });
  } catch (err) {
    console.error("[/api/questions]", err);
    // Only pass through messages written for students; never raw SDK errors.
    if (err instanceof QuestionGenerationError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "";
    if (message.includes("isn't allowed")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not generate questions. Please try again." }, { status: 500 });
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
