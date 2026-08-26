import Groq from "groq-sdk";
import { withRetry } from "@/lib/ai-retry";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Small, fast model — this runs before the real request is generated, so it
// needs to be cheap and quick, not the strongest model available. Uses Groq
// (not Gemini) deliberately: Gemini's free tier is already tightly
// quota-limited (see api/questions/route.ts), and this check must not
// compete with it for that budget.
const MODERATION_MODEL = "openai/gpt-oss-20b";

const MODERATION_SYSTEM_PROMPT = `You are a strict but sensible content-safety classifier for an educational platform used by children in Classes 1-10 (roughly ages 6-16).

Classify the STUDENT INPUT below — it may be a tutor question or a practice/topic search phrase. Set "blocked" to true ONLY if it:
- Seeks sexual content, explicit descriptions, or sexual acts. (Legitimate curriculum biology/health topics — human reproductive systems, puberty, reproduction in plants/animals — are standard school science and must NOT be blocked.)
- Requests instructions for illegal activity: making weapons/explosives/drugs, hacking or cracking systems, or other clearly illegal acts.
- Promotes self-harm, suicide, or violence against real people.
- Is otherwise clearly inappropriate for a children's educational platform.

Do NOT block ordinary academic topics even when they touch sensitive subject matter historically or scientifically (wars, the human body, health education, chemistry of common reactions, etc.). When genuinely uncertain, do NOT block — prefer letting legitimate curriculum content through.

Respond with ONLY this JSON: {"blocked": boolean, "reason": "short reason"}`;

const MODERATION_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "moderation_result",
    schema: {
      type: "object",
      properties: {
        blocked: { type: "boolean" },
        reason: { type: "string" },
      },
      required: ["blocked", "reason"],
    },
  },
};

export interface ModerationResult {
  blocked: boolean;
  reason: string;
}

export async function moderateText(text: string): Promise<ModerationResult> {
  try {
    const completion = await withRetry(() => groq.chat.completions.create({
      model: MODERATION_MODEL,
      max_completion_tokens: 128,
      response_format: MODERATION_SCHEMA,
      messages: [
        { role: "system", content: MODERATION_SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    }));
    const raw = completion.choices[0]?.message?.content ?? '{"blocked":false,"reason":""}';
    const parsed = JSON.parse(raw);
    return { blocked: parsed.blocked === true, reason: typeof parsed.reason === "string" ? parsed.reason : "" };
  } catch (err) {
    // Fail OPEN on moderation-service errors — a transient Groq hiccup
    // shouldn't take down the whole feature. Callers should still layer
    // their own model-level safety settings/system prompt independently.
    console.error("[moderation] check failed, failing open:", err);
    return { blocked: false, reason: "" };
  }
}
