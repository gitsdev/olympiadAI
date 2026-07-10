import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { asConcepts, asResources, asStudent } from "@/lib/supabase/types-helper";
import type { Board, TutorReference } from "@/types/database";

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { question, conversationHistory, studentClass, studentBoard, conversationId } = await req.json() as {
      question: string;
      conversationHistory: { role: "user" | "assistant"; content: string }[];
      studentClass: number;
      studentBoard: Board;
      conversationId?: string | null;
    };

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

    const systemPrompt = `You are OlympiadAI, an expert tutor for CBSE & ICSE students preparing for Olympiads (Class ${studentClass}).
Your tone is warm, precise, and encouraging — like a skilled human teacher who makes every concept click.

KNOWLEDGE CONTEXT (retrieved from the knowledge graph):
${ragContext || "No specific knowledge retrieved — answer from general curriculum knowledge."}

Teaching style:
- Hook the student with a relatable analogy or surprising fact.
- Explain using concrete numbers and a clear worked example.
- Break every solution into atomic steps (no "just" or "simply").
- End with a memorable key insight — one sentence that the student will not forget.
- Use sentence case, not ALL-CAPS.

RESPONSE FORMAT — always reply with a single valid JSON object (no markdown fences):
{
  "answer": "Warm, direct 2–4 paragraph explanation with a concrete worked example. Write as a teacher speaking to the student.",
  "keyInsight": "One memorable sentence starting with 'Key idea:' or 'Remember:' — the single most important takeaway.",
  "visual": {
    "type": "fraction | number_line | percentage | geometry | bar_chart | none",
    "data": { ... type-specific fields shown below ... }
  },
  "steps": [
    "First atomic step — exact operation, no hand-waving",
    "Second step",
    "Final step with a verify/check"
  ],
  "tryIt": {
    "q": "A short practice question different from the worked example",
    "options": ["option A", "option B", "option C", "option D"],
    "correct": 0,
    "why": "Brief explanation of why option A is correct"
  },
  "followUps": [
    "Natural follow-up question 1",
    "Natural follow-up question 2",
    "Natural follow-up question 3"
  ],
  "videos": [
    { "title": "descriptive video title", "channel": "YouTube channel name", "videoId": "youtubeVideoId11", "query": "fallback youtube search query" }
  ]
}

Visual data format by type — pick the type that BEST helps a student visualise the concept:
- fraction:    { "n": 3, "d": 4 }                                   (numerator n, denominator d ≤ 12)
- number_line: { "min": 0, "max": 2, "points": [{"value": 0.5, "label": "½", "highlight": true}] }
- percentage:  { "value": 75, "label": "75 out of 100" }
- geometry:    { "shape": "triangle|circle|rectangle|square", "dims": {"base": 6, "height": 4} }
- bar_chart:   { "bars": [{"label": "Mon", "value": 30}, {"label": "Tue", "value": 70}] }
- none:        {}

Rules for visual:
- Choose "none" ONLY for pure language / grammar / spelling topics with zero mathematical content.
- For every maths, science, or data topic — always choose a visual that aids understanding.
- Keep denominator d ≤ 12 for fractions; keep bar count ≤ 6 for bar charts.

Video rules:
- Suggest 2–3 real YouTube videos from Khan Academy, Math Antics, Veritasium, Physics Wallah, BYJU's, 3Blue1Brown, or Numberphile.
- "videoId": the actual 11-character YouTube ID — only include IDs you are confident are real and match the topic exactly.
- "query": a fallback YouTube search string if the videoId cannot play.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
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
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned);
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
      }
    } catch {
      // Claude returned plain text — use as-is
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

    // Persist conversation (non-fatal if it fails)
    let returnedConvId: string | null = conversationId ?? null;
    if (user) {
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
            const { data: conv } = await supabase.from("ai_conversations")
              .insert({ student_id: student.id, messages: allMessages })
              .select("id")
              .single();
            returnedConvId = (conv as { id: string } | null)?.id ?? null;
          }
        }
      } catch {
        // Non-fatal
      }
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
      conversationId: returnedConvId,
    });

  } catch (err) {
    console.error("[/api/tutor]", err);
    return NextResponse.json(
      { error: "Tutor service unavailable. Please try again." },
      { status: 500 }
    );
  }
}
