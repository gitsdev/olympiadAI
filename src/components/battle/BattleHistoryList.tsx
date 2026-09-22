"use client";

import { Swords } from "lucide-react";
import { OACard, OABadge, OASubjectDot } from "@/components/ui";
import type { BattleHistoryItem } from "@/lib/battle/battle-data";

// Loss intentionally does NOT use the "red" danger tone — battles are a fun
// learning loop, not something to feel bad about losing.
const RESULT_TONE = { win: "green", loss: "neutral", draw: "amber" } as const;
const RESULT_LABEL = { win: "Win", loss: "Battled", draw: "Draw" } as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function BattleHistoryList({ history }: { history: BattleHistoryItem[] }) {
  if (history.length === 0) {
    return (
      <OACard style={{ padding: "18px 20px", textAlign: "center" }}>
        <Swords size={26} style={{ color: "var(--fg-subtle)", margin: "0 auto 8px" }} />
        <p className="text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
          No battles yet — start your first one above!
        </p>
      </OACard>
    );
  }

  return (
    <OACard style={{ padding: "18px 20px" }}>
      <h3 className="font-bold text-[16px] mb-3" style={{ fontFamily: "var(--font-display)" }}>Recent battles</h3>
      <div className="flex flex-col gap-1.5">
        {history.map((b) => (
          <div
            key={b.battleId}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--r-md)]"
            style={{ background: "var(--paper-2)" }}
          >
            <OASubjectDot subject={b.subject} size={9} />
            <span className="flex-1 text-[13px] font-medium truncate" style={{ color: "var(--ink-900)" }}>
              {b.subject} · {b.difficulty}
            </span>
            {b.status === "completed" && b.result ? (
              <>
                <OABadge tone={RESULT_TONE[b.result]}>{RESULT_LABEL[b.result]}</OABadge>
                <span className="text-[12px] w-[70px] text-right" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>
                  {b.studentScore} – {b.opponentScore ?? "–"}
                </span>
                {b.ratingDelta !== null && (
                  <span
                    className="text-[12px] w-[42px] text-right font-semibold"
                    style={{ fontFamily: "var(--font-mono)", color: b.ratingDelta >= 0 ? "var(--success-tx)" : "var(--fg-muted)" }}
                  >
                    {b.ratingDelta >= 0 ? "+" : ""}{b.ratingDelta}
                  </span>
                )}
              </>
            ) : (
              <OABadge tone="neutral">{b.status === "cancelled" ? "Cancelled" : "In progress"}</OABadge>
            )}
            <span className="text-[11.5px] w-[46px] text-right" style={{ color: "var(--fg-subtle)" }}>
              {formatDate(b.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </OACard>
  );
}
