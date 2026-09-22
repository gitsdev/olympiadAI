"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout";
import { type Subject } from "@/components/ui";
import { useStudent } from "@/contexts/StudentContext";
import { track } from "@/lib/analytics";
import {
  startAiBattle, finishAiBattle, cancelBattle, getBattleHistory,
  type StartAiBattleQuestion, type BattleResultPayload,
} from "@/actions/battle";
import type { BattleHistoryItem } from "@/lib/battle/battle-data";
import type { Board, Difficulty, StudentBattleStatsRow } from "@/types/database";
import { BattleSetupForm } from "@/components/battle/BattleSetupForm";
import { BattleQuestionCard } from "@/components/battle/BattleQuestionCard";
import { BattleResultScreen } from "@/components/battle/BattleResultScreen";
import { BattleHistoryList } from "@/components/battle/BattleHistoryList";

type Phase = "setup" | "loading" | "battle" | "results";

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
}

export default function BattleClient({ initialStats, initialHistory, allowedQuestionCounts, defaultQuestionCount }: BattleClientProps) {
  const user = useStudent();
  const subjects = (user.subjects.length > 0 ? user.subjects : ["Mathematics"]) as Subject[];

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
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(45);
  const [questions, setQuestions] = useState<StartAiBattleQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [result, setResult] = useState<BattleResultPayload | null>(null);

  function resetToSetup() {
    setPhase("setup");
    setBattleId(null);
    setQuestions([]);
    setIdx(0);
    setAnswers([]);
    setResult(null);
    setError("");
  }

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
    const res = await finishAiBattle(battleId, finalAnswers);
    if ("error" in res) {
      setError(res.error);
      setPhase("setup");
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
    setPhase("results");
  }

  async function handleLeaveBattle() {
    if (battleId) {
      await cancelBattle(battleId);
      track("battle_cancelled", { battleId });
    }
    resetToSetup();
  }

  return (
    <AppShell
      title="Olympiad Battle"
      subtitle={phase === "battle" ? `${selSubject} · ${selDifficulty}` : "Battle an AI opponent and sharpen what you know"}
    >
      <div className="max-w-[760px] mx-auto px-4 sm:px-7 py-6 pb-10 flex flex-col gap-5">
        {phase === "setup" && (
          <>
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
            <BattleHistoryList history={history} />
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
            <div className="flex justify-end">
              <button
                onClick={handleLeaveBattle}
                className="text-[12px] underline cursor-pointer"
                style={{ color: "var(--fg-muted)" }}
              >
                Leave battle
              </button>
            </div>
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

        {phase === "results" && result && (
          <BattleResultScreen result={result} subject={selSubject} onBattleAgain={resetToSetup} />
        )}
      </div>
    </AppShell>
  );
}
