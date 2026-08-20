import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { Sparkles, ArrowRight } from "lucide-react";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { PublicHeader } from "@/components/layout";
import { OACard, OASubjectDot, type Subject } from "@/components/ui";
import { asTopicPages } from "@/lib/supabase/types-helper";
import { slugify } from "@/lib/slug";

const ALL_SUBJECTS: Subject[] = ["Mathematics", "Science", "English", "General Knowledge", "Cyber"];

function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function resolveSubject(slug: string): Subject | null {
  return ALL_SUBJECTS.find((s) => slugify(s) === slug) ?? null;
}

export async function generateStaticParams() {
  return ALL_SUBJECTS.map((s) => ({ subject: slugify(s) }));
}

export async function generateMetadata({ params }: { params: Promise<{ subject: string }> }): Promise<Metadata> {
  const { subject: slug } = await params;
  const subject = resolveSubject(slug);
  if (!subject) return {};

  const title = `${subject} — Free CBSE & ICSE Topic Guides | OlympiadIQ`;
  const description = `Free ${subject} topic guides for CBSE & ICSE students, Classes 1–10 — definitions, formulas, worked examples, and common mistakes.`;
  return {
    title,
    description,
    alternates: { canonical: `/learn/subject/${slug}` },
    openGraph: { title, description, url: `/learn/subject/${slug}` },
  };
}

export default async function SubjectPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject: slug } = await params;
  const subject = resolveSubject(slug);
  if (!subject) notFound();

  const supabase = publicClient();
  const { data } = await supabase
    .from("topic_pages")
    .select("slug, class_level, chapter_name, topic_name")
    .eq("subject", subject)
    .order("class_level", { ascending: true })
    .order("order_index", { ascending: true });
  const topics = asTopicPages(data);

  const byClass = new Map<number, typeof topics>();
  for (const t of topics) {
    if (!byClass.has(t.class_level)) byClass.set(t.class_level, []);
    byClass.get(t.class_level)!.push(t);
  }
  const classLevels = [...byClass.keys()].sort((a, b) => a - b);

  const serverSupabase = await createServerClient();
  const { data: { user } } = await serverSupabase.auth.getUser();

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)" }}>
      <PublicHeader loggedIn={!!user} />

      <div className="max-w-[900px] mx-auto px-4 sm:px-7 py-8 pb-16">
        <p className="text-[13px] mb-2" style={{ color: "var(--fg-muted)" }}>Subjects</p>
        <div className="flex items-center gap-2.5 mb-2">
          <OASubjectDot subject={subject} size={14} />
          <h1
            className="font-black tracking-tight"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 36px)", letterSpacing: "-0.02em", color: "var(--ink-900)" }}
          >
            {subject}
          </h1>
        </div>
        <p className="text-[14.5px] leading-[1.6] mb-9" style={{ color: "var(--fg-muted)" }}>
          Free {subject} topic guides for CBSE &amp; ICSE students, Classes 1–10 — definitions, formulas, worked
          examples, and common mistakes.
        </p>

        {classLevels.length === 0 ? (
          <OACard className="flex flex-col items-center text-center gap-4 py-12">
            <div className="text-[40px]">🚧</div>
            <div>
              <h2
                className="font-bold text-[17px] tracking-tight mb-1.5"
                style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}
              >
                {subject} guides are coming soon
              </h2>
              <p className="text-[13.5px] leading-[1.6] max-w-[380px]" style={{ color: "var(--fg-muted)" }}>
                We&apos;re still writing this subject&apos;s topic library. In the meantime, our AI Tutor can
                explain any {subject} concept on the spot.
              </p>
            </div>
            <div className="flex items-center gap-2.5 mt-1">
              <Link href={`/tutor?q=${encodeURIComponent(`Teach me a ${subject} concept.`)}`}>
                <div
                  className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-md)] text-[13.5px] font-semibold text-white cursor-pointer"
                  style={{ background: "var(--cobalt-500)" }}
                >
                  <Sparkles size={15} /> Ask the AI Tutor
                </div>
              </Link>
              <Link href="/learn/subject/mathematics">
                <div
                  className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-md)] text-[13.5px] font-semibold cursor-pointer border"
                  style={{ borderColor: "var(--line-300)", color: "var(--ink-700)" }}
                >
                  See Mathematics guides <ArrowRight size={14} />
                </div>
              </Link>
            </div>
          </OACard>
        ) : (
          <div className="flex flex-col gap-8">
            {classLevels.map((cls) => (
              <div key={cls}>
                <div className="px-0.5 pb-3 t-overline">Class {cls}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {byClass.get(cls)!.map((t) => (
                    <Link key={t.slug} href={`/learn/${t.slug}`}>
                      <OACard hover style={{ padding: "14px 16px" }}>
                        <p className="text-[13.5px] font-bold" style={{ color: "var(--ink-900)" }}>{t.topic_name}</p>
                        <p className="text-[11.5px] mt-0.5" style={{ color: "var(--fg-muted)" }}>{t.chapter_name}</p>
                      </OACard>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
