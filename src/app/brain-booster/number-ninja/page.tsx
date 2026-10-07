import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PublicHeader } from "@/components/layout";
import { NumberNinjaGame } from "./NumberNinjaGame";

const TITLE = "Number Ninja — Free Speed & Focus Game for Kids | OlympiadIQ";
const DESCRIPTION =
  "Play Number Ninja free: tap the numbers 1 to N in order as fast as you can. A quick game that sharpens focus, visual scanning and speed for Olympiad exams.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/brain-booster/number-ninja" },
  openGraph: { url: "/brain-booster/number-ninja", title: TITLE, description: DESCRIPTION },
};

export default async function NumberNinjaPage() {
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

        <NumberNinjaGame />
      </div>
    </div>
  );
}
