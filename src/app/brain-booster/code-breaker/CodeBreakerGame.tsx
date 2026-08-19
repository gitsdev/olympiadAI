"use client";

import { useEffect, useState } from "react";
import { Trophy, RotateCcw, Zap, Delete, Lock } from "lucide-react";
import { OACard, OAButton, OABadge } from "@/components/ui";
import { cn } from "@/lib/utils";

type Difficulty = "Easy" | "Medium" | "Hard";
const BEST_ATTEMPTS_KEY = "oa-code-breaker-best";

interface DiffConfig {
  codeLength: number;
  colorCount: number;
  maxAttempts: number;
}

const CONFIG: Record<Difficulty, DiffConfig> = {
  Easy:   { codeLength: 3, colorCount: 4, maxAttempts: 10 },
  Medium: { codeLength: 4, colorCount: 5, maxAttempts: 10 },
  Hard:   { codeLength: 5, colorCount: 6, maxAttempts: 8 },
};

const COLORS = ["#3b5bfd", "#e0a83e", "#22a35d", "#e2483f", "#8b5cf6", "#06b6d4"];

interface Guess {
  pegs: number[];
  exact: number;
  partial: number;
}

type GameState = "idle" | "playing" | "won" | "lost";

function randomCode(codeLength: number, colorCount: number): number[] {
  return Array.from({ length: codeLength }, () => Math.floor(Math.random() * colorCount));
}

function scoreGuess(guess: number[], secret: number[]): { exact: number; partial: number } {
  let exact = 0;
  const gRem: number[] = [];
  const sRem: number[] = [];
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) exact++;
    else { gRem.push(guess[i]); sRem.push(secret[i]); }
  }
  const secretCounts = new Map<number, number>();
  for (const c of sRem) secretCounts.set(c, (secretCounts.get(c) ?? 0) + 1);
  let partial = 0;
  for (const c of gRem) {
    const remaining = secretCounts.get(c) ?? 0;
    if (remaining > 0) { partial++; secretCounts.set(c, remaining - 1); }
  }
  return { exact, partial };
}

export function CodeBreakerGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
  const [state, setState] = useState<GameState>("idle");
  const [secret, setSecret] = useState<number[]>([]);
  const [currentGuess, setCurrentGuess] = useState<number[]>([]);
  const [history, setHistory] = useState<Guess[]>([]);
  const [bestAttempts, setBestAttempts] = useState<Partial<Record<Difficulty, number>>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BEST_ATTEMPTS_KEY);
      if (raw) setBestAttempts(JSON.parse(raw));
    } catch { /* ignore corrupt storage */ }
  }, []);

  const cfg = CONFIG[difficulty];

  function startGame() {
    setSecret(randomCode(cfg.codeLength, cfg.colorCount));
    setCurrentGuess([]);
    setHistory([]);
    setState("playing");
  }

  function addPeg(colorIdx: number) {
    if (state !== "playing" || currentGuess.length >= cfg.codeLength) return;
    setCurrentGuess((g) => [...g, colorIdx]);
  }

  function removePeg(slotIdx: number) {
    if (state !== "playing") return;
    setCurrentGuess((g) => g.filter((_, i) => i !== slotIdx));
  }

  function submitGuess() {
    if (state !== "playing" || currentGuess.length !== cfg.codeLength) return;
    const { exact, partial } = scoreGuess(currentGuess, secret);
    const newHistory = [...history, { pegs: currentGuess, exact, partial }];
    setHistory(newHistory);
    setCurrentGuess([]);

    if (exact === cfg.codeLength) {
      setState("won");
      setBestAttempts((prev) => {
        const current = prev[difficulty];
        const updated = current === undefined || newHistory.length < current
          ? { ...prev, [difficulty]: newHistory.length }
          : prev;
        try { localStorage.setItem(BEST_ATTEMPTS_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
        return updated;
      });
    } else if (newHistory.length >= cfg.maxAttempts) {
      setState("lost");
    }
  }

  const isNewBest = state === "won" && bestAttempts[difficulty] === history.length;
  const attemptsLeft = cfg.maxAttempts - history.length;

  return (
    <>
      {state === "idle" && (
        <OACard className="flex flex-col items-center text-center gap-4 py-10">
          <div className="text-[44px]">🔐</div>
          <div>
            <h2
              className="font-bold text-[18px] tracking-tight mb-1.5"
              style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}
            >
              Ready to crack it?
            </h2>
            <p className="text-[13px] leading-[1.5] max-w-[380px]" style={{ color: "var(--fg-muted)" }}>
              {`A secret code is hidden behind ${cfg.codeLength} colored pegs. Guess it — after each try you'll see how many are the right color in the right spot, and how many are the right color but misplaced.`}
            </p>
          </div>

          <div className="flex items-center gap-2 mt-1">
            {(Object.keys(CONFIG) as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors cursor-pointer",
                  difficulty === d
                    ? "bg-[var(--cobalt-500)] text-white border-[var(--cobalt-500)]"
                    : "bg-[var(--surface)] text-[var(--ink-700)] border-[var(--line-300)] hover:bg-[var(--fill-100)]"
                )}
              >
                {d}
              </button>
            ))}
          </div>

          {bestAttempts[difficulty] !== undefined && (
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--gold-700)" }}>
              <Trophy size={14} />
              Best: {bestAttempts[difficulty]} guess{bestAttempts[difficulty] === 1 ? "" : "es"}
            </div>
          )}

          <OAButton size="lg" onClick={startGame} className="mt-2">
            <Zap size={17} />
            Start game
          </OAButton>
        </OACard>
      )}

      {state === "playing" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <OABadge tone="cobalt">{attemptsLeft} guess{attemptsLeft === 1 ? "" : "es"} left</OABadge>
            <span className="text-[12px] font-semibold" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>
              {difficulty}
            </span>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="flex flex-col gap-2 mb-5">
              {history.map((g, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[11px] w-4 shrink-0" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-subtle)" }}>
                    {i + 1}
                  </span>
                  <div className="flex gap-1.5">
                    {g.pegs.map((c, j) => (
                      <div
                        key={j}
                        className="w-7 h-7 rounded-full border"
                        style={{ background: COLORS[c], borderColor: "var(--line-200)" }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 ml-1">
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: g.exact }).map((_, k) => (
                        <span key={k} className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--ink-900)" }} />
                      ))}
                      {Array.from({ length: g.partial }).map((_, k) => (
                        <span key={k} className="w-2.5 h-2.5 rounded-full border" style={{ borderColor: "var(--ink-500)" }} />
                      ))}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--fg-subtle)", fontFamily: "var(--font-mono)" }}>
                      {g.exact} exact · {g.partial} close
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Current guess row */}
          <div className="flex items-center gap-1.5 mb-4">
            {Array.from({ length: cfg.codeLength }).map((_, i) => {
              const filled = currentGuess[i] !== undefined;
              return (
                <button
                  key={i}
                  onClick={() => filled && removePeg(i)}
                  disabled={!filled}
                  className="w-10 h-10 rounded-full border-2 flex items-center justify-center cursor-pointer disabled:cursor-default transition-transform hover:scale-105"
                  style={{
                    background: filled ? COLORS[currentGuess[i]] : "var(--surface)",
                    borderColor: filled ? COLORS[currentGuess[i]] : "var(--line-300)",
                    borderStyle: filled ? "solid" : "dashed",
                  }}
                />
              );
            })}
          </div>

          {/* Palette */}
          <div className="flex items-center gap-2 mb-5">
            {COLORS.slice(0, cfg.colorCount).map((c, i) => (
              <button
                key={i}
                onClick={() => addPeg(i)}
                disabled={currentGuess.length >= cfg.codeLength}
                className="w-9 h-9 rounded-full cursor-pointer transition-transform hover:scale-110 disabled:opacity-40 disabled:cursor-default disabled:hover:scale-100"
                style={{ background: c }}
              />
            ))}
            <button
              onClick={() => removePeg(currentGuess.length - 1)}
              disabled={currentGuess.length === 0}
              className="w-9 h-9 rounded-[var(--r-md)] border flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-default ml-1"
              style={{ borderColor: "var(--line-300)", background: "var(--surface)" }}
            >
              <Delete size={15} style={{ color: "var(--fg-muted)" }} />
            </button>
          </div>

          <OAButton
            size="lg"
            onClick={submitGuess}
            disabled={currentGuess.length !== cfg.codeLength}
            className="w-full sm:w-auto"
          >
            <Lock size={16} />
            Submit guess
          </OAButton>
        </>
      )}

      {(state === "won" || state === "lost") && (
        <OACard className="flex flex-col items-center text-center gap-4 py-10">
          <div className="text-[44px]">{state === "won" ? (isNewBest ? "🏆" : "🔓") : "🔒"}</div>
          <div>
            <h2
              className="font-bold text-[18px] tracking-tight mb-1.5"
              style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}
            >
              {state === "won" ? (isNewBest ? "New best!" : "Code cracked!") : "Out of guesses!"}
            </h2>

            {state === "won" ? (
              <p className="text-[24px] font-bold tabular-nums mb-1" style={{ fontFamily: "var(--font-mono)", color: "var(--cobalt-600)" }}>
                {history.length} guess{history.length === 1 ? "" : "es"}
              </p>
            ) : (
              <div className="flex items-center justify-center gap-1.5 mb-2 mt-2">
                {secret.map((c, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border" style={{ background: COLORS[c], borderColor: "var(--line-200)" }} />
                ))}
              </div>
            )}

            <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
              {difficulty}
              {state === "won" && !isNewBest && bestAttempts[difficulty] !== undefined && (
                <> · Best: {bestAttempts[difficulty]} guess{bestAttempts[difficulty] === 1 ? "" : "es"}</>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2.5 mt-1">
            <OAButton size="md" onClick={startGame}>
              <RotateCcw size={15} />
              Play again
            </OAButton>
            <OAButton size="md" variant="secondary" onClick={() => setState("idle")}>
              Change difficulty
            </OAButton>
          </div>
        </OACard>
      )}
    </>
  );
}
