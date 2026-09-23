"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Bot, Users, Hourglass } from "lucide-react";
import { AppShell } from "@/components/layout";
import { OACard, OAButton, type Subject } from "@/components/ui";
import { useStudent } from "@/contexts/StudentContext";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import {
  startAiBattle, finishAiBattle, submitPvpBattleAnswers, cancelBattle, getBattleHistory,
  type StartAiBattleQuestion, type BattleResultPayload,
} from "@/actions/battle";
import {
  sendBattleInvitation, acceptBattleInvitation, declineBattleInvitation, cancelBattleInvitation,
  getBattleForPlay, getMyBattleInvitations, getMyActiveBattles,
  type ReceivedInvitation, type SentInvitation,
} from "@/actions/battle-invitations";
import type { BattleHistoryItem, ActiveBattleItem } from "@/lib/battle/battle-data";
import type { Board, Difficulty, StudentBattleStatsRow } from "@/types/database";
import { BattleSetupForm } from "@/components/battle/BattleSetupForm";
import { ChallengeFriendForm } from "@/components/battle/ChallengeFriendForm";
import { BattleInvitationsPanel } from "@/components/battle/BattleInvitationsPanel";
import { BattleQuestionCard } from "@/components/battle/BattleQuestionCard";
import { BattleResultScreen } from "@/components/battle/BattleResultScreen";
import { BattleHistoryList } from "@/components/battle/BattleHistoryList";

type Phase = "setup" | "loading" | "battle" | "waiting" | "results";
type SetupMode = "ai" | "friend";
type BattleKind = "ai" | "pvp";

interface AnswerRecord {
  battleQuestionId: string;
  selectedOptionIndex: number | null;
  timeTakenSeconds: number;
}

interface BattleClientProps {
  initialStats: StudentBattleStatsRow;
  initialHistory: BattleHistoryItem[];
  allowedQuestionCounts: number[];
  defaultQuestionCount: number;
  initialReceivedInvitations: ReceivedInvitation[];
  initialSentInvitations: SentInvitation[];
  initialActiveBattles: ActiveBattleItem[];
}

export default function BattleClient({
  initialStats, initialHistory, allowedQuestionCounts, defaultQuestionCount,
  initialReceivedInvitations, initialSentInvitations, initialActiveBattles,
}: BattleClientProps) {
  const user = useStudent();
  const subjects = (user.subjects.length > 0 ? user.subjects : ["Mathematics"]) as Subject[];

  const [setupMode, setSetupMode] = useState<SetupMode>("ai");
  const [phase, setPhase] = useState<Phase>("setup");
  const [selSubject, setSelSubject] = useState<Subject>(subjects[0]);
  const [selDifficulty, setSelDifficulty] = useState<Difficulty>("Medium");
  const [selCount, setSelCount] = useState(
    allowedQuestionCounts.includes(defaultQuestionCount) ? defaultQuestionCount : allowedQuestionCounts[0] ?? 10
  );
  const [error, setError] = useState("");

  const [stats, setStats] = useState(initialStats);
  const [history, setHistory] = useState(initialHistory);

  const [battleId, setBattleId] = useState<string | null>(null);
  const [battleKind, setBattleKind] = useState<BattleKind>("ai");
  const [opponentName, setOpponentName] = useState("AI Opponent");
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(45);
  const [questions, setQuestions] = useState<StartAiBattleQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [result, setResult] = useState<BattleResultPayload | null>(null);

  const [received, setReceived] = useState(initialReceivedInvitations);
  const [sent, setSent] = useState(initialSentInvitations);
  const [activeBattles, setActiveBattles] = useState(initialActiveBattles);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const [inviteKey, setInviteKey] = useState(0);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState("");

  async function refreshInvitationsAndActive() {
    const [inv, active] = await Promise.all([getMyBattleInvitations(), getMyActiveBattles()]);
    setReceived(inv.received);
    setSent(inv.sent);
    setActiveBattles(active);
  }

  function resetToSetup() {
    setPhase("setup");
    setBattleId(null);
    setBattleKind("ai");
    setOpponentName("AI Opponent");
    setQuestions([]);
    setIdx(0);
    setAnswers([]);
    setResult(null);
    setError("");
  }

  /* ── AI Battle ─────────────────────────────────────────────────────── */

  async function handleStart() {
    setError("");
    track("battle_started", { subject: selSubject, difficulty: selDifficulty, count: selCount });
    setPhase("loading");
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: selSubject, topicName: selSubject, difficulty: selDifficulty,
          count: selCount, classLevel: user.cls, board: user.board,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Could not generate questions.");
      }
      const { questions: generated } = await res.json();
      if (!generated?.length) throw new Error("No questions returned. Try again.");

      const started = await startAiBattle({
        subject: selSubject, difficulty: selDifficulty, classLevel: user.cls,
        board: user.board as Board, questions: generated,
      });
      if ("error" in started) throw new Error(started.error);

      track("ai_battle_started", { battleId: started.battleId, subject: selSubject, difficulty: selDifficulty });
      setBattleId(started.battleId);
      setBattleKind("ai");
      setOpponentName("AI Opponent");
      setTimeLimitSeconds(started.timeLimitSeconds);
      setQuestions(started.questions);
      setIdx(0);
      setAnswers([]);
      setPhase("battle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setPhase("setup");
    }
  }

  /* ── Friend invites ────────────────────────────────────────────────── */

  async function handleSendInvite(email: string) {
    setInviteError("");
    setInviteSending(true);
    const res = await sendBattleInvitation({
      inviteeEmail: email, subject: selSubject, difficulty: selDifficulty,
      classLevel: user.cls, board: user.board as Board, questionCount: selCount,
    });
    setInviteSending(false);
    if ("error" in res) {
      setInviteError(res.error);
      return;
    }
    track("private_battle_created", { battleId: res.battleId, subject: selSubject, difficulty: selDifficulty });
    setInviteKey((k) => k + 1); // remounts ChallengeFriendForm for next time, clearing its email field
    refreshInvitationsAndActive();

    // The invite is sent — start playing right away rather than waiting for
    // the invitee to accept first. The invitee joins this same battle/
    // question set later, via acceptBattleInvitation.
    setBattleId(res.battleId);
    setBattleKind("pvp");
    setOpponentName(email);
    setTimeLimitSeconds(res.timeLimitSeconds);
    setQuestions(res.questions);
    setIdx(0);
    setAnswers([]);
    setPhase("battle");
  }

  async function handleAcceptInvite(invitationId: string) {
    setRespondingId(invitationId);
    const res = await acceptBattleInvitation(invitationId);
    setRespondingId(null);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    track("private_battle_joined", { battleId: res.battleId });
    await refreshInvitationsAndActive();
    handlePlayPvpBattle(res.battleId);
  }

  async function handleRejectInvite(invitationId: string) {
    setRespondingId(invitationId);
    await declineBattleInvitation(invitationId);
    track("battle_invite_declined", { invitationId });
    setRespondingId(null);
    refreshInvitationsAndActive();
  }

  async function handleCancelSent(invitationId: string) {
    await cancelBattleInvitation(invitationId);
    refreshInvitationsAndActive();
  }

  async function handlePlayPvpBattle(battleIdToPlay: string) {
    setError("");
    setPhase("loading");
    const res = await getBattleForPlay(battleIdToPlay);
    if ("error" in res) {
      setError(res.error);
      setPhase("setup");
      return;
    }
    setBattleId(res.battleId);
    setBattleKind("pvp");
    setOpponentName(res.opponentName);
    setSelSubject(res.subject);
    setTimeLimitSeconds(res.timeLimitSeconds);
    setQuestions(res.questions);
    setIdx(0);
    setAnswers([]);
    setPhase("battle");
  }

  /* ── Shared question flow ─────────────────────────────────────────── */

  async function handleQuestionSubmit(selectedIndex: number | null, timeTakenSeconds: number, timedOut: boolean) {
    const q = questions[idx];
    track(timedOut ? "question_timeout" : "question_answered", { battleId: battleId ?? undefined, questionIndex: idx });
    const nextAnswers = [...answers, { battleQuestionId: q.battleQuestionId, selectedOptionIndex: selectedIndex, timeTakenSeconds }];
    setAnswers(nextAnswers);

    if (idx + 1 >= questions.length) {
      await finishBattle(nextAnswers);
    } else {
      setIdx(idx + 1);
    }
  }

  async function finishBattle(finalAnswers: AnswerRecord[]) {
    if (!battleId) return;
    setPhase("loading");
    const res = battleKind === "pvp"
      ? await submitPvpBattleAnswers(battleId, finalAnswers)
      : await finishAiBattle(battleId, finalAnswers);

    if ("error" in res) {
      setError(res.error);
      setPhase("setup");
      return;
    }
    if ("waiting" in res) {
      track("battle_completed", { battleId, waiting: true });
      refreshInvitationsAndActive();
      setPhase("waiting");
      return;
    }

    track("battle_completed", { battleId, result: res.result, studentScore: res.studentScore, aiScore: res.aiScore });
    setResult(res);
    setStats({
      student_id: stats.student_id, rating: res.ratingAfter, wins: res.wins, losses: res.losses, draws: res.draws,
      current_streak: res.currentStreak, best_win_streak: res.bestWinStreak, battles_played: stats.battles_played + 1,
      last_battle_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    getBattleHistory(10).then(setHistory).catch(() => {});
    refreshInvitationsAndActive();
    setPhase("results");
  }

  async function handleLeaveBattle() {
    if (battleId && battleKind === "ai") {
      await cancelBattle(battleId);
      track("battle_cancelled", { battleId });
    }
    resetToSetup();
  }

  const showInvitationsPanel = phase === "setup";

  return (
    <AppShell
      title="Olympiad Battle"
      subtitle={
        phase === "battle" ? `${battleKind === "pvp" ? `vs ${opponentName}` : "vs AI"} · ${selSubject} · ${selDifficulty}`
        : phase === "waiting" ? "Waiting for your opponent"
        : "Battle an AI opponent or challenge a friend"
      }
    >
      <div className="max-w-[760px] mx-auto px-4 sm:px-7 py-6 pb-10 flex flex-col gap-5">
        {showInvitationsPanel && (
          <BattleInvitationsPanel
            received={received}
            sent={sent}
            activeBattles={activeBattles}
            respondingId={respondingId}
            onAccept={handleAcceptInvite}
            onReject={handleRejectInvite}
            onCancelSent={handleCancelSent}
            onPlayBattle={handlePlayPvpBattle}
          />
        )}

        {phase === "setup" && (
          <>
            <div className="flex gap-2 p-1 rounded-[var(--r-md)]" style={{ background: "var(--fill-100)" }}>
              <button
                onClick={() => setSetupMode("ai")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[var(--r-sm)] text-[13.5px] font-semibold cursor-pointer transition-colors"
                )}
                style={{
                  background: setupMode === "ai" ? "var(--surface)" : "transparent",
                  color: setupMode === "ai" ? "var(--ink-900)" : "var(--fg-muted)",
                  boxShadow: setupMode === "ai" ? "var(--shadow-sm)" : "none",
                }}
              >
                <Bot size={15} /> Battle AI
              </button>
              <button
                onClick={() => setSetupMode("friend")}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[var(--r-sm)] text-[13.5px] font-semibold cursor-pointer transition-colors"
                style={{
                  background: setupMode === "friend" ? "var(--surface)" : "transparent",
                  color: setupMode === "friend" ? "var(--ink-900)" : "var(--fg-muted)",
                  boxShadow: setupMode === "friend" ? "var(--shadow-sm)" : "none",
                }}
              >
                <Users size={15} /> Challenge a Friend
              </button>
            </div>

            {setupMode === "ai" ? (
              <BattleSetupForm
                subjects={subjects}
                selSubject={selSubject} onSubjectChange={setSelSubject}
                selDifficulty={selDifficulty} onDifficultyChange={setSelDifficulty}
                selCount={selCount} onCountChange={setSelCount}
                allowedCounts={allowedQuestionCounts}
                stats={stats}
                error={error}
                onStart={handleStart}
              />
            ) : (
              <ChallengeFriendForm
                key={inviteKey}
                subjects={subjects}
                selSubject={selSubject} onSubjectChange={setSelSubject}
                selDifficulty={selDifficulty} onDifficultyChange={setSelDifficulty}
                selCount={selCount} onCountChange={setSelCount}
                allowedCounts={allowedQuestionCounts}
                error={inviteError}
                sending={inviteSending}
                onSend={handleSendInvite}
              />
            )}

            <BattleHistoryList history={history} />
            {history.length > 0 && (
              <Link href="/battle/history" className="text-[13px] font-medium text-center hover:underline" style={{ color: "var(--brand)" }}>
                View full battle history →
              </Link>
            )}
          </>
        )}

        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 size={32} className="animate-spin" style={{ color: "var(--brand)" }} />
            <p className="text-[14px]" style={{ color: "var(--fg-muted)" }}>
              {battleId ? "Tallying the results…" : `Finding you a ${selDifficulty.toLowerCase()} opponent…`}
            </p>
          </div>
        )}

        {phase === "battle" && questions[idx] && (
          <>
            {battleKind === "ai" && (
              <div className="flex justify-end">
                <button
                  onClick={handleLeaveBattle}
                  className="text-[12px] underline cursor-pointer"
                  style={{ color: "var(--fg-muted)" }}
                >
                  Leave battle
                </button>
              </div>
            )}
            <BattleQuestionCard
              key={questions[idx].battleQuestionId}
              question={questions[idx]}
              index={idx}
              total={questions.length}
              timeLimitSeconds={timeLimitSeconds}
              onSubmit={handleQuestionSubmit}
            />
          </>
        )}

        {phase === "waiting" && (
          <OACard style={{ padding: "32px 24px", textAlign: "center" }}>
            <Hourglass size={32} style={{ color: "var(--fg-muted)", margin: "0 auto 14px" }} />
            <h2 className="font-bold text-[19px] mb-2" style={{ fontFamily: "var(--font-display)" }}>
              You&apos;re in! Waiting for {opponentName} to finish their battle.
            </h2>
            <p className="text-[13.5px] mb-5" style={{ color: "var(--fg-muted)" }}>
              We&apos;ll show your results here as soon as they submit their answers.
            </p>
            <OAButton variant="secondary" size="md" onClick={resetToSetup}>Back to Battle</OAButton>
          </OACard>
        )}

        {phase === "results" && result && (
          <BattleResultScreen result={result} subject={selSubject} onBattleAgain={resetToSetup} opponentLabel={opponentName} />
        )}
      </div>
    </AppShell>
  );
}
