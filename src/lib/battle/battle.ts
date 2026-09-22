/**
 * Pure, client-safe Olympiad Battle logic: scoring, rating (Elo-like), and
 * the deterministic AI-opponent simulation. No Supabase imports here —
 * mirrors the pure-vs-data-access split in src/lib/blog.ts / blog-data.ts.
 */
import type { Difficulty } from "@/types/database";

export interface TimerConfig {
  seconds_by_difficulty: Record<Difficulty, number>;
  default_question_count: number;
  allowed_question_counts: number[];
}

export interface ScoringConfig {
  points_correct: number;
  points_incorrect: number;
  time_bonus_max: number;
  streak_bonus_per_correct: number;
  streak_bonus_min_run: number;
  max_streak_bonus: number;
}

export interface RatingConfig {
  starting_rating: number;
  k_factor_provisional: number;
  k_factor_established: number;
  provisional_games: number;
  floor: number;
  ai_effective_rating_by_difficulty: Record<Difficulty, number>;
}

export interface AiDifficultyProfile {
  accuracy: number;
  avg_answer_seconds: number;
  stddev_seconds: number;
}
export type AiDifficultyConfig = Record<Difficulty, AiDifficultyProfile>;

export interface AchievementsConfig {
  first_win_key: string;
  perfect_score_key: string;
  win_streak_keys: Record<string, string>;
  rating_keys: Record<string, string>;
  veteran_keys: Record<string, string>;
}

export interface BattleConfigBundle {
  timer: TimerConfig;
  scoring: ScoringConfig;
  rating: RatingConfig;
  ai_difficulty: AiDifficultyConfig;
  achievements: AchievementsConfig;
}

/** Mirrors the seed rows in supabase/migrations/006_battle_schema.sql exactly. */
export const BATTLE_CONFIG_DEFAULTS: BattleConfigBundle = {
  timer: {
    seconds_by_difficulty: { Easy: 30, Medium: 45, Hard: 60, HOTS: 90, Adaptive: 45 },
    default_question_count: 10,
    allowed_question_counts: [5, 10, 15],
  },
  scoring: {
    points_correct: 100,
    points_incorrect: 0,
    time_bonus_max: 50,
    streak_bonus_per_correct: 10,
    streak_bonus_min_run: 3,
    max_streak_bonus: 50,
  },
  rating: {
    starting_rating: 1000,
    k_factor_provisional: 40,
    k_factor_established: 20,
    provisional_games: 10,
    floor: 100,
    ai_effective_rating_by_difficulty: { Easy: 900, Medium: 1000, Hard: 1150, HOTS: 1300, Adaptive: 1050 },
  },
  ai_difficulty: {
    Easy: { accuracy: 0.55, avg_answer_seconds: 16, stddev_seconds: 6 },
    Medium: { accuracy: 0.65, avg_answer_seconds: 20, stddev_seconds: 7 },
    Hard: { accuracy: 0.75, avg_answer_seconds: 26, stddev_seconds: 9 },
    HOTS: { accuracy: 0.7, avg_answer_seconds: 40, stddev_seconds: 14 },
    Adaptive: { accuracy: 0.65, avg_answer_seconds: 22, stddev_seconds: 8 },
  },
  achievements: {
    first_win_key: "battle_first_win",
    perfect_score_key: "battle_perfect_score",
    win_streak_keys: { "3": "battle_win_streak_3", "5": "battle_win_streak_5", "10": "battle_win_streak_10" },
    rating_keys: { "1200": "battle_rating_1200", "1400": "battle_rating_1400" },
    veteran_keys: { "10": "battle_veteran_10", "50": "battle_veteran_50" },
  },
};

export type BattleOutcome = "win" | "loss" | "draw";

/* ── Scoring ──────────────────────────────────────────────────────────── */

export function computeTimeBonus(scoring: ScoringConfig, timeLimitSeconds: number, timeTakenSeconds: number): number {
  if (timeLimitSeconds <= 0) return 0;
  const frac = Math.max(0, (timeLimitSeconds - timeTakenSeconds) / timeLimitSeconds);
  return Math.round(scoring.time_bonus_max * frac);
}

export interface ScorableAnswer {
  isCorrect: boolean;
  timeTakenSeconds: number;
  timeLimitSeconds: number;
}

/**
 * Points per answer, in order, including the linear time-decay bonus and a
 * within-battle consecutive-correct streak bonus capped cumulatively for
 * the whole battle. Used identically for the human and the simulated AI —
 * fairness by construction, not a special-cased bonus for either side.
 */
export function scoreBattleAnswers(scoring: ScoringConfig, answers: ScorableAnswer[]): number[] {
  let consecutiveCorrect = 0;
  let cumulativeStreakBonus = 0;
  return answers.map((a) => {
    if (!a.isCorrect) {
      consecutiveCorrect = 0;
      return scoring.points_incorrect;
    }
    consecutiveCorrect += 1;
    let points = scoring.points_correct + computeTimeBonus(scoring, a.timeLimitSeconds, a.timeTakenSeconds);
    if (consecutiveCorrect >= scoring.streak_bonus_min_run && cumulativeStreakBonus < scoring.max_streak_bonus) {
      const bonus = Math.min(scoring.streak_bonus_per_correct, scoring.max_streak_bonus - cumulativeStreakBonus);
      points += bonus;
      cumulativeStreakBonus += bonus;
    }
    return points;
  });
}

export function determineResult(scoreSelf: number, scoreOpponent: number): BattleOutcome {
  if (scoreSelf > scoreOpponent) return "win";
  if (scoreSelf < scoreOpponent) return "loss";
  return "draw";
}

/* ── Rating (Elo-like) ────────────────────────────────────────────────── */

export function expectedScore(ratingSelf: number, ratingOpponent: number): number {
  return 1 / (1 + Math.pow(10, (ratingOpponent - ratingSelf) / 400));
}

export function kFactorFor(rating: RatingConfig, battlesPlayed: number): number {
  return battlesPlayed < rating.provisional_games ? rating.k_factor_provisional : rating.k_factor_established;
}

export function computeRatingDelta(
  rating: RatingConfig,
  ratingBefore: number,
  opponentRating: number,
  outcome: BattleOutcome,
  battlesPlayed: number
): number {
  const expected = expectedScore(ratingBefore, opponentRating);
  const actual = outcome === "win" ? 1 : outcome === "draw" ? 0.5 : 0;
  const k = kFactorFor(rating, battlesPlayed);
  return Math.round(k * (actual - expected));
}

export function applyRatingFloor(rating: RatingConfig, ratingBefore: number, delta: number): number {
  return Math.max(rating.floor, ratingBefore + delta);
}

/* ── Achievements ─────────────────────────────────────────────────────── */

export interface AchievementContext {
  outcome: BattleOutcome;
  studentCorrectCount: number;
  totalQuestions: number;
  winsAfter: number;
  currentStreakAfter: number;
  battlesPlayedAfter: number;
  ratingBefore: number;
  ratingAfter: number;
}

/** Badge keys newly qualified for by this battle (caller filters out ones already earned). */
export function evaluateBattleAchievements(cfg: AchievementsConfig, ctx: AchievementContext): string[] {
  const keys: string[] = [];
  if (ctx.outcome === "win" && ctx.winsAfter === 1) keys.push(cfg.first_win_key);
  if (ctx.totalQuestions > 0 && ctx.studentCorrectCount === ctx.totalQuestions) keys.push(cfg.perfect_score_key);
  for (const [threshold, key] of Object.entries(cfg.win_streak_keys)) {
    if (ctx.currentStreakAfter === Number(threshold)) keys.push(key);
  }
  for (const [threshold, key] of Object.entries(cfg.rating_keys)) {
    const t = Number(threshold);
    if (ctx.ratingBefore < t && ctx.ratingAfter >= t) keys.push(key);
  }
  for (const [threshold, key] of Object.entries(cfg.veteran_keys)) {
    if (ctx.battlesPlayedAfter === Number(threshold)) keys.push(key);
  }
  return keys;
}

/* ── Deterministic AI-opponent simulation ────────────────────────────────
   Computed once, in full, at battle-completion time (see src/actions/battle.ts
   finishAiBattle) — not streamed live per-question. Seeded from the battle id
   so the same battle always reproduces the same AI answers (useful for the
   admin detail view re-rendering a completed battle). No Math.random(). */

function hashStringToSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function boxMullerSample(rand: () => number, mean: number, stddev: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * stddev;
}

export interface AiSimQuestion {
  id: string;
  correctOptionIndex: number;
  optionCount: number;
  timeLimitSeconds: number;
}

export interface SimulatedAnswer {
  battleQuestionId: string;
  isCorrect: boolean;
  selectedOptionIndex: number;
  timeTakenSeconds: number;
}

export function simulateAiOpponent(
  battleId: string,
  difficulty: Difficulty,
  questions: AiSimQuestion[],
  aiDifficulty: AiDifficultyConfig
): SimulatedAnswer[] {
  const profile = aiDifficulty[difficulty];
  const rand = mulberry32(hashStringToSeed(battleId));
  return questions.map((q) => {
    const isCorrect = rand() < profile.accuracy;
    const rawTime = boxMullerSample(rand, profile.avg_answer_seconds, profile.stddev_seconds);
    const timeTakenSeconds = Math.min(q.timeLimitSeconds, Math.max(2, Math.round(rawTime)));
    const optionCount = Math.max(2, q.optionCount);
    const wrongOffset = 1 + Math.floor(rand() * (optionCount - 1));
    const selectedOptionIndex = isCorrect
      ? q.correctOptionIndex
      : (q.correctOptionIndex + wrongOffset) % optionCount;
    return { battleQuestionId: q.id, isCorrect, selectedOptionIndex, timeTakenSeconds };
  });
}
