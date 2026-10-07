import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PublicHeader } from "@/components/layout";
import { CodeBreakerGame } from "./CodeBreakerGame";

const TITLE = "Code Breaker — Free Logic Puzzle for Kids | OlympiadIQ";
const DESCRIPTION =
  "Play Code Breaker free: crack the secret colour code using feedback clues. A logic puzzle that builds the deductive reasoning Olympiad exams reward.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/brain-booster/code-breaker" },
  openGraph: { url: "/brain-booster/code-breaker", title: TITLE, description: DESCRIPTION },
};

export default async function CodeBreakerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)" }}>
      <PublicHeader loggedIn={!!user} />

      <div className="max-w-[640px] mx-auto px-4 sm:px-7 py-8 pb-14">
        <Link
          href="/brain-booster"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium mb-5 transition-colors hover:text-[var(--cobalt-700)]"
          style={{ color: "var(--fg-muted)" }}
        >
          <ArrowLeft size={14} />
          Back to Brain Booster
        </Link>

        <CodeBreakerGame />
      </div>
    </div>
  );
}
