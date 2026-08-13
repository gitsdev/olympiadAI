import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { asConcepts, asResources, asStudent } from "@/lib/supabase/types-helper";
import type { Board, TutorReference } from "@/types/database";

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

// Finds the first balanced {...} object in text, tolerating any leading/trailing
// prose or stray markdown the model adds around the JSON payload.
function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { question, conversationHistory, studentClass, studentBoard, conversationId, outputMode } = await req.json() as {
      question: string;
      conversationHistory: { role: "user" | "assistant"; content: string }[];
      studentClass: number;
      studentBoard: Board;
      conversationId?: string | null;
      outputMode?: "fast" | "normal";
    };

    const model      = outputMode === "normal" ? "claude-sonnet-4-6"        : "claude-haiku-4-5-20251001";
    const maxTokens  = outputMode === "normal" ? 2048                        : 1024;

    if (!question?.trim()) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const terms = question.split(" ").slice(0, 3).join(" | ");

    // Parallel: auth check + knowledge retrieval
    const [
      { data: { user } },
      { data: rawConcepts },
      { data: rawResources },
    ] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("concepts")
        .select("id, title, definition, subject, chapter_name, topic_name")
        .eq("class_level", studentClass)
        .eq("board", studentBoard)
        .textSearch("title", terms, { type: "websearch" })
        .limit(3),
      supabase
        .from("resources")
        .select("id, title, url, source_name, resource_type, ai_summary, duration_seconds")
        .eq("class_level", studentClass)
        .eq("board", studentBoard)
        .textSearch("title", terms, { type: "websearch" })
        .limit(4),
    ]);

    const concepts  = asConcepts(rawConcepts);
    const resources = asResources(rawResources);

    const ragContext = [
      ...concepts.map((c) => `CONCEPT: ${c.title}\n${c.definition}`),
      ...resources.map((r) => `RESOURCE: ${r.title} (${r.source_name})\n${r.ai_summary ?? ""}`),
    ].join("\n\n---\n\n");

    const systemPrompt = `You are OlympiadIQ, an expert tutor for CBSE & ICSE students (Class ${studentClass}). Warm, precise, encouraging.

KNOWLEDGE CONTEXT:
${ragContext || "Answer from general curriculum knowledge."}

Reply with a single valid JSON object (no markdown fences):
{"answer":"2–3 paragraph explanation with a worked example","keyInsight":"One key sentence starting with Key idea: or Remember:","visual":{"type":"fraction|number_line|percentage|geometry|bar_chart|none","data":{}},"steps":["step 1","step 2","step 3"],"tryIt":{"q":"short practice question","options":["A","B","C","D"],"correct":0,"why":"why A is correct"},"followUps":["follow-up 1","follow-up 2","follow-up 3"],"videos":[{"title":"title","channel":"channel","videoId":"11charId","query":"search query"}]}

Visual types: fraction:{n,d} | number_line:{min,max,points:[{value,label,highlight}]} | percentage:{value,label} | geometry:{shape,dims} | bar_chart:{bars:[{label,value}]} | none:{}
Use none only for pure language topics. For maths/science always include a visual.
Videos: 1–2 real YouTube videos (Khan Academy, Math Antics, Physics Wallah). Only include videoId if you are certain it is correct.`;

    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [
        ...conversationHistory,
        { role: "user", content: question },
      ],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";

    let answer = raw;
    let keyInsight: string | undefined;
    let visual: { type: string; data: Record<string, unknown> } | undefined;
    let steps: string[] = [];
    let tryIt: { q: string; options: string[]; correct: number; why: string } | undefined;
    let followUps: string[] = [];
    let videoSuggestions: { title: string; channel: string; videoId?: string; query: string }[] = [];
    let parsedOk = false;
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Model added prose/commentary around the JSON — pull out the object itself.
        const extracted = extractJsonObject(cleaned) ?? extractJsonObject(raw);
        if (!extracted) throw new Error("No JSON object found in response");
        parsed = JSON.parse(extracted);
      }
      if (parsed.answer) {
        answer     = parsed.answer;
        keyInsight = typeof parsed.keyInsight === "string" ? parsed.keyInsight : undefined;
        if (parsed.visual?.type && parsed.visual.type !== "none") {
          visual = { type: parsed.visual.type, data: parsed.visual.data ?? {} };
        }
        steps      = Array.isArray(parsed.steps)     ? parsed.steps     : [];
        tryIt      = parsed.tryIt?.q                  ? parsed.tryIt     : undefined;
        followUps  = Array.isArray(parsed.followUps)  ? parsed.followUps : [];
        videoSuggestions = Array.isArray(parsed.videos) ? parsed.videos : [];
        parsedOk = true;
      }
    } catch {
      // Genuinely unparseable — fall through to the friendly fallback below.
    }

    if (!parsedOk) {
      // Never show the raw/broken JSON payload to the student.
      answer = "Sorry, I had trouble putting that answer together — could you try rephrasing your question?";
    }

    const tutorRefs: TutorReference[] = [
      // YouTube video suggestions from Claude
      ...videoSuggestions.map((v, i) => ({
        id:        `yt-${Date.now()}-${i}`,
        type:      "video" as const,
        title:     v.title,
        src:       v.channel,
        meta:      "YouTube",
        videoId:   v.videoId,
        searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(v.query)}`,
        url:       v.videoId
          ? `https://www.youtube-nocookie.com/embed/${v.videoId}?autoplay=1&rel=0`
          : undefined,
      })),
      // Concepts from knowledge graph
      ...concepts.map((c) => ({
        id:    c.id,
        type:  "concept" as const,
        title: c.title,
        src:   "Knowledge graph",
        meta:  `${studentBoard} · Cl ${studentClass}${c.chapter_name ? ` · ${c.chapter_name}` : ""}`,
      })),
      // Resources from DB
      ...resources.map((r) => ({
        id:    r.id,
        type:  (r.resource_type === "video" ? "video"
               : r.resource_type === "practice" ? "practice"
               : "source") as TutorReference["type"],
        title: r.title,
        src:   r.source_name,
        meta:  r.duration_seconds
          ? `${Math.round(r.duration_seconds / 60)}:${String(r.duration_seconds % 60).padStart(2, "0")}`
          : "Linked source",
        url:   r.url,
      })),
    ];

    // Persist conversation in background — does not block the response
    if (user) {
      (async () => {
        try {
          const { data: rawStudent } = await supabase
            .from("students").select("id").eq("profile_id", user.id).single();
          const student = asStudent(rawStudent);
          if (student) {
            const allMessages = [
              ...conversationHistory,
              { role: "user",      content: question },
              { role: "assistant", content: answer   },
            ];
            if (conversationId) {
              await supabase.from("ai_conversations")
                .update({ messages: allMessages })
                .eq("id", conversationId);
            } else {
              await supabase.from("ai_conversations")
                .insert({ student_id: student.id, messages: allMessages });
            }
          }
        } catch {
          // Non-fatal
        }
      })();
    }

    return NextResponse.json({
      answer,
      keyInsight,
      visual,
      steps,
      tryIt,
      followUps,
      references:     tutorRefs,
      usage:          response.usage,
      conversationId: conversationId ?? null,
    });

  } catch (err) {
    console.error("[/api/tutor]", err);
    return NextResponse.json(
      { error: "Tutor service unavailable. Please try again." },
      { status: 500 }
    );
  }
}
