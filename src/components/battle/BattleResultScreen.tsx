"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Trophy, Swords, Handshake, Sparkles, BookOpen, RotateCcw, Award, Check, X } from "lucide-react";
import { OACard, OABadge, OAButton, OASubjectDot, type Subject } from "@/components/ui";
import { track } from "@/lib/analytics";
import type { BattleResultPayload } from "@/actions/battle";

const BATTLE_BADGE_LABELS: Record<string, string> = {
  battle_first_win: "First Victory",
  battle_perfect_score: "Perfect Battle",
  battle_win_streak_3: "3-Win Streak",
  battle_win_streak_5: "5-Win Streak",
  battle_win_streak_10: "10-Win Streak",
  battle_rating_1200: "Rating 1200",
  battle_rating_1400: "Rating 1400",
  battle_veteran_10: "10 Battles Played",
  battle_veteran_50: "50 Battles Played",
};

function getOutcomeCopy(result: BattleResultPayload["result"], opponentLabel: string) {
  const copy: Record<BattleResultPayload["result"], { headline: string; sub: string; Icon: typeof Trophy; tone: string }> = {
    win: { headline: "Victory! Great battle.", sub: `You outscored ${opponentLabel} — keep this momentum going.`, Icon: Trophy, tone: "var(--gold-400)" },
    draw: { headline: "Good battle! It's a draw.", sub: `Neck and neck with ${opponentLabel} — a rematch could tip it your way.`, Icon: Handshake, tone: "var(--cobalt-300)" },
    loss: { headline: "Good battle! You're improving.", sub: "Every battle sharpens you — let's fix a few things and go again.", Icon: Swords, tone: "var(--cobalt-300)" },
  };
  return copy[result];
}

interface BattleResultScreenProps {
  result: BattleResultPayload;
  subject: Subject;
  onBattleAgain: () => void;
  /** "AI Opponent" for AI Battle, or the friend's name for a PvP battle. */
  opponentLabel?: string;
  /** Shown in the Battle recap's per-question rows in place of "You". */
  studentLabel?: string;
}

export function BattleResultScreen({ result, subject, onBattleAgain, opponentLabel = "AI Opponent", studentLabel = "You" }: BattleResultScreenProps) {
  const copy = getOutcomeCopy(result.result, opponentLabel);

  useEffect(() => {
    result.newAchievementKeys.forEach((key) => track("achievement_unlocked", { badge_key: key }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tutorHref(topic: string) {
    return `/tutor?q=${encodeURIComponent(`Teach me about ${topic}.`)}`;
  }
  function practiceHref(topic: string) {
    const params = new URLSearchParams({ subject, topic, difficulty: "Medium", count: "10", autostart: "1" });
    return `/practice?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Outcome banner — always encouraging, never shaming ── */}
      <OACard noPadding className="overflow-hidden relative border-none" style={{ background: "var(--cobalt-700)" }}>
        <div className="absolute inset-0 graph-bg opacity-50" style={{ backgroundSize: "26px 26px" }} />
        <div className="relative p-5 sm:p-6 flex items-center gap-5">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "oklch(1 0 0 / 0.12)" }}
          >
            <copy.Icon size={28} style={{ color: copy.tone }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-white mb-1" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(19px, 3vw, 24px)" }}>
              {copy.headline}
            </h2>
            <p className="text-[13.5px]" style={{ color: "oklch(0.9 0.04 258)" }}>{copy.sub}</p>
          </div>
        </div>
      </OACard>

      {/* ── Score summary ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ScoreStat label="You" value={String(result.studentScore)} tone="var(--brand)" />
        <ScoreStat label={opponentLabel} value={String(result.aiScore)} tone="var(--ink-700)" />
        <ScoreStat
          label="Rating"
          value={`${result.ratingAfter} (${result.ratingDelta >= 0 ? "+" : ""}${result.ratingDelta})`}
          tone={result.ratingDelta >= 0 ? "var(--success-tx)" : "var(--ink-700)"}
        />
        <ScoreStat
          label="Streak"
          value={result.currentStreak > 0 ? `${result.currentStreak} 🔥` : "—"}
          tone="var(--gold-700)"
        />
      </div>

      {/* ── New achievements ── */}
      {result.newAchievementKeys.length > 0 && (
        <OACard style={{ padding: "16px 20px", background: "var(--gold-50)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Award size={17} style={{ color: "var(--gold-700)" }} />
            <h3 className="font-bold text-[15px]" style={{ fontFamily: "var(--font-display)" }}>New achievement{result.newAchievementKeys.length > 1 ? "s" : ""} unlocked!</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.newAchievementKeys.map((key) => (
              <OABadge key={key} tone="gold" className="gap-1.5 px-3 py-1.5">
                <Award size={12} /> {BATTLE_BADGE_LABELS[key] ?? key}
              </OABadge>
            ))}
          </div>
        </OACard>
      )}

      {/* ── Focus areas / weak-topic handoff — the core learning loop ── */}
      {result.weakTopics.length > 0 && (
        <OACard style={{ padding: "18px 20px" }}>
          <h3 className="font-bold text-[16px] mb-1" style={{ fontFamily: "var(--font-display)" }}>Let&apos;s practice this</h3>
          <p className="text-[12.5px] mb-3.5" style={{ color: "var(--fg-muted)" }}>
            Topics from this battle worth another look.
          </p>
          <div className="flex flex-col gap-2.5">
            {result.weakTopics.map((topic) => (
              <div key={topic} className="flex items-center gap-2.5 flex-wrap px-3.5 py-3 rounded-[var(--r-md)]" style={{ background: "var(--paper-2)" }}>
                <OASubjectDot subject={subject} size={8} />
                <span className="flex-1 text-[13.5px] font-semibold min-w-[120px]" style={{ color: "var(--ink-900)" }}>{topic}</span>
                <Link href={tutorHref(topic)} onClick={() => track("ai_tutor_clicked_after_battle", { topic })}>
                  <OAButton variant="soft" size="sm"><Sparkles size={13} /> Ask the tutor</OAButton>
                </Link>
                <Link href={practiceHref(topic)} onClick={() => track("practice_clicked_after_battle", { topic })}>
                  <OAButton variant="secondary" size="sm"><BookOpen size={13} /> Practice this</OAButton>
                </Link>
              </div>
            ))}
          </div>
        </OACard>
      )}

      {/* ── Question-by-question recap ── */}
      <OACard style={{ padding: "18px 20px" }}>
        <h3 className="font-bold text-[16px] mb-3.5" style={{ fontFamily: "var(--font-display)" }}>Battle recap</h3>
        <ol className="flex flex-col gap-2.5">
          {result.questions.map((q, i) => (
            <li key={q.battleQuestionId} className="rounded-[var(--r-md)] border p-3.5" style={{ borderColor: "var(--line-200)" }}>
              <div className="flex items-start justify-between gap-3 mb-1">
                <p className="text-[13px] font-medium flex-1" style={{ color: "var(--ink-900)" }}>
                  <span style={{ color: "var(--fg-muted)" }}>Q{i + 1}.</span> {q.questionText}
                </p>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="flex items-center gap-1 text-[11.5px]" style={{ color: "var(--fg-muted)" }}>
                    {studentLabel.split(" ")[0]} {q.studentCorrect ? <Check size={13} style={{ color: "var(--success)" }} /> : <X size={13} style={{ color: "var(--fg-subtle)" }} />}
                  </span>
                  <span className="flex items-center gap-1 text-[11.5px]" style={{ color: "var(--fg-muted)" }}>
                    {opponentLabel.split(" ")[0]} {q.aiCorrect ? <Check size={13} style={{ color: "var(--success)" }} /> : <X size={13} style={{ color: "var(--fg-subtle)" }} />}
                  </span>
                </div>
              </div>
              {!q.studentCorrect && (
                <p className="text-[12px] mt-1.5" style={{ color: "var(--fg-muted)" }}>
                  Correct answer: <b style={{ color: "var(--ink-900)" }}>{q.options[q.correctOptionIndex]}</b>
                </p>
              )}
            </li>
          ))}
        </ol>
      </OACard>

      {/* ── Actions ── */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onBattleAgain}
          className="flex items-center gap-2 px-5 py-2.5 rounded-[var(--r-md)] text-[14px] font-semibold text-white border-none cursor-pointer"
          style={{ background: "var(--cobalt-500)", boxShadow: "var(--shadow-brand)" }}
        >
          <RotateCcw size={15} /> Battle Again
        </button>
        <Link href="/dashboard" className="ml-auto">
          <OAButton variant="secondary" size="md">Dashboard</OAButton>
        </Link>
      </div>
    </div>
  );
}

function ScoreStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <OACard style={{ padding: "14px 16px" }}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] mb-1" style={{ color: "var(--fg-muted)" }}>{label}</p>
      <p className="font-bold text-[19px] tracking-tight" style={{ fontFamily: "var(--font-mono)", color: tone }}>{value}</p>
    </OACard>
  );
}
