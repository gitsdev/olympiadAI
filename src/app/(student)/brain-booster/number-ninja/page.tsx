"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, RotateCcw, Zap } from "lucide-react";
import { AppShell } from "@/components/layout";
import { OACard, OAButton, OABadge } from "@/components/ui";
import { cn } from "@/lib/utils";

type Difficulty = "Easy" | "Medium" | "Hard";
const GRID_SIZE: Record<Difficulty, number> = { Easy: 16, Medium: 25, Hard: 36 };
const BEST_TIME_KEY = "oa-number-ninja-best";

type GameState = "idle" | "playing" | "done";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(2) + "s";
}

export default function NumberNinjaPage() {
  const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
  const [state, setState] = useState<GameState>("idle");
  const [tiles, setTiles] = useState<number[]>([]);
  const [next, setNext] = useState(1);
  const [misses, setMisses] = useState(0);
  const [wrongTile, setWrongTile] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [bestTimes, setBestTimes] = useState<Partial<Record<Difficulty, number>>>({});

  const startRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BEST_TIME_KEY);
      if (raw) setBestTimes(JSON.parse(raw));
    } catch { /* ignore corrupt storage */ }
  }, []);

  useEffect(() => {
    if (state !== "playing") return;
    const tick = () => {
      setElapsedMs(performance.now() - startRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [state]);

  function startGame() {
    const n = GRID_SIZE[difficulty];
    setTiles(shuffle(Array.from({ length: n }, (_, i) => i + 1)));
    setNext(1);
    setMisses(0);
    setElapsedMs(0);
    setState("playing");
    startRef.current = performance.now();
  }

  function handleTileClick(value: number) {
    if (state !== "playing") return;
    if (value !== next) {
      setMisses((m) => m + 1);
      setWrongTile(value);
      setTimeout(() => setWrongTile(null), 250);
      return;
    }
    const n = GRID_SIZE[difficulty];
    if (next === n) {
      const finalMs = performance.now() - startRef.current;
      setElapsedMs(finalMs);
      setState("done");
      setBestTimes((prev) => {
        const current = prev[difficulty];
        const updated = current === undefined || finalMs < current
          ? { ...prev, [difficulty]: finalMs }
          : prev;
        try { localStorage.setItem(BEST_TIME_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
        return updated;
      });
    } else {
      setNext((v) => v + 1);
    }
  }

  const gridCols = difficulty === "Easy" ? 4 : difficulty === "Medium" ? 5 : 6;
  const isNewBest = state === "done" && bestTimes[difficulty] === elapsedMs;

  return (
    <AppShell title="Number Ninja" subtitle="Slice the numbers in order, as fast as you can">
      <div className="max-w-[640px] mx-auto px-4 sm:px-7 py-6 pb-10">
        <Link
          href="/brain-booster"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium mb-5 transition-colors hover:text-[var(--cobalt-700)]"
          style={{ color: "var(--fg-muted)" }}
        >
          <ArrowLeft size={14} />
          Back to Brain Booster
        </Link>

        {state === "idle" && (
          <OACard className="flex flex-col items-center text-center gap-4 py-10">
            <div className="text-[44px]">🥷</div>
            <div>
              <h2
                className="font-bold text-[18px] tracking-tight mb-1.5"
                style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}
              >
                Ready to slice?
              </h2>
              <p className="text-[13px] leading-[1.5] max-w-[380px]" style={{ color: "var(--fg-muted)" }}>
                Tap the numbers 1 through {GRID_SIZE[difficulty]}, in order, as quickly as you can. Wrong taps
                don&apos;t cost time — but they will cost you bragging rights.
              </p>
            </div>

            <div className="flex items-center gap-2 mt-1">
              {(Object.keys(GRID_SIZE) as Difficulty[]).map((d) => (
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

            {bestTimes[difficulty] !== undefined && (
              <div className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--gold-700)" }}>
                <Trophy size={14} />
                Best: {formatTime(bestTimes[difficulty]!)}
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
              <OABadge tone="cobalt">Next: {next}</OABadge>
              <div className="flex items-center gap-3">
                {misses > 0 && <OABadge tone="red">{misses} miss{misses === 1 ? "" : "es"}</OABadge>}
                <span
                  className="text-[15px] font-bold tabular-nums"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--ink-900)" }}
                >
                  {formatTime(elapsedMs)}
                </span>
              </div>
            </div>

            <div
              className="grid gap-2.5"
              style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
            >
              {tiles.map((value) => {
                const sliced = value < next;
                return (
                  <button
                    key={value}
                    onClick={() => handleTileClick(value)}
                    disabled={sliced}
                    className={cn(
                      "aspect-square rounded-[var(--r-md)] font-bold text-[16px] transition-all duration-150 cursor-pointer",
                      "flex items-center justify-center border select-none",
                      sliced
                        ? "opacity-0 pointer-events-none scale-75"
                        : wrongTile === value
                        ? "bg-[var(--danger-bg)] border-[var(--danger)] text-[var(--danger-tx)] scale-95"
                        : "bg-[var(--surface)] border-[var(--line-300)] text-[var(--ink-900)] hover:border-[var(--cobalt-300)] hover:bg-[var(--cobalt-50)] active:scale-90"
                    )}
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {state === "done" && (
          <OACard className="flex flex-col items-center text-center gap-4 py-10">
            <div className="text-[44px]">{isNewBest ? "🏆" : "✅"}</div>
            <div>
              <h2
                className="font-bold text-[18px] tracking-tight mb-1.5"
                style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}
              >
                {isNewBest ? "New best time!" : "Sliced!"}
              </h2>
              <p className="text-[24px] font-bold tabular-nums mb-1" style={{ fontFamily: "var(--font-mono)", color: "var(--cobalt-600)" }}>
                {formatTime(elapsedMs)}
              </p>
              <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
                {difficulty} · {misses} miss{misses === 1 ? "" : "es"}
                {!isNewBest && bestTimes[difficulty] !== undefined && (
                  <> · Best: {formatTime(bestTimes[difficulty]!)}</>
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
      </div>
    </AppShell>
  );
}
