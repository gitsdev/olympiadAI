"use client";

import { Check, Swords, Flame } from "lucide-react";
import { OACard, OASubjectDot, type Subject } from "@/components/ui";
import type { Difficulty } from "@/types/database";
import type { StudentBattleStatsRow } from "@/types/database";

const DIFFICULTIES = ["Easy", "Medium", "Hard", "Adaptive"] as const;

interface BattleSetupFormProps {
  subjects: Subject[];
  selSubject: Subject;
  onSubjectChange: (s: Subject) => void;
  selDifficulty: Difficulty;
  onDifficultyChange: (d: Difficulty) => void;
  selCount: number;
  onCountChange: (c: number) => void;
  allowedCounts: number[];
  stats: StudentBattleStatsRow;
  error?: string;
  onStart: () => void;
}

export function BattleSetupForm({
  subjects, selSubject, onSubjectChange, selDifficulty, onDifficultyChange,
  selCount, onCountChange, allowedCounts, stats, error, onStart,
}: BattleSetupFormProps) {
  const played = stats.wins + stats.losses + stats.draws;

  return (
    <div className="flex flex-col gap-5">
      <OACard noPadding className="overflow-hidden relative border-none" style={{ background: "var(--cobalt-700)" }}>
        <div className="absolute inset-0 graph-bg opacity-50" style={{ backgroundSize: "26px 26px" }} />
        <div className="relative p-5 sm:p-6 flex items-center gap-5">
          <div className="flex-1 min-w-0">
            <p className="t-overline mb-1" style={{ color: "var(--gold-400)" }}>Olympiad Battle</p>
            <h2 className="font-bold text-white mb-2" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px, 3vw, 26px)", letterSpacing: "-0.02em" }}>
              {played === 0 ? "Ready for your first battle?" : "Ready for another battle?"}
            </h2>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px]" style={{ color: "oklch(0.9 0.04 258)" }}>
              <span>Rating <b style={{ fontFamily: "var(--font-mono)", color: "#fff" }}>{stats.rating}</b></span>
              <span>{stats.wins}W – {stats.losses}L – {stats.draws}D</span>
              {stats.current_streak > 0 && (
                <span className="flex items-center gap-1">
                  <Flame size={14} style={{ color: "var(--gold-400)" }} /> {stats.current_streak} win streak
                </span>
              )}
            </div>
          </div>
          <Swords size={44} style={{ color: "var(--gold-400)", opacity: 0.85 }} />
        </div>
      </OACard>

      <OACard style={{ padding: "20px 24px" }}>
        <p className="text-[12px] font-semibold mb-3 uppercase tracking-[0.05em]" style={{ color: "var(--fg-muted)" }}>Subject</p>
        <div className="flex flex-wrap gap-2.5">
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => onSubjectChange(s)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-md)] border-[1.5px] text-[14px] font-semibold cursor-pointer transition-all duration-[140ms]"
              style={{
                borderColor: selSubject === s ? "var(--cobalt-400)" : "var(--line-300)",
                background: selSubject === s ? "var(--cobalt-50)" : "var(--surface)",
                color: selSubject === s ? "var(--cobalt-700)" : "var(--ink-700)",
              }}
            >
              <OASubjectDot subject={s} size={9} />
              {s}
              {selSubject === s && <Check size={13} style={{ color: "var(--cobalt-600)" }} />}
            </button>
          ))}
        </div>
      </OACard>

      <OACard style={{ padding: "20px 24px" }}>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[12px] font-semibold mb-2.5 uppercase tracking-[0.05em]" style={{ color: "var(--fg-muted)" }}>Difficulty</p>
            <div className="flex gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => onDifficultyChange(d)}
                  className="flex-1 py-2 rounded-[var(--r-md)] border-[1.5px] text-[13px] font-semibold cursor-pointer transition-all duration-[140ms]"
                  style={{
                    borderColor: selDifficulty === d ? "var(--cobalt-400)" : "var(--line-300)",
                    background: selDifficulty === d ? "var(--cobalt-50)" : "var(--surface)",
                    color: selDifficulty === d ? "var(--cobalt-700)" : "var(--ink-700)",
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[12px] font-semibold mb-2.5 uppercase tracking-[0.05em]" style={{ color: "var(--fg-muted)" }}>Questions</p>
            <div className="flex gap-2">
              {allowedCounts.map((c) => (
                <button
                  key={c}
                  onClick={() => onCountChange(c)}
                  className="flex-1 py-2 rounded-[var(--r-md)] border-[1.5px] text-[13px] font-bold cursor-pointer transition-all duration-[140ms]"
                  style={{
                    fontFamily: "var(--font-mono)",
                    borderColor: selCount === c ? "var(--cobalt-400)" : "var(--line-300)",
                    background: selCount === c ? "var(--cobalt-50)" : "var(--surface)",
                    color: selCount === c ? "var(--cobalt-700)" : "var(--ink-700)",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </OACard>

      {error && (
        <p className="text-[13px] px-3 py-2 rounded-[var(--r-md)]" style={{ background: "var(--danger-bg)", color: "var(--danger-tx)" }}>
          {error}
        </p>
      )}

      <button
        onClick={onStart}
        className="flex items-center justify-center gap-2 py-3 rounded-[var(--r-md)] text-[15px] font-semibold text-[var(--ink-900)] border-none cursor-pointer"
        style={{ background: "var(--gold-400)", boxShadow: "var(--shadow-brand)" }}
      >
        <Swords size={17} />
        Battle Now · {selCount} questions · {selSubject}
      </button>
    </div>
  );
}
