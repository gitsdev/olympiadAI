import { GoogleGenAI, Type } from "@google/genai";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import { asConcepts } from "@/lib/supabase/types-helper";
import { moderateText } from "@/lib/moderation";
import type { Board, Subject, Difficulty } from "@/types/database";

/* ── Why this file looks the way it does ─────────────────────────────
 * Measured Nov 2026 on the app's free-tier keys: the Gemini models return
 * 503 "high demand" on most calls, and a 503 can take anywhere from 2s to
 * 80s to come back. The old code made ONE call for the whole request, with
 * 3 retries on the same model and no timeout — so 10+ questions routinely
 * ran past the route's 60s limit, the function was killed (no refund), and
 * the student saw "Could not generate questions".
 *
 * Now:
 *  - requests are split into small batches (≤10) that run in parallel, so
 *    each model call is short (~3-15s) whatever the total count;
 *  - every call has a hard timeout, and each batch walks a chain of
 *    providers (Gemini + several Groq models) instead of retrying a model
 *    that is overloaded;
 *  - a provider that just failed with an overload/rate-limit is skipped for
 *    a short cooldown so later batches don't waste time on it;
 *  - every question is validated (4 distinct options, valid answer index…)
 *    and de-duplicated; any shortfall is topped up in another round;
 *  - the whole thing runs against a deadline well under the route's
 *    maxDuration, so the caller always gets a response (and can refund).
 * ──────────────────────────────────────────────────────────────────── */

/** Questions requested per model call. Small = fast and rarely truncated. */
const BATCH_SIZE = 10;
/** Hard ceiling on a single model call. A healthy 10-question call takes 3-15s. */
const CALL_TIMEOUT_MS = 25_000;
/** Don't start a call with less than this left — it can't finish in time. */
const MIN_CALL_MS = 6_000;
/** Default total budget; callers can pass their own `deadlineMs`. */
const DEFAULT_BUDGET_MS = 85_000;
/** Rounds (first + top-ups) before giving up, deadline permitting. */
const MAX_ROUNDS = 6;
/** Pause before a round that follows one with no progress (quotas refill per minute). */
const STALL_BACKOFF_MS = 8_000;
/** Largest count any screen asks for (Mock Tests offer 40). */
export const MAX_QUESTION_COUNT = 40;

/* ── Output schemas ────────────────────────────────────────────────── */
// Compact shape the models return (redundant fields filled in server-side).
interface RawQuestion {
  q: string;   // question text
  o: string[]; // 4 options
  a: number;   // correct index (0-3)
  e: string;   // explanation
}

const GEMINI_SCHEMA = {
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

// Groq's strict structured output needs an object at the top level.
const GROQ_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["q", "o", "a", "e"],
        properties: {
          q: { type: "string" },
          o: { type: "array", items: { type: "string" } },
          a: { type: "integer" },
          e: { type: "string" },
        },
      },
    },
  },
};

/* ── Providers ─────────────────────────────────────────────────────── */
interface Provider {
  id: string;
  available: () => boolean;
  generate: (systemPrompt: string, userMsg: string, n: number, timeoutMs: number) => Promise<unknown>;
}

let genaiClient: GoogleGenAI | null = null;
function getGenai() {
  genaiClient ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return genaiClient;
}

function geminiProvider(model: string): Provider {
  return {
    id: `gemini:${model}`,
    available: () => Boolean(process.env.GEMINI_API_KEY),
    async generate(systemPrompt, userMsg, _n, timeoutMs) {
      const response = await getGenai().models.generateContent({
        model,
        contents: userMsg,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: GEMINI_SCHEMA,
          // 10 verbose questions are ~2.5k tokens; this leaves room for
          // any thinking tokens, which count against the same budget.
          maxOutputTokens: 8192,
          abortSignal: AbortSignal.timeout(timeoutMs),
        },
      });
      return parseLoose(response.text ?? "");
    },
  };
}

function groqProvider(model: string): Provider {
  return {
    id: `groq:${model}`,
    available: () => Boolean(process.env.GROQ_API_KEY),
    async generate(systemPrompt, userMsg, n, timeoutMs) {
      // Per-call client: no SDK-level retries (the provider chain is the
      // retry), and the timeout is whatever is left of our budget.
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, maxRetries: 0, timeout: timeoutMs });
      const completion = await groq.chat.completions.create({
        model,
        // Groq counts this ceiling against the per-minute token quota up
        // front, so size it to the batch (~150-250 tokens per question).
        max_completion_tokens: Math.min(8192, 600 + n * 400),
        ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" as const } : {}),
        response_format: {
          type: "json_schema",
          json_schema: { name: "mcq_questions", strict: true, schema: GROQ_SCHEMA },
        },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg },
        ],
      });
      return parseLoose(completion.choices[0]?.message?.content ?? "");
    },
  };
}

// Order = preference. Gemini stays first (largest free quota when it's up);
// the Groq models each have their own 8k tokens/min quota, so spreading
// across three of them gives real headroom when Gemini is overloaded.
const PROVIDERS: Provider[] = [
  geminiProvider("gemini-3.5-flash-lite"),
  groqProvider("openai/gpt-oss-120b"),
  groqProvider("openai/gpt-oss-20b"),
  groqProvider("qwen/qwen3.8-27b"),
  geminiProvider("gemini-3.5-flash"),
];

/* ── Provider cooldown (per server instance) ───────────────────────── */
const cooldownUntil = new Map<string, number>();

function isTransient(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  // No status = timeout / abort / network failure.
  return status === undefined || status === 408 || status === 429 || status >= 500;
}

function markFailed(p: Provider, err: unknown) {
  if (!isTransient(err)) return;
  const status = (err as { status?: number })?.status;
  cooldownUntil.set(p.id, Date.now() + (status === 429 ? 60_000 : 30_000));
}

/**
 * Healthy providers first, cooling-down ones last. `offset` rotates the
 * healthy list so parallel batches start on different providers (each has
 * its own quota) instead of all hitting the same one at once.
 */
function providerOrder(offset = 0): Provider[] {
  const now = Date.now();
  const usable = PROVIDERS.filter((p) => p.available());
  const healthy = usable.filter((p) => (cooldownUntil.get(p.id) ?? 0) <= now);
  const cooling = usable.filter((p) => (cooldownUntil.get(p.id) ?? 0) > now);
  const k = healthy.length ? offset % healthy.length : 0;
  return [...healthy.slice(k), ...healthy.slice(0, k), ...cooling];
}

/* ── Parsing & validation ──────────────────────────────────────────── */
/** Accepts a bare array, {questions:[…]}, or any object holding one array. */
function parseLoose(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/g, "").trim();
  if (!stripped) return [];
  try {
    return JSON.parse(stripped);
  } catch {
    return salvageObjects(stripped);
  }
}

/**
 * Truncated/garbled output: pull out every complete top-level {...} inside
 * the first array, using a string-aware brace scanner (question text often
 * contains braces, so a regex isn't safe).
 */
function salvageObjects(text: string): unknown[] {
  const start = text.indexOf("[");
  if (start === -1) return [];
  const out: unknown[] = [];
  let depth = 0, inString = false, escape = false, objStart = -1;
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = inString; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") { if (depth === 0) objStart = i; depth++; }
    else if (ch === "}") {
      depth--;
      if (depth === 0 && objStart !== -1) {
        try { out.push(JSON.parse(text.slice(objStart, i + 1))); } catch { /* skip */ }
        objStart = -1;
      }
    } else if (ch === "]" && depth === 0) break;
  }
  return out;
}

function toArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const values = Object.values(parsed as Record<string, unknown>);
    const arr = values.find(Array.isArray);
    if (arr) return arr as unknown[];
  }
  return [];
}

/** Removes LaTeX delimiters the UI can't render; the prompt asks for plain text anyway. */
function cleanText(s: string): string {
  return s.replace(/\\[()[\]]/g, "").replace(/\s+/g, " ").trim();
}

function validate(item: unknown): RawQuestion | null {
  if (!item || typeof item !== "object") return null;
  const r = item as Record<string, unknown>;
  const q = typeof r.q === "string" ? cleanText(r.q) : "";
  const e = typeof r.e === "string" ? cleanText(r.e) : "";
  const a = typeof r.a === "number" ? r.a : typeof r.a === "string" ? Number(r.a) : NaN;
  if (!q || !Array.isArray(r.o) || r.o.length !== 4) return null;
  const o = r.o.map((x) => (typeof x === "string" || typeof x === "number" ? cleanText(String(x)) : ""));
  if (o.some((x) => !x)) return null;
  if (new Set(o.map((x) => x.toLowerCase())).size !== 4) return null;
  if (!Number.isInteger(a) || a < 0 || a > 3) return null;
  return { q, o, a, e };
}

function questionKey(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/* ── One batch: walk the provider chain until one delivers ─────────── */
async function runBatch(
  n: number,
  systemPrompt: string,
  userMsg: string,
  deadline: number,
  offset: number,
): Promise<RawQuestion[]> {
  for (const provider of providerOrder(offset)) {
    const remaining = deadline - Date.now();
    if (remaining < MIN_CALL_MS) break;
    try {
      const parsed = await provider.generate(systemPrompt, userMsg, n, Math.min(CALL_TIMEOUT_MS, remaining));
      const valid = toArray(parsed).map(validate).filter((x): x is RawQuestion => x !== null);
      if (valid.length > 0) {
        cooldownUntil.delete(provider.id);
        return valid.slice(0, n);
      }
      console.warn(`[generateQuestions] ${provider.id} returned no usable questions`);
    } catch (err) {
      markFailed(provider, err);
      const status = (err as { status?: number })?.status;
      console.warn(`[generateQuestions] ${provider.id} failed (${status ?? "timeout/network"}):`,
        err instanceof Error ? err.message.slice(0, 160) : err);
    }
  }
  return [];
}

/* ── Prompt context ────────────────────────────────────────────────── */
const OLYMPIAD_MAP: Record<string, string> = {
  "SOF IMO":  "SOF International Mathematics Olympiad — tests mathematical reasoning, pattern recognition, and multi-step problem solving beyond standard curriculum",
  "SOF NSO":  "SOF National Science Olympiad — tests conceptual understanding and application across physics, chemistry, and biology",
  "SOF IEO":  "SOF International English Olympiad — tests vocabulary, grammar, reading comprehension, and verbal reasoning",
  "SOF IGKO": "SOF International General Knowledge Olympiad — tests current affairs, history, geography, civics, and logical reasoning",
  "IOQM":     "Indian Olympiad Qualifier in Mathematics — advanced MCQ on number theory, algebra, combinatorics, and geometry at national competition level",
  "INMO":     "Indian National Mathematical Olympiad — highest national level with problems requiring deep mathematical insight and elegant reasoning",
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

export interface GenerateQuestionsParams {
  subject: Subject;
  topicName: string;
  difficulty: Difficulty;
  count: number;
  classLevel: number;
  board: Board;
  /** Absolute time (ms epoch) by which generation must finish. */
  deadlineMs?: number;
}

/**
 * Core "generate N MCQ questions" logic, shared by the client-facing
 * /api/questions route (practice, mock tests, AI Battle setup) and
 * server-side callers (e.g. the friend-battle-invite accept flow). Does NOT
 * persist to the general `questions` bank — callers that want that do it.
 *
 * Returns exactly `count` questions, or — if the deadline hits first — at
 * least half of them. Throws if it can't reach that.
 */
export async function generateQuestions(params: GenerateQuestionsParams): Promise<GeneratedQuestion[]> {
  const { subject, difficulty, classLevel, board } = params;
  const topicName = (params.topicName ?? "").trim() || subject;
  const count = Math.min(MAX_QUESTION_COUNT, Math.max(1, Math.floor(Number(params.count) || 10)));
  const deadline = params.deadlineMs ?? Date.now() + DEFAULT_BUDGET_MS;

  // Free-text topic field — same safety gate as the AI Tutor, applied
  // before any DB lookup or model call.
  const moderation = await moderateText(topicName);
  if (moderation.blocked) {
    throw new Error("That topic isn't allowed here. Please enter a school curriculum topic.");
  }

  // Concept context from the DB (best-effort; fine if empty or failing).
  let conceptContext = "";
  try {
    const supabase = await createClient();
    const { data: rawConcepts } = await supabase
      .from("concepts")
      .select("title, definition, formula, examples")
      .eq("subject", subject)
      .eq("class_level", classLevel)
      .eq("board", board)
      .ilike("topic_name", `%${topicName.split("—")[0].trim()}%`)
      .limit(2);
    conceptContext = asConcepts(rawConcepts)
      .map((c) =>
        `${c.title}: ${c.definition}${c.formula ? ` | Formula: ${c.formula}` : ""}${
          c.examples?.length ? ` | Example: ${c.examples[0]}` : ""
        }`
      )
      .join("\n");
  } catch (err) {
    console.warn("[generateQuestions] concept lookup failed:", err);
  }

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
- Exactly 4 distinct options per question; exactly one correct answer.
- "a" is the 0-based index of the correct option; double-check it matches your explanation.
- Options must be plausible — no obviously wrong distractors.
- Explanation: 2-3 sentences, show the key working step.
- For higher classes (8-12) and HOTS: include multi-step reasoning questions.
- Write maths as plain readable text (x², √2, 3/4, ×, ÷, π, ≤). Never use LaTeX, $ signs or markdown.
- Every question must be different from the others.

Return a JSON array of objects: [{"q":"question","o":["A","B","C","D"],"a":0,"e":"explanation"}]`;

  const focus = olympiadCtx ? topicName : `Class ${classLevel} ${subject} — focus area: ${topicName}`;
  const buildMsg = (n: number, part: number, parts: number, avoid: string[]) => {
    let msg = `Generate EXACTLY ${n} ${difficulty} MCQ questions for ${focus}.`;
    if (parts > 1) {
      msg += ` This is set ${part} of ${parts} being generated in parallel for the same test — favour different sub-topics and question styles than a typical first set would, so the sets don't overlap.`;
    }
    if (avoid.length) {
      msg += `\nDo NOT repeat or rephrase any of these existing questions:\n${avoid.map((q) => `- ${q.slice(0, 120)}`).join("\n")}`;
    }
    return msg;
  };

  const collected: RawQuestion[] = [];
  const seen = new Set<string>();
  const add = (qs: RawQuestion[]) => {
    for (const q of qs) {
      if (collected.length >= count) break;
      const key = questionKey(q.q);
      if (seen.has(key)) continue;
      seen.add(key);
      collected.push(q);
    }
  };

  for (let round = 0, stalled = false; round < MAX_ROUNDS && collected.length < count; round++) {
    if (stalled) {
      // Every provider was busy last round: give quotas a moment to refill.
      const wait = Math.min(STALL_BACKOFF_MS, deadline - Date.now() - MIN_CALL_MS);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }
    if (deadline - Date.now() < MIN_CALL_MS) break;
    const before = collected.length;
    const need = count - collected.length;
    const sizes: number[] = [];
    for (let left = need; left > 0; left -= BATCH_SIZE) sizes.push(Math.min(BATCH_SIZE, left));
    const avoid = round === 0 ? [] : collected.map((q) => q.q).slice(-30);
    const results = await Promise.all(
      sizes.map((n, i) => runBatch(n, systemPrompt, buildMsg(n, i + 1, sizes.length, avoid), deadline, i))
    );
    results.forEach(add);
    stalled = collected.length === before;
  }

  const minimum = Math.ceil(count / 2);
  if (collected.length < minimum) {
    console.error(`[generateQuestions] gave up with only ${collected.length}/${count} questions`);
    throw new QuestionGenerationError();
  }
  if (collected.length < count) {
    console.warn(`[generateQuestions] returning a partial set: ${collected.length}/${count} questions`);
  }

  return collected.map((r) => ({
    question_text:          r.q,
    options:                r.o,
    correct_answer_index:   r.a,
    explanation:            r.e,
    difficulty,
    topic_name:             topicName,
    estimated_time_seconds: estimatedSecs,
  }));
}

/** All AI providers were busy/failing — safe to show the student. */
export class QuestionGenerationError extends Error {
  constructor() {
    super("Our question generator is very busy right now. Please try again in a minute.");
    this.name = "QuestionGenerationError";
  }
}
