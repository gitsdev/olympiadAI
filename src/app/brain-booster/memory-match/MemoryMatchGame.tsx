"use client";

import { useEffect, useRef, useState } from "react";
import { Trophy, RotateCcw, Zap, Brain } from "lucide-react";
import { OACard, OAButton, OABadge } from "@/components/ui";
import { cn } from "@/lib/utils";

type Difficulty = "Easy" | "Medium" | "Hard";
const PAIR_COUNT: Record<Difficulty, number> = { Easy: 6, Medium: 8, Hard: 12 };
const GRID_COLS: Record<Difficulty, number> = { Easy: 4, Medium: 4, Hard: 6 };
const BEST_TIME_KEY = "oa-memory-match-best";

const SYMBOLS = ["🍎", "🍌", "🍇", "🍊", "🍓", "🍉", "🥝", "🍒", "🍑", "🍍", "🥭", "🍋"];

type GameState = "idle" | "playing" | "done";

interface Card {
  id: number;
  symbol: string;
}

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

export function MemoryMatchGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
  const [state, setState] = useState<GameState>("idle");
  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [bestTimes, setBestTimes] = useState<Partial<Record<Difficulty, number>>>({});

  const startRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const resolving = flipped.length === 2;

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

  // Resolve a pair of flipped cards: match (keep revealed) or mismatch (flip back)
  useEffect(() => {
    if (flipped.length !== 2) return;
    const [a, b] = flipped;
    setMoves((m) => m + 1);

    if (cards[a].symbol === cards[b].symbol) {
      const newMatched = new Set(matched);
      newMatched.add(a);
      newMatched.add(b);
      setMatched(newMatched);
      setFlipped([]);

      if (newMatched.size === cards.length) {
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
      }
    } else {
      const timer = setTimeout(() => setFlipped([]), 700);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped]);

  function startGame() {
    const pairs = PAIR_COUNT[difficulty];
    const deck = shuffle(SYMBOLS.slice(0, pairs).flatMap((symbol, i) => [
      { id: i * 2, symbol },
      { id: i * 2 + 1, symbol },
    ]));
    setCards(deck);
    setFlipped([]);
    setMatched(new Set());
    setMoves(0);
    setElapsedMs(0);
    setState("playing");
    startRef.current = performance.now();
  }

  function handleCardClick(idx: number) {
    if (state !== "playing" || resolving) return;
    if (flipped.includes(idx) || matched.has(idx)) return;
    setFlipped((f) => [...f, idx]);
  }

  const gridCols = GRID_COLS[difficulty];
  const isNewBest = state === "done" && bestTimes[difficulty] === elapsedMs;

  return (
    <>
      {state === "idle" && (
        <OACard className="flex flex-col items-center text-center gap-4 py-10">
          <div className="text-[44px]">🧩</div>
          <div>
            <h2
              className="font-bold text-[18px] tracking-tight mb-1.5"
              style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}
            >
              Ready to match?
            </h2>
            <p className="text-[13px] leading-[1.5] max-w-[380px]" style={{ color: "var(--fg-muted)" }}>
              Flip two cards at a time and find every matching pair, in as few moves as you can.
            </p>
          </div>

          <div className="flex items-center gap-2 mt-1">
            {(Object.keys(PAIR_COUNT) as Difficulty[]).map((d) => (
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
            <OABadge tone="cobalt">{moves} move{moves === 1 ? "" : "s"}</OABadge>
            <span
              className="text-[15px] font-bold tabular-nums"
              style={{ fontFamily: "var(--font-mono)", color: "var(--ink-900)" }}
            >
              {formatTime(elapsedMs)}
            </span>
          </div>

          <div
            className="grid gap-2.5"
            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
          >
            {cards.map((card, idx) => {
              const revealed = flipped.includes(idx) || matched.has(idx);
              const isMatched = matched.has(idx);
              return (
                <div key={card.id} className="aspect-square" style={{ perspective: 600 }}>
                  <button
                    onClick={() => handleCardClick(idx)}
                    disabled={isMatched || (resolving && !revealed)}
                    className="relative w-full h-full transition-transform duration-300 cursor-pointer disabled:cursor-default"
                    style={{
                      transformStyle: "preserve-3d",
                      transform: revealed ? "rotateY(180deg)" : "rotateY(0deg)",
                    }}
                  >
                    {/* Back face */}
                    <div
                      className="absolute inset-0 flex items-center justify-center rounded-[var(--r-md)] border"
                      style={{
                        backfaceVisibility: "hidden",
                        background: "var(--cobalt-500)",
                        borderColor: "var(--cobalt-500)",
                      }}
                    >
                      <Brain size={20} color="#fff" style={{ opacity: 0.85 }} />
                    </div>
                    {/* Front face */}
                    <div
                      className="absolute inset-0 flex items-center justify-center rounded-[var(--r-md)] border text-[22px]"
                      style={{
                        backfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                        background: isMatched ? "var(--success-bg)" : "var(--surface)",
                        borderColor: isMatched ? "var(--success)" : "var(--line-300)",
                      }}
                    >
                      {card.symbol}
                    </div>
                  </button>
                </div>
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
              {isNewBest ? "New best time!" : "All matched!"}
            </h2>
            <p className="text-[24px] font-bold tabular-nums mb-1" style={{ fontFamily: "var(--font-mono)", color: "var(--cobalt-600)" }}>
              {formatTime(elapsedMs)}
            </p>
            <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
              {difficulty} · {moves} move{moves === 1 ? "" : "s"}
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
    </>
  );
}
