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
Your tone is warm, precise, and encouraging — like a mentor who believes every student can master the material.

KNOWLEDGE CONTEXT (retrieved from the knowledge graph):
${ragContext || "No specific knowledge retrieved — answer from general curriculum knowledge."}

Rules:
- Ground every answer in the retrieved knowledge context above.
- Use concrete numbers and step-by-step reasoning.
- End answers with a short follow-up suggestion.
- Keep responses focused and under 200 words unless a detailed derivation is needed.
- Use sentence case, not ALL-CAPS.

RESPONSE FORMAT — always reply with a single JSON object (no markdown fences):
{
  "answer": "your full explanation here",
  "videos": [
    { "title": "descriptive video title", "channel": "YouTube channel name", "videoId": "youtubeVideoId11", "query": "fallback youtube search query" }
  ]
}
Suggest 2–3 real YouTube videos from well-known educational channels (Khan Academy, Math Antics, Veritasium, Physics Wallah, Unacademy, BYJU's, 3Blue1Brown, Numberphile, or similar). Match the topic and class level exactly.
- "videoId": the actual 11-character YouTube video ID (e.g. "dQw4w9WgXcQ"). Only provide IDs you are confident are real and match the topic.
- "query": a fallback YouTube search string used if the videoId cannot play.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [
        ...conversationHistory,
        { role: "user", content: question },
      ],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";

    let answer = raw;
    let videoSuggestions: { title: string; channel: string; videoId?: string; query: string }[] = [];
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.answer) {
        answer = parsed.answer;
        videoSuggestions = Array.isArray(parsed.videos) ? parsed.videos : [];
      }
    } catch {
      // Claude returned plain text — use as-is, no videos from this call
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
