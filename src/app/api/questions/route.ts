import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60; // seconds — needed for parallel batch generation
import { createClient } from "@/lib/supabase/server";
import { asConcepts } from "@/lib/supabase/types-helper";
import type { Board, Subject, Difficulty } from "@/types/database";

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

// Max questions per single Claude call — keeps each response well within 8 192 token budget
const BATCH_SIZE = 12;

export interface GeneratedQuestion {
  question_text: string;
  options: string[];
  correct_answer_index: number;
  explanation: string;
  difficulty: Difficulty;
  topic_name: string;
  estimated_time_seconds: number;
}

// Compact schema Claude must return (redundant fields filled server-side)
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
  const response = await anthropic.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 8192,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMsg }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
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
      const results = await Promise.all(
        batches.map((n) => generateBatch(n, systemPrompt, userMsg.replace("{N}", String(n))))
      );
      rawQuestions = results.flat();
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
