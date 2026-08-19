// Topic-seed generator for the public /learn/[slug] pages.
//
// Run: npx tsx --env-file=.env.local scripts/seed-learn-topics.ts
//
// Idempotent — a topic already present in `topic_pages` (matched on
// subject + class_level + topic_name) is skipped, so a partial or
// interrupted run is safe to resume. Extend SEED_TARGETS below to grow
// the matrix; each run only generates what's missing.
//
// Writes to two tables:
//   - topic_pages: the thin routing/structure layer /learn/[slug] reads from.
//   - concepts:    the actual definition/formula/examples content, reusing
//                   the existing table (2 rows per topic — CBSE + ICSE,
//                   identical content) so the AI Tutor and Practice question
//                   generation get real grounding data for these topics too.

import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, Type } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { withRetry } from "../src/lib/ai-retry";
import { slugify } from "../src/lib/slug";
import type { Subject, Board } from "../src/types/database";

const SEED_TARGETS: { subject: Subject; classLevels: number[] }[] = [
  { subject: "Mathematics", classLevels: [6, 7, 8] },
];

const BOARDS: Board[] = ["CBSE", "ICSE"];
const MODEL = "gemini-3.5-flash-lite";
const BETWEEN_CALLS_MS = 1500; // safety margin under the 15 req/min free-tier quota

// Gemini's structure output isn't deterministic between calls — re-running
// the structure pass for a (subject, classLevel) already seeded can produce
// slightly different chapter/topic wording (e.g. "Use of Brackets" vs
// "Using Brackets"), which the exact-name "already seeded" check can't
// catch, creating near-duplicate topic pages. Caching the first successful
// structure to disk and reusing it on every later run makes structure
// generation for a given (subject, classLevel) effectively a one-time cost.
const CACHE_DIR = path.join(__dirname, ".seed-cache");

function cachePath(subject: Subject, classLevel: number): string {
  return path.join(CACHE_DIR, `${slugify(subject)}-class-${classLevel}.json`);
}

function loadCachedStructure(subject: Subject, classLevel: number): ChapterStub[] | null {
  const file = cachePath(subject, classLevel);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function saveCachedStructure(subject: Subject, classLevel: number, chapters: ChapterStub[]) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath(subject, classLevel), JSON.stringify(chapters, null, 2));
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ── Pass 1: structure (chapters + topic stubs) ──────────────────────── */
interface TopicStub {
  name: string;
  summary: string;
  olympiadTags: string[];
}
interface ChapterStub {
  name: string;
  topics: TopicStub[];
}

const STRUCTURE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Chapter name" },
      topics: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            summary: { type: Type.STRING, description: "One-sentence summary" },
            olympiadTags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Subset of: SOF IMO, IOQM, INMO — only if genuinely relevant, else empty array",
            },
          },
          required: ["name", "summary", "olympiadTags"],
        },
      },
    },
    required: ["name", "topics"],
  },
};

async function generateStructure(subject: Subject, classLevel: number): Promise<ChapterStub[]> {
  const response = await withRetry(() => genai.models.generateContent({
    model: MODEL,
    contents: `List 3-4 chapters for the Class ${classLevel} CBSE & ICSE ${subject} curriculum. For each chapter, list 4-6 topics within it. For each topic give a one-sentence summary and, only if genuinely relevant, tag it with any of: SOF IMO, IOQM, INMO (these are maths olympiad exam bodies). Return ONLY the JSON array.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: STRUCTURE_SCHEMA,
      maxOutputTokens: 8192,
    },
  }));
  return JSON.parse(response.text ?? "[]");
}

/* ── Pass 2: content (per chapter, all its missing topics at once) ──── */
interface TopicContent {
  name: string;
  definition: string;
  formula: string;
  examples: string[];
  commonMistakes: string[];
}

const CONTENT_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Must exactly match one of the given topic names" },
      definition: { type: Type.STRING, description: "2-4 sentence clear definition/explanation" },
      formula: { type: Type.STRING, description: "Key formula if applicable, else empty string" },
      examples: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 worked examples" },
      commonMistakes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "1-3 common student mistakes" },
    },
    required: ["name", "definition", "formula", "examples", "commonMistakes"],
  },
};

async function generateContent(subject: Subject, classLevel: number, chapterName: string, topics: TopicStub[]): Promise<TopicContent[]> {
  const topicList = topics.map((t) => t.name).join(", ");
  const response = await withRetry(() => genai.models.generateContent({
    model: MODEL,
    contents: `For the Class ${classLevel} ${subject} chapter "${chapterName}", generate full learning content for EXACTLY these topics: ${topicList}. For each: a clear definition, key formula (if applicable), 2-3 worked examples, and 1-3 common mistakes students make. Return ONLY the JSON array, one entry per topic, "name" matching exactly.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: CONTENT_SCHEMA,
      maxOutputTokens: 16384,
    },
  }));
  return JSON.parse(response.text ?? "[]");
}

/* ── Main ──────────────────────────────────────────────────────────── */
async function main() {
  for (const { subject, classLevels } of SEED_TARGETS) {
    for (const classLevel of classLevels) {
      console.log(`\n=== ${subject} · Class ${classLevel} ===`);

      let chapters = loadCachedStructure(subject, classLevel);
      if (chapters) {
        console.log(`  structure: loaded from cache (${chapters.length} chapters)`);
      } else {
        chapters = await generateStructure(subject, classLevel);
        saveCachedStructure(subject, classLevel, chapters);
        const totalTopics = chapters.reduce((n, c) => n + c.topics.length, 0);
        console.log(`  structure: ${chapters.length} chapters, ${totalTopics} topics`);
        await sleep(BETWEEN_CALLS_MS);
      }

      let orderIndex = 0;
      for (const chapter of chapters) {
        const { data: existing } = await supabase
          .from("topic_pages")
          .select("topic_name")
          .eq("subject", subject)
          .eq("class_level", classLevel)
          .eq("chapter_name", chapter.name);
        const existingNames = new Set((existing ?? []).map((r) => r.topic_name));
        const missingTopics = chapter.topics.filter((t) => !existingNames.has(t.name));

        if (missingTopics.length === 0) {
          console.log(`  ⏭  ${chapter.name}: already seeded (${chapter.topics.length} topics)`);
          orderIndex += chapter.topics.length;
          continue;
        }

        const content = await generateContent(subject, classLevel, chapter.name, missingTopics);
        await sleep(BETWEEN_CALLS_MS);
        const byName = new Map(content.map((c) => [c.name, c]));

        for (const topicStub of missingTopics) {
          const c = byName.get(topicStub.name);
          if (!c) {
            console.log(`  ⚠ no content generated for "${topicStub.name}", skipping`);
            orderIndex++;
            continue;
          }

          const slug = slugify(`${subject}-class-${classLevel}-${topicStub.name}`);

          const { error: tpError } = await supabase.from("topic_pages").upsert(
            {
              slug,
              subject,
              class_level: classLevel,
              chapter_name: chapter.name,
              topic_name: topicStub.name,
              summary: topicStub.summary,
              olympiad_tags: topicStub.olympiadTags,
              order_index: orderIndex,
            },
            { onConflict: "subject,class_level,topic_name" }
          );
          if (tpError) {
            console.log(`  ✗ topic_pages upsert failed for "${topicStub.name}": ${tpError.message}`);
            orderIndex++;
            continue;
          }

          for (const board of BOARDS) {
            const { error: cError } = await supabase.from("concepts").insert({
              title: topicStub.name,
              definition: c.definition,
              formula: c.formula || null,
              examples: c.examples,
              common_mistakes: c.commonMistakes,
              subject,
              class_level: classLevel,
              board,
              chapter_name: chapter.name,
              topic_name: topicStub.name,
              difficulty: "Medium",
            });
            if (cError) console.log(`  ✗ concepts insert failed (${board}) for "${topicStub.name}": ${cError.message}`);
          }

          console.log(`  ✓ ${chapter.name} / ${topicStub.name} → /learn/${slug}`);
          orderIndex++;
        }
      }
    }
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
