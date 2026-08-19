import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import {
  ChevronRight, BookOpen, Sigma, AlertTriangle, Trophy,
  Sparkles, PencilLine, ArrowRight,
} from "lucide-react";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { PublicHeader } from "@/components/layout";
import { OACard, OABadge } from "@/components/ui";
import { asConcepts, asTopicPage, asTopicPages } from "@/lib/supabase/types-helper";

// Public-read query helper — no auth/cookies needed, `topic_pages` and
// `concepts` both allow public SELECT via RLS. Used for build-time
// generateStaticParams and (via the cached getTopic below) for the page
// itself, deduping the DB round trip between generateMetadata and the page.
function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function generateStaticParams() {
  const supabase = publicClient();
  const { data } = await supabase.from("topic_pages").select("slug");
  return (data ?? []).map((row) => ({ slug: row.slug as string }));
}

const getTopic = cache(async (slug: string) => {
  const supabase = publicClient();

  const { data: topicRaw } = await supabase
    .from("topic_pages")
    .select("*")
    .eq("slug", slug)
    .single();
  const topic = asTopicPage(topicRaw);
  if (!topic) return null;

  const { data: conceptsRaw } = await supabase
    .from("concepts")
    .select("*")
    .eq("subject", topic.subject)
    .eq("class_level", topic.class_level)
    .eq("topic_name", topic.topic_name)
    .limit(1);
  const concept = asConcepts(conceptsRaw)[0] ?? null;

  const { data: relatedRaw } = await supabase
    .from("topic_pages")
    .select("slug, topic_name, chapter_name")
    .eq("subject", topic.subject)
    .eq("class_level", topic.class_level)
    .neq("slug", slug)
    .order("order_index", { ascending: true })
    .limit(6);
  const related = asTopicPages(relatedRaw);

  return { topic, concept, related };
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getTopic(slug);
  if (!data) return {};

  const { topic } = data;
  const title = `${topic.topic_name} — Class ${topic.class_level} ${topic.subject} | OlympiadIQ`;

  return {
    title,
    description: topic.summary,
    alternates: { canonical: `/learn/${slug}` },
    openGraph: { title, description: topic.summary, url: `/learn/${slug}` },
  };
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getTopic(slug);
  if (!data) notFound();
  const { topic, concept, related } = data;

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const tutorPrompt = `Explain ${topic.topic_name} for Class ${topic.class_level} ${topic.subject}.`;

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)" }}>
      <PublicHeader loggedIn={!!user} />

      <div className="max-w-[760px] mx-auto px-4 sm:px-7 py-8 pb-16">
        {/* Breadcrumb */}
        <div className="flex items-center flex-wrap gap-1.5 text-[13px] mb-5" style={{ color: "var(--fg-muted)" }}>
          <span>{topic.subject}</span>
          <ChevronRight size={13} />
          <span>Class {topic.class_level}</span>
          <ChevronRight size={13} />
          <span style={{ color: "var(--ink-900)", fontWeight: 600 }}>{topic.chapter_name}</span>
        </div>

        {/* Title */}
        <h1
          className="font-black tracking-tight mb-2"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 36px)", letterSpacing: "-0.02em", color: "var(--ink-900)" }}
        >
          {topic.topic_name}
        </h1>
        <p className="text-[14.5px] leading-[1.6] mb-3" style={{ color: "var(--fg-muted)" }}>
          {topic.summary}
        </p>
        <div className="flex items-center flex-wrap gap-2 mb-8">
          <OABadge tone="cobalt">Class {topic.class_level} · {topic.subject}</OABadge>
          <OABadge tone="neutral">CBSE &amp; ICSE</OABadge>
          {topic.olympiad_tags.map((tag) => (
            <OABadge key={tag} tone="gold">
              <Trophy size={12} /> {tag}
            </OABadge>
          ))}
        </div>

        {concept ? (
          <>
            {/* Definition */}
            <OACard className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={17} style={{ color: "var(--brand)" }} />
                <h2 className="font-bold text-[15.5px]" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
                  Definition
                </h2>
              </div>
              <p className="text-[14px] leading-[1.65]" style={{ color: "var(--ink-700)" }}>
                {concept.definition}
              </p>
            </OACard>

            {/* Formula */}
            {concept.formula && (
              <OACard className="mb-5" style={{ background: "var(--cobalt-50)", border: "1px solid var(--cobalt-100)" }}>
                <div className="flex items-center gap-2 mb-2.5">
                  <Sigma size={17} style={{ color: "var(--cobalt-700)" }} />
                  <h2 className="font-bold text-[15.5px]" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
                    Key formula
                  </h2>
                </div>
                <p
                  className="text-[15px] font-semibold"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--cobalt-700)" }}
                >
                  {concept.formula}
                </p>
              </OACard>
            )}

            {/* Examples */}
            {concept.examples.length > 0 && (
              <OACard className="mb-5">
                <h2 className="font-bold text-[15.5px] mb-3" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
                  Worked examples
                </h2>
                <div className="flex flex-col gap-2.5">
                  {concept.examples.map((ex, i) => (
                    <div key={i} className="flex gap-2.5">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                        style={{ background: "var(--fill-100)", color: "var(--ink-700)" }}
                      >
                        {i + 1}
                      </span>
                      <p className="text-[13.5px] leading-[1.6]" style={{ color: "var(--ink-700)" }}>{ex}</p>
                    </div>
                  ))}
                </div>
              </OACard>
            )}

            {/* Common mistakes */}
            {concept.common_mistakes.length > 0 && (
              <OACard className="mb-8" style={{ background: "var(--warning-bg)", border: "1px solid oklch(0.9 0.05 78)" }}>
                <div className="flex items-center gap-2 mb-2.5">
                  <AlertTriangle size={17} style={{ color: "var(--warning-tx)" }} />
                  <h2 className="font-bold text-[15.5px]" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
                    Common mistakes
                  </h2>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {concept.common_mistakes.map((m, i) => (
                    <li key={i} className="text-[13.5px] leading-[1.55]" style={{ color: "var(--warning-tx)" }}>
                      • {m}
                    </li>
                  ))}
                </ul>
              </OACard>
            )}
          </>
        ) : (
          <p className="text-[13.5px] mb-8" style={{ color: "var(--fg-muted)" }}>
            Detailed content for this topic is coming soon.
          </p>
        )}

        {/* CTA row */}
        <div className="flex flex-col sm:flex-row gap-2.5 mb-10">
          <Link href={`/tutor?q=${encodeURIComponent(tutorPrompt)}`} className="flex-1">
            <div
              className="flex items-center gap-2.5 px-4 py-3 rounded-[var(--r-lg)] border cursor-pointer transition-all duration-150 hover:shadow-[var(--shadow-md)]"
              style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}
            >
              <div className="w-9 h-9 rounded-[var(--r-md)] flex items-center justify-center shrink-0" style={{ background: "var(--cobalt-50)" }}>
                <Sparkles size={16} style={{ color: "var(--brand)" }} />
              </div>
              <div className="flex-1">
                <p className="text-[13.5px] font-bold" style={{ color: "var(--ink-900)" }}>Ask the AI Tutor</p>
                <p className="text-[11.5px]" style={{ color: "var(--fg-muted)" }}>Get a step-by-step explanation</p>
              </div>
              <ArrowRight size={15} style={{ color: "var(--fg-subtle)" }} />
            </div>
          </Link>
          <Link
            href={`/practice?subject=${encodeURIComponent(topic.subject)}&topic=${encodeURIComponent(topic.topic_name)}&classLevel=${topic.class_level}`}
            className="flex-1"
          >
            <div
              className="flex items-center gap-2.5 px-4 py-3 rounded-[var(--r-lg)] border cursor-pointer transition-all duration-150 hover:shadow-[var(--shadow-md)]"
              style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}
            >
              <div className="w-9 h-9 rounded-[var(--r-md)] flex items-center justify-center shrink-0" style={{ background: "var(--gold-50)" }}>
                <PencilLine size={16} style={{ color: "var(--gold-700)" }} />
              </div>
              <div className="flex-1">
                <p className="text-[13.5px] font-bold" style={{ color: "var(--ink-900)" }}>Practice this topic</p>
                <p className="text-[11.5px]" style={{ color: "var(--fg-muted)" }}>AI-generated questions</p>
              </div>
              <ArrowRight size={15} style={{ color: "var(--fg-subtle)" }} />
            </div>
          </Link>
        </div>

        {/* Related topics */}
        {related.length > 0 && (
          <div>
            <div className="px-0.5 pb-3 t-overline">More in Class {topic.class_level} {topic.subject}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {related.map((r) => (
                <Link key={r.slug} href={`/learn/${r.slug}`}>
                  <OACard hover style={{ padding: "14px 16px" }}>
                    <p className="text-[13.5px] font-bold" style={{ color: "var(--ink-900)" }}>{r.topic_name}</p>
                    <p className="text-[11.5px] mt-0.5" style={{ color: "var(--fg-muted)" }}>{r.chapter_name}</p>
                  </OACard>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
