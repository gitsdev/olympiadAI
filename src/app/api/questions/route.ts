import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { asConcepts } from "@/lib/supabase/types-helper";
import type { Board, Subject, Difficulty } from "@/types/database";

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

interface GeneratedQuestion {
  question_text: string;
  options: string[];
  correct_answer_index: number;
  explanation: string;
  difficulty: Difficulty;
  topic_name: string;
  estimated_time_seconds: number;
}

export async function POST(req: NextRequest) {
  try {
    const {
      subject, topicName, difficulty, count = 5, classLevel, board,
    } = await req.json() as {
      subject: Subject; topicName: string; difficulty: Difficulty;
      count: number; classLevel: number; board: Board;
    };

    const supabase = await createClient();
    const { data: rawConcepts } = await supabase
      .from("concepts")
      .select("title, definition, formula, examples, common_mistakes")
      .eq("subject", subject)
      .eq("class_level", classLevel)
      .eq("board", board)
      .ilike("topic_name", `%${topicName}%`)
      .limit(3);

    const concepts = asConcepts(rawConcepts);
    const conceptContext = concepts
      .map((c) =>
        `${c.title}: ${c.definition}${c.formula ? `\nFormula: ${c.formula}` : ""}${
          c.examples?.length ? `\nExamples: ${c.examples.slice(0, 2).join("; ")}` : ""
        }`
      )
      .join("\n\n") ?? "";

    const systemPrompt = `You generate original Olympiad-style MCQ questions for ${board} Class ${classLevel} ${subject}.
Each question must be completely original, pedagogically sound, with exactly one correct answer.

Difficulty: ${difficulty}
Topic: ${topicName}

Knowledge context:
${conceptContext || `Standard ${board} Class ${classLevel} ${subject} curriculum — topic: ${topicName}`}

Return ONLY a valid JSON array of ${count} questions:
[{
  "question_text": "...",
  "options": ["A", "B", "C", "D"],
  "correct_answer_index": 0,
  "explanation": "Step-by-step working...",
  "difficulty": "${difficulty}",
  "topic_name": "${topicName}",
  "estimated_time_seconds": 60
}]`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: `Generate ${count} ${difficulty} MCQ questions about ${topicName} for ${board} Class ${classLevel} ${subject}.`,
      }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
    const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const questions: GeneratedQuestion[] = JSON.parse(jsonStr);

    // Persist to DB asynchronously (best-effort)
    persistQuestions(supabase, questions, subject, classLevel, board).catch(() => {});

    return NextResponse.json({ questions });
  } catch (err) {
    console.error("[/api/questions]", err);
    return NextResponse.json({ error: "Question generation failed." }, { status: 500 });
  }
}

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
