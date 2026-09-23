import Link from "next/link";
import { ChevronLeft, ChevronRight, Swords, Bot, Users } from "lucide-react";
import { AppShell } from "@/components/layout";
import { OACard, OABadge, OASubjectDot } from "@/components/ui";
import { getStudentProfile } from "@/actions/student";
import { getBattleHistoryPage } from "@/lib/battle/battle-data";

const PAGE_SIZE = 20;

// Loss intentionally does NOT use the "red" danger tone — see BattleHistoryList.
const RESULT_TONE = { win: "green", loss: "neutral", draw: "amber" } as const;
const RESULT_LABEL = { win: "Win", loss: "Battled", draw: "Draw" } as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function BattleHistoryPage({ searchParams }: PageProps) {
  const student = await getStudentProfile();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const { items, totalCount } = await getBattleHistoryPage(student.id, page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <AppShell title="Battle History" subtitle={`${totalCount} battle${totalCount === 1 ? "" : "s"} played`}>
      <div className="max-w-[760px] mx-auto px-4 sm:px-7 py-6 pb-10 flex flex-col gap-4">
        <Link href="/battle" className="text-[13px] font-medium hover:underline" style={{ color: "var(--brand)" }}>
          ← Back to Battle
        </Link>

        <OACard noPadding className="overflow-hidden">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-6">
              <Swords size={26} style={{ color: "var(--fg-subtle)" }} className="mb-3" />
              <p className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>No battles yet</p>
              <p className="text-[13px] mt-1" style={{ color: "var(--fg-muted)" }}>Head to Battle to fight your first one.</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y" style={{ borderColor: "var(--line-200)" }}>
              {items.map((b) => (
                <div key={b.battleId} className="flex items-center gap-3 px-5 py-3.5 flex-wrap">
                  <OASubjectDot subject={b.subject} size={9} />
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-[13.5px] font-semibold" style={{ color: "var(--ink-900)" }}>
                      {b.subject} · {b.difficulty}
                    </p>
                    <p className="text-[12px] flex items-center gap-1" style={{ color: "var(--fg-muted)" }}>
                      {b.mode === "ai" ? <Bot size={11} /> : <Users size={11} />}
                      vs {b.opponentName}
                    </p>
                  </div>
                  {b.result && <OABadge tone={RESULT_TONE[b.result]}>{RESULT_LABEL[b.result]}</OABadge>}
                  <span
                    className="text-[12.5px] w-[64px] text-right"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}
                  >
                    {b.studentScore} – {b.opponentScore ?? "–"}
                  </span>
                  {b.ratingDelta !== null && (
                    <span
                      className="text-[12.5px] w-[44px] text-right font-semibold"
                      style={{ fontFamily: "var(--font-mono)", color: b.ratingDelta >= 0 ? "var(--success-tx)" : "var(--fg-muted)" }}
                    >
                      {b.ratingDelta >= 0 ? "+" : ""}{b.ratingDelta}
                    </span>
                  )}
                  <span className="text-[12px] w-[86px] text-right" style={{ color: "var(--fg-subtle)" }}>
                    {formatDate(b.completedAt ?? b.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </OACard>

        {totalPages > 1 && (
          <nav className="flex items-center justify-between gap-3 pt-1" aria-label="Pagination">
            <span className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>Page {page} of {totalPages}</span>
            <div className="flex items-center gap-1.5">
              <PagerLink page={page - 1} disabled={page <= 1}><ChevronLeft size={15} /></PagerLink>
              <PagerLink page={page + 1} disabled={page >= totalPages}><ChevronRight size={15} /></PagerLink>
            </div>
          </nav>
        )}
      </div>
    </AppShell>
  );
}

function PagerLink({ page, disabled, children }: { page: number; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span
        aria-disabled
        className="w-8 h-8 flex items-center justify-center rounded-[var(--r-md)] border opacity-40 cursor-not-allowed"
        style={{ borderColor: "var(--line-200)", color: "var(--fg-muted)" }}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={`/battle/history?page=${page}`}
      className="w-8 h-8 flex items-center justify-center rounded-[var(--r-md)] border transition-colors hover:bg-[var(--fill-100)]"
      style={{ borderColor: "var(--line-200)", color: "var(--ink-700)" }}
    >
      {children}
    </Link>
  );
}
