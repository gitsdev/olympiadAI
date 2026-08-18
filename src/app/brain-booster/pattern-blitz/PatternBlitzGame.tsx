"use client";

import { useEffect, useRef, useState } from "react";
import {
  Circle, Square, Triangle, Diamond, Star, Hexagon,
  ArrowRight, Trophy, RotateCcw, Zap, Check, X,
} from "lucide-react";
import { OACard, OAButton, OABadge } from "@/components/ui";
import { cn } from "@/lib/utils";

type Difficulty = "Easy" | "Medium" | "Hard";
const BEST_SCORE_KEY = "oa-pattern-blitz-best";

interface DiffConfig {
  patternLen: number;
  shapeCount: number;
  colorCount: number;
  roundMs: number;
}

const CONFIG: Record<Difficulty, DiffConfig> = {
  Easy:   { patternLen: 2, shapeCount: 3, colorCount: 3, roundMs: 7000 },
  Medium: { patternLen: 3, shapeCount: 4, colorCount: 4, roundMs: 5000 },
  Hard:   { patternLen: 3, shapeCount: 6, colorCount: 6, roundMs: 3500 },
};

const SHAPES = [
  { key: "circle",   Icon: Circle },
  { key: "square",   Icon: Square },
  { key: "triangle", Icon: Triangle },
  { key: "diamond",  Icon: Diamond },
  { key: "star",     Icon: Star },
  { key: "hexagon",  Icon: Hexagon },
];

const COLORS = ["#3b5bfd", "#e0a83e", "#22a35d", "#e2483f", "#8b5cf6", "#06b6d4"];

interface Tile {
  shape: string;
  color: string;
}

function sameTile(a: Tile, b: Tile): boolean {
  return a.shape === b.shape && a.color === b.color;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function iconFor(shape: string) {
  return SHAPES.find((s) => s.key === shape)?.Icon ?? Circle;
}

interface Round {
  sequence: Tile[];
  options: Tile[];
  correct: Tile;
}

function generateRound(cfg: DiffConfig): Round {
  const pool: Tile[] = [];
  for (const s of SHAPES.slice(0, cfg.shapeCount)) {
    for (const c of COLORS.slice(0, cfg.colorCount)) {
      pool.push({ shape: s.key, color: c });
    }
  }
  const basePattern = shuffle(pool).slice(0, cfg.patternLen);
  const visibleLen = cfg.patternLen * 2 + 1;
  const sequence = Array.from({ length: visibleLen }, (_, i) => basePattern[i % cfg.patternLen]);
  const correct = basePattern[visibleLen % cfg.patternLen];

  const distractorPool = pool.filter((t) => !sameTile(t, correct));
  const distractors = shuffle(distractorPool).slice(0, 3);
  const options = shuffle([correct, ...distractors]);

  return { sequence, options, correct };
}

type GameState = "idle" | "playing" | "done";

export function PatternBlitzGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
  const [state, setState] = useState<GameState>("idle");
  const [round, setRound] = useState<Round | null>(null);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<Tile | null>(null);
  const [answered, setAnswered] = useState(false);
  const [remainingPct, setRemainingPct] = useState(100);
  const [bestScores, setBestScores] = useState<Partial<Record<Difficulty, number>>>({});

  const roundStartRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BEST_SCORE_KEY);
      if (raw) setBestScores(JSON.parse(raw));
    } catch { /* ignore corrupt storage */ }
  }, []);

  function clearTimers() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }

  function endGame(finalScore: number) {
    clearTimers();
    setState("done");
    setBestScores((prev) => {
      const current = prev[difficulty];
      const updated = current === undefined || finalScore > current
        ? { ...prev, [difficulty]: finalScore }
        : prev;
      try { localStorage.setItem(BEST_SCORE_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  }

  function beginRound(nextScore: number) {
    const cfg = CONFIG[difficulty];
    setRound(generateRound(cfg));
    setSelected(null);
    setAnswered(false);
    setRemainingPct(100);
    roundStartRef.current = performance.now();

    const tick = () => {
      const elapsed = performance.now() - roundStartRef.current;
      const pct = Math.max(0, 100 - (elapsed / cfg.roundMs) * 100);
      setRemainingPct(pct);
      if (elapsed >= cfg.roundMs) {
        setAnswered(true);
        endGame(nextScore);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function startGame() {
    clearTimers();
    setScore(0);
    setState("playing");
    beginRound(0);
  }

  function handleOptionClick(tile: Tile) {
    if (state !== "playing" || answered || !round) return;
    clearTimers();
    setAnswered(true);
    setSelected(tile);

    if (sameTile(tile, round.correct)) {
      const newScore = score + 1;
      setScore(newScore);
      timeoutRef.current = setTimeout(() => beginRound(newScore), 400);
    } else {
      timeoutRef.current = setTimeout(() => endGame(score), 700);
    }
  }

  useEffect(() => clearTimers, []);

  const isNewBest = state === "done" && bestScores[difficulty] === score && score > 0;

  return (
    <>
      {state === "idle" && (
        <OACard className="flex flex-col items-center text-center gap-4 py-10">
          <div className="text-[44px]">🔷</div>
          <div>
            <h2
              className="font-bold text-[18px] tracking-tight mb-1.5"
              style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}
            >
              Ready to blitz?
            </h2>
            <p className="text-[13px] leading-[1.5] max-w-[380px]" style={{ color: "var(--fg-muted)" }}>
              Watch the shape sequence, spot the pattern, and tap what comes next — before the timer runs out.
              One wrong guess or a timeout ends the run.
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

          {bestScores[difficulty] !== undefined && (
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--gold-700)" }}>
              <Trophy size={14} />
              Best: {bestScores[difficulty]} round{bestScores[difficulty] === 1 ? "" : "s"}
            </div>
          )}

          <OAButton size="lg" onClick={startGame} className="mt-2">
            <Zap size={17} />
            Start game
          </OAButton>
        </OACard>
      )}

      {state === "playing" && round && (
        <>
          <div className="flex items-center justify-between mb-3">
            <OABadge tone="cobalt">Score: {score}</OABadge>
            <span className="text-[12px] font-semibold" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>
              {difficulty}
            </span>
          </div>

          <div className="w-full overflow-hidden rounded-full mb-6" style={{ height: 7, background: "var(--fill-200)" }}>
            <div
              style={{
                height: "100%",
                width: `${remainingPct}%`,
                background: remainingPct < 30 ? "var(--danger)" : "var(--cobalt-500)",
                borderRadius: 999,
              }}
            />
          </div>

          {/* Sequence */}
          <div className="flex items-center justify-center flex-wrap gap-2 mb-8">
            {round.sequence.map((tile, i) => {
              const Icon = iconFor(tile.shape);
              return (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className="w-12 h-12 rounded-[var(--r-md)] flex items-center justify-center border"
                    style={{ background: "var(--surface)", borderColor: "var(--line-200)" }}
                  >
                    <Icon size={22} style={{ color: tile.color }} fill={tile.color} strokeWidth={1.5} />
                  </div>
                </div>
              );
            })}
            <ArrowRight size={18} style={{ color: "var(--fg-subtle)" }} />
            <div
              className="w-12 h-12 rounded-[var(--r-md)] flex items-center justify-center border-2 border-dashed"
              style={{ borderColor: "var(--cobalt-300)", color: "var(--cobalt-400)" }}
            >
              <span className="font-bold text-[18px]">?</span>
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-4 gap-3">
            {round.options.map((tile, i) => {
              const Icon = iconFor(tile.shape);
              const isSelected = selected && sameTile(selected, tile);
              const isCorrectTile = answered && sameTile(tile, round.correct);
              const isWrongSelection = answered && isSelected && !sameTile(tile, round.correct);
              return (
                <button
                  key={i}
                  onClick={() => handleOptionClick(tile)}
                  disabled={answered}
                  className={cn(
                    "aspect-square rounded-[var(--r-md)] flex items-center justify-center border-2 transition-all duration-150 cursor-pointer disabled:cursor-default",
                    isCorrectTile
                      ? "border-[var(--success)]"
                      : isWrongSelection
                      ? "border-[var(--danger)]"
                      : "border-[var(--line-300)] hover:border-[var(--cobalt-300)] hover:bg-[var(--cobalt-50)]"
                  )}
                  style={{ background: isCorrectTile ? "var(--success-bg)" : isWrongSelection ? "var(--danger-bg)" : "var(--surface)" }}
                >
                  <Icon size={28} style={{ color: tile.color }} fill={tile.color} strokeWidth={1.5} />
                  {isCorrectTile && <Check size={14} style={{ color: "var(--success)", marginLeft: 4 }} />}
                  {isWrongSelection && <X size={14} style={{ color: "var(--danger)", marginLeft: 4 }} />}
                </button>
              );
            })}
          </div>
        </>
      )}

      {state === "done" && (
        <OACard className="flex flex-col items-center text-center gap-4 py-10">
          <div className="text-[44px]">{isNewBest ? "🏆" : score > 0 ? "✅" : "⏱️"}</div>
          <div>
            <h2
              className="font-bold text-[18px] tracking-tight mb-1.5"
              style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}
            >
              {isNewBest ? "New best score!" : "Run over!"}
            </h2>
            <p className="text-[24px] font-bold tabular-nums mb-1" style={{ fontFamily: "var(--font-mono)", color: "var(--cobalt-600)" }}>
              {score} round{score === 1 ? "" : "s"}
            </p>
            <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
              {difficulty}
              {!isNewBest && bestScores[difficulty] !== undefined && (
                <> · Best: {bestScores[difficulty]} round{bestScores[difficulty] === 1 ? "" : "s"}</>
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
