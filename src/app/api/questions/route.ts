import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

export const maxDuration = 60; // seconds — needed for sequential batch generation
import { createClient } from "@/lib/supabase/server";
import { asConcepts } from "@/lib/supabase/types-helper";
import { withRetry } from "@/lib/ai-retry";
import { moderateText } from "@/lib/moderation";
import type { Board, Subject, Difficulty } from "@/types/database";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// flash-lite: fixed-shape schema output at high volume — fast and reliable
// under free-tier load. The flagship "gemini-3.7-flash" was intermittently
// 503ing under demand when tested; revisit once that settles.
const MODEL = "gemini-3.5-flash-lite";

// Max questions per single Gemini call. The free tier caps this model at
// 15 requests/minute for the WHOLE app (shared with study-plan generation),
// not tokens — so splitting one user's request into several parallel calls
// directly multiplies quota pressure for no benefit. A single call reliably
// handles up to the UI's largest count (40, from Mock Tests) within budget,
// so BATCH_SIZE is set to cover that and effectively disable splitting;
// it only kicks in as a defensive fallback if count ever exceeds this.
const BATCH_SIZE = 40;

// Fixed-shape JSON schema for RawQuestion[] — Gemini is constrained to match
// this exactly, so there's no need for regex-based JSON extraction/fallback.
const QUESTIONS_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      q: { type: Type.STRING, description: "Question text" },
      o: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Exactly 4 answer options" },
      a: { type: Type.INTEGER, description: "Index (0-3) of the correct option" },
      e: { type: Type.STRING, description: "2-3 sentence explanation" },
    },
    required: ["q", "o", "a", "e"],
  },
};

export interface GeneratedQuestion {
  question_text: string;
  options: string[];
  correct_answer_index: number;
  explanation: string;
  difficulty: Difficulty;
  topic_name: string;
  estimated_time_seconds: number;
}

// Compact schema the model must return (redundant fields filled server-side)
interface RawQuestion {
  q: string;          // question text
  o: string[];        // 4 options
  a: number;          // correct index (0-3)
  e: string;          // explanation (2-3 sentences max)
}

/* ── Olympiad context map ──────────────────────────────────────────── */
const OLYMPIAD_MAP: Record<string, string> = {
  "SOF IMO":  "SOF International Mathematics Olympiad — tests mathematical reasoning, pattern recognition, and multi-step problem solving beyond standard curriculum",
  "SOF NSO":  "SOF National Science Olympiad — tests conceptual understanding and application across physics, chemistry, and biology",
  "SOF IEO":  "SOF International English Olympiad — tests vocabulary, grammar, reading comprehension, and verbal reasoning",
  "SOF IGKO": "SOF International General Knowledge Olympiad — tests current affairs, history, geography, civics, and logical reasoning",
  "IOQM":     "Indian Olympiad Qualifier in Mathematics — advanced MCQ on number theory, algebra, combinatorics, and geometry at national competition level",
  "INMO":     "Indian National Mathematical Olympiad — highest national level with problems requiring deep mathematical insight and elegant reasoning",
};

/* ── Robust JSON extraction ────────────────────────────────────────── */
function extractQuestions(raw: string): RawQuestion[] {
  const strip = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

  // Try the whole string first
  try { return JSON.parse(strip); } catch { /* fall through */ }

  // Try to pull out the first [...] block
  const m = strip.match(/\[[\s\S]*\]/);
  if (!m) return [];

  try { return JSON.parse(m[0]); } catch { /* fall through */ }

  // Last resort: parse all complete objects inside the array
  const objects: RawQuestion[] = [];
  const re = /\{[\s\S]*?\}(?=\s*[,\]])/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(m[0])) !== null) {
    try { objects.push(JSON.parse(match[0])); } catch { /* skip malformed */ }
  }
  return objects;
}

/* ── Single-batch generator ────────────────────────────────────────── */
async function generateBatch(
  n: number,
  systemPrompt: string,
  userMsg: string,
): Promise<RawQuestion[]> {
  const response = await withRetry(() => genai.models.generateContent({
    model: MODEL,
    contents: userMsg,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: QUESTIONS_SCHEMA,
      // Generous ceiling for a single call generating up to BATCH_SIZE (40)
      // verbose HOTS questions — no cost to over-provisioning this, since
      // actual usage is billed/capped by what the model actually generates.
      maxOutputTokens: 16384,
    },
  }));

  const raw = response.text ?? "[]";
  // Schema-constrained output should already be valid JSON matching the
  // schema; extractQuestions is a defensive fallback (e.g. a safety block
  // or truncated response), not the primary parsing path.
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, n);
  } catch { /* fall through to the robust extractor */ }
  return extractQuestions(raw).slice(0, n);
}

/* ── POST handler ──────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const {
      subject, topicName, difficulty, count = 10, classLevel, board,
    } = await req.json() as {
      subject: Subject; topicName: string; difficulty: Difficulty;
      count: number; classLevel: number; board: Board;
    };

    // Free-text topic field — same safety gate as the AI Tutor, applied
    // before any DB lookup or model call. Practice and Mock Tests both
    // funnel through this endpoint.
    if (topicName?.trim()) {
      const moderation = await moderateText(topicName);
      if (moderation.blocked) {
        return NextResponse.json(
          { error: "That topic isn't allowed here. Please enter a school curriculum topic." },
          { status: 400 }
        );
      }
    }

    // Fetch concept context from DB (best-effort; fine if empty)
    const supabase = await createClient();
    const { data: rawConcepts } = await supabase
      .from("concepts")
      .select("title, definition, formula, examples")
      .eq("subject", subject)
      .eq("class_level", classLevel)
      .eq("board", board)
      .ilike("topic_name", `%${topicName.split("—")[0].trim()}%`)
      .limit(2);

    const concepts = asConcepts(rawConcepts);
    const conceptContext = concepts
      .map((c) =>
        `${c.title}: ${c.definition}${c.formula ? ` | Formula: ${c.formula}` : ""}${
          c.examples?.length ? ` | Example: ${c.examples[0]}` : ""
        }`
      )
      .join("\n");

    // Detect olympiad
    const olympiadKey = Object.keys(OLYMPIAD_MAP).find((k) => topicName.startsWith(k));
    const olympiadCtx = olympiadKey ? OLYMPIAD_MAP[olympiadKey] : null;

    const estimatedSecs = difficulty === "Easy" ? 45 : difficulty === "Medium" ? 70 : difficulty === "HOTS" ? 120 : 90;

    const systemPrompt = `You generate original MCQ questions for Class ${classLevel} ${subject}.
${olympiadCtx
  ? `Exam context: ${olympiadCtx}.`
  : `Curriculum: ${board} Class ${classLevel} ${subject}.`}
Difficulty: ${difficulty}.${olympiadKey ? ` Match the actual style of ${olympiadKey} past papers.` : ""}
${conceptContext ? `Curriculum notes:\n${conceptContext}` : ""}

Rules:
- Exactly 4 options per question; exactly one correct answer.
- Options must be plausible — no obviously wrong distractors.
- Explanation: 2-3 sentences, show key working step.
- For higher classes (8-12) and HOTS: include multi-step reasoning questions.
- NEVER repeat a question from earlier in this session.

Return ONLY a valid JSON array — no markdown, no preamble:
[{"q":"...","o":["...","...","...","..."],"a":0,"e":"..."}]`;

    const userMsg = olympiadCtx
      ? `Generate EXACTLY {N} ${difficulty} MCQ questions for ${topicName}. Return only the JSON array.`
      : `Generate EXACTLY {N} ${difficulty} MCQ questions for Class ${classLevel} ${subject} — focus area: ${topicName}. Return only the JSON array.`;

    // Split into parallel batches if count > BATCH_SIZE
    let rawQuestions: RawQuestion[];

    if (count <= BATCH_SIZE) {
      rawQuestions = await generateBatch(count, systemPrompt, userMsg.replace("{N}", String(count)));
    } else {
      const batches: number[] = [];
      let remaining = count;
      while (remaining > 0) {
        const n = Math.min(BATCH_SIZE, remaining);
        batches.push(n);
        remaining -= n;
      }
      // allSettled, not all — one exhausted-retry batch (rare but real under
      // free-tier contention) shouldn't sink questions the other batches
      // already generated successfully. Only fail outright if every batch failed.
      const results = await Promise.allSettled(
        batches.map((n) => generateBatch(n, systemPrompt, userMsg.replace("{N}", String(n))))
      );
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          console.error(`[/api/questions] batch ${i} failed:`, r.reason);
        }
      });
      rawQuestions = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    }

    if (rawQuestions.length === 0) {
      return NextResponse.json({ error: "No questions generated." }, { status: 500 });
    }

    // Normalise to full GeneratedQuestion shape
    const questions: GeneratedQuestion[] = rawQuestions.map((r) => ({
      question_text:          r.q,
      options:                r.o,
      correct_answer_index:   r.a,
      explanation:            r.e,
      difficulty,
      topic_name:             topicName,
      estimated_time_seconds: estimatedSecs,
    }));

    // Persist best-effort (don't block response)
    persistQuestions(supabase, questions, subject, classLevel, board).catch(() => {});

    return NextResponse.json({ questions });
  } catch (err) {
    console.error("[/api/questions]", err);
    return NextResponse.json({ error: "Question generation failed." }, { status: 500 });
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

    const id = (inserted as any)?.id;
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
