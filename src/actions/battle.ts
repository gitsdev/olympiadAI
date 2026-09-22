"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { asStudent, asBattleQuestions, asBattleParticipants, asBattle } from "@/lib/supabase/types-helper";
import { getBattleConfig, getOrCreateStudentBattleStats, getRecentBattles } from "@/lib/battle/battle-data";
import {
  scoreBattleAnswers, determineResult, computeRatingDelta, applyRatingFloor,
  simulateAiOpponent, evaluateBattleAchievements, type ScorableAnswer,
} from "@/lib/battle/battle";
import type { GeneratedQuestion } from "@/app/api/questions/route";
import type { Board, Subject, Difficulty, BattleQuestionOption, BattleOutcome } from "@/types/database";

/* ── Start ────────────────────────────────────────────────────────────── */

interface StartAiBattleInput {
  subject: Subject;
  difficulty: Difficulty;
  classLevel: number;
  board: Board;
  questions: GeneratedQuestion[];
}

export interface StartAiBattleQuestion {
  battleQuestionId: string;
  questionText: string;
  options: string[];
  topicName: string | null;
  timeLimitSeconds: number;
}

export async function startAiBattle(input: StartAiBattleInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: rawStudent } = await supabase.from("students").select("id").eq("profile_id", user.id).single();
  const student = asStudent(rawStudent);
  if (!student) return { error: "Student profile not found" };
  if (input.questions.length === 0) return { error: "No questions to battle with" };

  const config = await getBattleConfig();
  const stats = await getOrCreateStudentBattleStats(student.id);
  const timeLimitSeconds = config.timer.seconds_by_difficulty[input.difficulty] ?? config.timer.seconds_by_difficulty.Medium;

  const { data: rawBattle, error: battleErr } = await supabase
    .from("battles")
    .insert({
      mode: "ai",
      status: "active",
      subject: input.subject,
      class_level: input.classLevel,
      board: input.board,
      difficulty: input.difficulty,
      question_count: input.questions.length,
      time_per_question_seconds: timeLimitSeconds,
      created_by: student.id,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  const battle = asBattle(rawBattle);
  if (battleErr || !battle) return { error: battleErr?.message ?? "Could not start battle" };

  const { error: participantsErr } = await supabase.from("battle_participants").insert([
    { battle_id: battle.id, student_id: student.id, is_ai: false, rating_before: stats.rating },
    { battle_id: battle.id, student_id: null, is_ai: true, ai_difficulty_key: input.difficulty },
  ]);
  if (participantsErr) return { error: participantsErr.message };

  const questionRows = input.questions.map((q, i) => ({
    battle_id: battle.id,
    order_index: i,
    question_text: q.question_text,
    options: q.options.map((text, index): BattleQuestionOption => ({ index, text })),
    correct_option_index: q.correct_answer_index,
    explanation: q.explanation,
    topic_name: q.topic_name,
    difficulty: q.difficulty,
    time_limit_seconds: timeLimitSeconds,
  }));

  const { data: rawQuestions, error: questionsErr } = await supabase
    .from("battle_questions")
    .insert(questionRows)
    .select("*")
    .order("order_index", { ascending: true });
  const battleQuestions = asBattleQuestions(rawQuestions);
  if (questionsErr || battleQuestions.length === 0) {
    return { error: questionsErr?.message ?? "Could not create battle questions" };
  }

  const questions: StartAiBattleQuestion[] = battleQuestions.map((q) => ({
    battleQuestionId: q.id,
    questionText: q.question_text,
    options: [...q.options].sort((a, b) => a.index - b.index).map((o) => o.text),
    topicName: q.topic_name,
    timeLimitSeconds: q.time_limit_seconds,
  }));

  return { battleId: battle.id, timeLimitSeconds, questions };
}

/* ── Finish ───────────────────────────────────────────────────────────── */

interface FinishAiBattleAnswerInput {
  battleQuestionId: string;
  selectedOptionIndex: number | null;
  timeTakenSeconds: number;
}

export interface BattleQuestionResult {
  battleQuestionId: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  topicName: string | null;
  studentSelectedIndex: number | null;
  studentCorrect: boolean;
  aiSelectedIndex: number;
  aiCorrect: boolean;
}

export interface BattleResultPayload {
  battleId: string;
  result: BattleOutcome;
  studentScore: number;
  aiScore: number;
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  currentStreak: number;
  bestWinStreak: number;
  wins: number;
  losses: number;
  draws: number;
  weakTopics: string[];
  newAchievementKeys: string[];
  questions: BattleQuestionResult[];
}

export async function finishAiBattle(
  battleId: string,
  answers: FinishAiBattleAnswerInput[]
): Promise<{ error: string } | BattleResultPayload> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: rawStudent } = await supabase.from("students").select("id").eq("profile_id", user.id).single();
  const student = asStudent(rawStudent);
  if (!student) return { error: "Student profile not found" };

  const { data: rawBattle } = await supabase.from("battles").select("*").eq("id", battleId).single();
  const battle = asBattle(rawBattle);
  if (!battle || battle.created_by !== student.id) return { error: "Battle not found" };
  if (battle.status !== "active") return { error: "Battle already finished" };

  const { data: rawQuestions } = await supabase
    .from("battle_questions").select("*").eq("battle_id", battleId).order("order_index", { ascending: true });
  const battleQuestions = asBattleQuestions(rawQuestions);

  const { data: rawParticipants } = await supabase.from("battle_participants").select("*").eq("battle_id", battleId);
  const participants = asBattleParticipants(rawParticipants);
  const humanParticipant = participants.find((p) => !p.is_ai);
  const aiParticipant = participants.find((p) => p.is_ai);
  if (!humanParticipant || !aiParticipant || battleQuestions.length === 0) return { error: "Battle is incomplete" };

  const config = await getBattleConfig();
  const answersByQuestion = new Map(answers.map((a) => [a.battleQuestionId, a]));

  const humanRaw = battleQuestions.map((q) => {
    const a = answersByQuestion.get(q.id);
    const selectedOptionIndex = a?.selectedOptionIndex ?? null;
    return {
      selectedOptionIndex,
      isCorrect: selectedOptionIndex !== null && selectedOptionIndex === q.correct_option_index,
      timeTakenSeconds: a?.timeTakenSeconds ?? q.time_limit_seconds,
    };
  });
  const humanScorable: ScorableAnswer[] = humanRaw.map((a, i) => ({
    isCorrect: a.isCorrect, timeTakenSeconds: a.timeTakenSeconds, timeLimitSeconds: battleQuestions[i].time_limit_seconds,
  }));
  const humanPoints = scoreBattleAnswers(config.scoring, humanScorable);
  const studentScore = humanPoints.reduce((s, p) => s + p, 0);
  const studentCorrectCount = humanRaw.filter((a) => a.isCorrect).length;
  const studentIncorrectCount = humanRaw.filter((a) => !a.isCorrect && a.selectedOptionIndex !== null).length;
  const studentTimeoutCount = humanRaw.filter((a) => a.selectedOptionIndex === null).length;
  const studentTotalTime = Math.round(humanRaw.reduce((s, a) => s + a.timeTakenSeconds, 0));

  const simulated = simulateAiOpponent(
    battleId,
    battle.difficulty,
    battleQuestions.map((q) => ({
      id: q.id, correctOptionIndex: q.correct_option_index, optionCount: q.options.length, timeLimitSeconds: q.time_limit_seconds,
    })),
    config.ai_difficulty
  );
  const aiScorable: ScorableAnswer[] = simulated.map((a, i) => ({
    isCorrect: a.isCorrect, timeTakenSeconds: a.timeTakenSeconds, timeLimitSeconds: battleQuestions[i].time_limit_seconds,
  }));
  const aiPoints = scoreBattleAnswers(config.scoring, aiScorable);
  const aiScore = aiPoints.reduce((s, p) => s + p, 0);
  const aiCorrectCount = simulated.filter((a) => a.isCorrect).length;
  const aiTotalTime = Math.round(simulated.reduce((s, a) => s + a.timeTakenSeconds, 0));

  const result = determineResult(studentScore, aiScore);
  const aiResult: BattleOutcome = result === "draw" ? "draw" : result === "win" ? "loss" : "win";

  const statsBefore = await getOrCreateStudentBattleStats(student.id);
  const ratingBefore = humanParticipant.rating_before ?? statsBefore.rating;
  const opponentRating = config.rating.ai_effective_rating_by_difficulty[battle.difficulty];
  const ratingDelta = computeRatingDelta(config.rating, ratingBefore, opponentRating, result, statsBefore.battles_played);
  const ratingAfter = applyRatingFloor(config.rating, ratingBefore, ratingDelta);

  const currentStreak = result === "win" ? statsBefore.current_streak + 1 : 0;
  const bestWinStreak = Math.max(statsBefore.best_win_streak, currentStreak);
  const wins = statsBefore.wins + (result === "win" ? 1 : 0);
  const losses = statsBefore.losses + (result === "loss" ? 1 : 0);
  const draws = statsBefore.draws + (result === "draw" ? 1 : 0);
  const battlesPlayed = statsBefore.battles_played + 1;

  const winnerParticipantId = result === "draw" ? null : result === "win" ? humanParticipant.id : aiParticipant.id;

  await Promise.all([
    supabase.from("battles").update({
      status: "completed", completed_at: new Date().toISOString(), winner_participant_id: winnerParticipantId,
    }).eq("id", battleId),
    supabase.from("battle_participants").update({
      score: studentScore, correct_count: studentCorrectCount, incorrect_count: studentIncorrectCount,
      timeout_count: studentTimeoutCount, total_time_seconds: studentTotalTime,
      rating_after: ratingAfter, rating_delta: ratingDelta, result,
    }).eq("id", humanParticipant.id),
    supabase.from("battle_participants").update({
      score: aiScore, correct_count: aiCorrectCount, incorrect_count: battleQuestions.length - aiCorrectCount,
      total_time_seconds: aiTotalTime, result: aiResult,
    }).eq("id", aiParticipant.id),
    supabase.from("student_battle_stats").update({
      rating: ratingAfter, wins, losses, draws, current_streak: currentStreak, best_win_streak: bestWinStreak,
      battles_played: battlesPlayed, last_battle_at: new Date().toISOString(),
    }).eq("student_id", student.id),
    supabase.from("battle_answers").insert([
      ...battleQuestions.map((q, i) => ({
        battle_id: battleId, battle_question_id: q.id, participant_id: humanParticipant.id,
        selected_option_index: humanRaw[i].selectedOptionIndex, is_correct: humanRaw[i].isCorrect,
        time_taken_seconds: humanRaw[i].timeTakenSeconds, points_awarded: humanPoints[i],
      })),
      ...battleQuestions.map((q, i) => ({
        battle_id: battleId, battle_question_id: q.id, participant_id: aiParticipant.id,
        selected_option_index: simulated[i].selectedOptionIndex, is_correct: simulated[i].isCorrect,
        time_taken_seconds: simulated[i].timeTakenSeconds, points_awarded: aiPoints[i],
      })),
    ]),
  ]);

  const weakTopics = [...new Set(
    battleQuestions
      .filter((q, i) => !humanRaw[i].isCorrect && q.topic_name)
      .map((q) => q.topic_name as string)
  )];

  const candidateKeys = evaluateBattleAchievements(config.achievements, {
    outcome: result,
    studentCorrectCount,
    totalQuestions: battleQuestions.length,
    winsAfter: wins,
    currentStreakAfter: currentStreak,
    battlesPlayedAfter: battlesPlayed,
    ratingBefore,
    ratingAfter,
  });

  let newAchievementKeys: string[] = [];
  if (candidateKeys.length > 0) {
    const { data: existingBadges } = await supabase
      .from("achievements").select("badge_key").eq("student_id", student.id).in("badge_key", candidateKeys);
    const existingSet = new Set((existingBadges ?? []).map((b) => b.badge_key as string));
    newAchievementKeys = candidateKeys.filter((k) => !existingSet.has(k));
    if (newAchievementKeys.length > 0) {
      await supabase.from("achievements").insert(newAchievementKeys.map((k) => ({ student_id: student.id, badge_key: k })));
    }
  }

  revalidatePath("/battle");
  revalidatePath("/dashboard");
  revalidatePath("/achievements");

  const questions: BattleQuestionResult[] = battleQuestions.map((q, i) => ({
    battleQuestionId: q.id,
    questionText: q.question_text,
    options: [...q.options].sort((a, b) => a.index - b.index).map((o) => o.text),
    correctOptionIndex: q.correct_option_index,
    topicName: q.topic_name,
    studentSelectedIndex: humanRaw[i].selectedOptionIndex,
    studentCorrect: humanRaw[i].isCorrect,
    aiSelectedIndex: simulated[i].selectedOptionIndex,
    aiCorrect: simulated[i].isCorrect,
  }));

  return {
    battleId, result, studentScore, aiScore, ratingBefore, ratingAfter, ratingDelta,
    currentStreak, bestWinStreak, wins, losses, draws, weakTopics, newAchievementKeys, questions,
  };
}

/* ── Cancel ───────────────────────────────────────────────────────────── */

export async function cancelBattle(battleId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("battles")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", battleId)
    .eq("status", "active");

  if (error) return { error: error.message };
  revalidatePath("/battle");
  return { ok: true };
}

/* ── History ──────────────────────────────────────────────────────────── */

export async function getBattleHistory(limit = 10) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rawStudent } = await supabase.from("students").select("id").eq("profile_id", user.id).single();
  const student = asStudent(rawStudent);
  if (!student) return [];

  return getRecentBattles(student.id, limit);
}
