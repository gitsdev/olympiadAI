"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { asStudent, asBattleQuestions, asBattleParticipants, asBattle, asBattleAnswers } from "@/lib/supabase/types-helper";
import {
  getBattleConfig, getOrCreateStudentBattleStats, getOrCreateStudentBattleStatsAsService, getRecentBattles,
} from "@/lib/battle/battle-data";
import {
  scoreBattleAnswers, determineResult, computeRatingDelta, applyRatingFloor,
  simulateAiOpponent, evaluateBattleAchievements, type ScorableAnswer,
} from "@/lib/battle/battle";
import type { GeneratedQuestion } from "@/lib/questions/generate";
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
      rating_after: ratingAfter, rating_delta: ratingDelta, result, finished_at: new Date().toISOString(),
    }).eq("id", humanParticipant.id),
    supabase.from("battle_participants").update({
      score: aiScore, correct_count: aiCorrectCount, incorrect_count: battleQuestions.length - aiCorrectCount,
      total_time_seconds: aiTotalTime, result: aiResult, finished_at: new Date().toISOString(),
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

  const newAchievementKeys = await grantNewAchievements(supabase, student.id, candidateKeys);

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

/** Inserts any of `candidateKeys` the student doesn't already have; returns the newly-granted ones. */
async function grantNewAchievements(
  client: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createServiceClient>,
  studentId: string,
  candidateKeys: string[]
): Promise<string[]> {
  if (candidateKeys.length === 0) return [];
  const { data: existingBadges } = await client
    .from("achievements").select("badge_key").eq("student_id", studentId).in("badge_key", candidateKeys);
  const existingSet = new Set((existingBadges ?? []).map((b) => b.badge_key as string));
  const newKeys = candidateKeys.filter((k) => !existingSet.has(k));
  if (newKeys.length > 0) {
    await client.from("achievements").insert(newKeys.map((k) => ({ student_id: studentId, badge_key: k })));
  }
  return newKeys;
}

/* ── PvP submit (async friend battle) ────────────────────────────────── */

export interface PvpWaitingResult {
  waiting: true;
  battleId: string;
}

/**
 * Submits my answers for a friend (pvp_private) battle. My own writes go
 * through the RLS-respecting client (own-row policies from
 * 009_battle_invitations.sql). If the opponent hasn't finished yet, this
 * returns { waiting: true } and the battle stays active. If they already
 * finished, this finalizes the battle for both sides — that cross-participant
 * part (the opponent's row, battles, both students' stats/achievements) goes
 * through the service client, the trust boundary here, not RLS, exactly like
 * admin writes elsewhere.
 */
export async function submitPvpBattleAnswers(
  battleId: string,
  answers: FinishAiBattleAnswerInput[]
): Promise<{ error: string } | PvpWaitingResult | BattleResultPayload> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: rawStudent } = await supabase.from("students").select("id").eq("profile_id", user.id).single();
  const student = asStudent(rawStudent);
  if (!student) return { error: "Student profile not found" };

  const { data: rawBattle } = await supabase.from("battles").select("*").eq("id", battleId).single();
  const battle = asBattle(rawBattle);
  if (!battle || battle.mode !== "pvp_private") return { error: "Battle not found" };
  if (battle.status !== "active") return { error: "Battle already finished" };

  const { data: rawQuestions } = await supabase
    .from("battle_questions").select("*").eq("battle_id", battleId).order("order_index", { ascending: true });
  const battleQuestions = asBattleQuestions(rawQuestions);

  const { data: rawParticipants } = await supabase.from("battle_participants").select("*").eq("battle_id", battleId);
  const participants = asBattleParticipants(rawParticipants);
  const me = participants.find((p) => p.student_id === student.id);
  const opponent = participants.find((p) => p.student_id !== student.id);
  if (!me || !opponent || battleQuestions.length === 0) return { error: "Battle is incomplete" };
  if (me.finished_at) return { error: "You've already submitted your answers for this battle." };

  const config = await getBattleConfig();
  const answersByQuestion = new Map(answers.map((a) => [a.battleQuestionId, a]));

  const myRaw = battleQuestions.map((q) => {
    const a = answersByQuestion.get(q.id);
    const selectedOptionIndex = a?.selectedOptionIndex ?? null;
    return {
      selectedOptionIndex,
      isCorrect: selectedOptionIndex !== null && selectedOptionIndex === q.correct_option_index,
      timeTakenSeconds: a?.timeTakenSeconds ?? q.time_limit_seconds,
    };
  });
  const myScorable: ScorableAnswer[] = myRaw.map((a, i) => ({
    isCorrect: a.isCorrect, timeTakenSeconds: a.timeTakenSeconds, timeLimitSeconds: battleQuestions[i].time_limit_seconds,
  }));
  const myPoints = scoreBattleAnswers(config.scoring, myScorable);
  const myScore = myPoints.reduce((s, p) => s + p, 0);
  const myCorrectCount = myRaw.filter((a) => a.isCorrect).length;
  const myIncorrectCount = myRaw.filter((a) => !a.isCorrect && a.selectedOptionIndex !== null).length;
  const myTimeoutCount = myRaw.filter((a) => a.selectedOptionIndex === null).length;
  const myTotalTime = Math.round(myRaw.reduce((s, a) => s + a.timeTakenSeconds, 0));

  await Promise.all([
    supabase.from("battle_answers").insert(
      battleQuestions.map((q, i) => ({
        battle_id: battleId, battle_question_id: q.id, participant_id: me.id,
        selected_option_index: myRaw[i].selectedOptionIndex, is_correct: myRaw[i].isCorrect,
        time_taken_seconds: myRaw[i].timeTakenSeconds, points_awarded: myPoints[i],
      }))
    ),
    supabase.from("battle_participants").update({
      score: myScore, correct_count: myCorrectCount, incorrect_count: myIncorrectCount,
      timeout_count: myTimeoutCount, total_time_seconds: myTotalTime, finished_at: new Date().toISOString(),
    }).eq("id", me.id),
  ]);

  if (!opponent.finished_at) {
    revalidatePath("/battle");
    return { waiting: true, battleId };
  }

  const service = createServiceClient();
  const result = determineResult(myScore, opponent.score);
  const opponentResult: BattleOutcome = result === "draw" ? "draw" : result === "win" ? "loss" : "win";

  const [myStats, opponentStats] = await Promise.all([
    getOrCreateStudentBattleStatsAsService(service, student.id),
    getOrCreateStudentBattleStatsAsService(service, opponent.student_id as string),
  ]);

  const myRatingBefore = me.rating_before ?? myStats.rating;
  const opponentRatingBefore = opponent.rating_before ?? opponentStats.rating;
  const myRatingDelta = computeRatingDelta(config.rating, myRatingBefore, opponentRatingBefore, result, myStats.battles_played);
  const myRatingAfter = applyRatingFloor(config.rating, myRatingBefore, myRatingDelta);
  const opponentRatingDelta = computeRatingDelta(config.rating, opponentRatingBefore, myRatingBefore, opponentResult, opponentStats.battles_played);
  const opponentRatingAfter = applyRatingFloor(config.rating, opponentRatingBefore, opponentRatingDelta);

  const myCurrentStreak = result === "win" ? myStats.current_streak + 1 : 0;
  const myBestWinStreak = Math.max(myStats.best_win_streak, myCurrentStreak);
  const myWins = myStats.wins + (result === "win" ? 1 : 0);
  const myLosses = myStats.losses + (result === "loss" ? 1 : 0);
  const myDraws = myStats.draws + (result === "draw" ? 1 : 0);
  const myBattlesPlayed = myStats.battles_played + 1;

  const opponentCurrentStreak = opponentResult === "win" ? opponentStats.current_streak + 1 : 0;
  const opponentBestWinStreak = Math.max(opponentStats.best_win_streak, opponentCurrentStreak);
  const opponentWins = opponentStats.wins + (opponentResult === "win" ? 1 : 0);
  const opponentLosses = opponentStats.losses + (opponentResult === "loss" ? 1 : 0);
  const opponentDraws = opponentStats.draws + (opponentResult === "draw" ? 1 : 0);
  const opponentBattlesPlayed = opponentStats.battles_played + 1;

  const winnerParticipantId = result === "draw" ? null : result === "win" ? me.id : opponent.id;

  await Promise.all([
    service.from("battles").update({
      status: "completed", completed_at: new Date().toISOString(), winner_participant_id: winnerParticipantId,
    }).eq("id", battleId),
    service.from("battle_participants").update({
      result, rating_after: myRatingAfter, rating_delta: myRatingDelta,
    }).eq("id", me.id),
    service.from("battle_participants").update({
      result: opponentResult, rating_after: opponentRatingAfter, rating_delta: opponentRatingDelta,
    }).eq("id", opponent.id),
    service.from("student_battle_stats").update({
      rating: myRatingAfter, wins: myWins, losses: myLosses, draws: myDraws,
      current_streak: myCurrentStreak, best_win_streak: myBestWinStreak,
      battles_played: myBattlesPlayed, last_battle_at: new Date().toISOString(),
    }).eq("student_id", student.id),
    service.from("student_battle_stats").update({
      rating: opponentRatingAfter, wins: opponentWins, losses: opponentLosses, draws: opponentDraws,
      current_streak: opponentCurrentStreak, best_win_streak: opponentBestWinStreak,
      battles_played: opponentBattlesPlayed, last_battle_at: new Date().toISOString(),
    }).eq("student_id", opponent.student_id as string),
  ]);

  const { data: rawOpponentAnswers } = await service
    .from("battle_answers").select("*").eq("battle_id", battleId).eq("participant_id", opponent.id);
  const opponentAnswersByQuestion = new Map(asBattleAnswers(rawOpponentAnswers).map((a) => [a.battle_question_id, a]));

  const weakTopics = [...new Set(
    battleQuestions.filter((q, i) => !myRaw[i].isCorrect && q.topic_name).map((q) => q.topic_name as string)
  )];

  const myCandidateKeys = evaluateBattleAchievements(config.achievements, {
    outcome: result, studentCorrectCount: myCorrectCount, totalQuestions: battleQuestions.length,
    winsAfter: myWins, currentStreakAfter: myCurrentStreak, battlesPlayedAfter: myBattlesPlayed,
    ratingBefore: myRatingBefore, ratingAfter: myRatingAfter,
  });
  const opponentCandidateKeys = evaluateBattleAchievements(config.achievements, {
    outcome: opponentResult, studentCorrectCount: opponent.correct_count, totalQuestions: battleQuestions.length,
    winsAfter: opponentWins, currentStreakAfter: opponentCurrentStreak, battlesPlayedAfter: opponentBattlesPlayed,
    ratingBefore: opponentRatingBefore, ratingAfter: opponentRatingAfter,
  });

  const newAchievementKeys = await grantNewAchievements(service, student.id, myCandidateKeys);
  if (opponent.student_id) await grantNewAchievements(service, opponent.student_id, opponentCandidateKeys);

  revalidatePath("/battle");
  revalidatePath("/dashboard");
  revalidatePath("/achievements");

  const questions: BattleQuestionResult[] = battleQuestions.map((q, i) => {
    const oppAns = opponentAnswersByQuestion.get(q.id);
    return {
      battleQuestionId: q.id,
      questionText: q.question_text,
      options: [...q.options].sort((a, b) => a.index - b.index).map((o) => o.text),
      correctOptionIndex: q.correct_option_index,
      topicName: q.topic_name,
      studentSelectedIndex: myRaw[i].selectedOptionIndex,
      studentCorrect: myRaw[i].isCorrect,
      aiSelectedIndex: oppAns?.selected_option_index ?? -1,
      aiCorrect: oppAns?.is_correct ?? false,
    };
  });

  return {
    battleId, result, studentScore: myScore, aiScore: opponent.score,
    ratingBefore: myRatingBefore, ratingAfter: myRatingAfter, ratingDelta: myRatingDelta,
    currentStreak: myCurrentStreak, bestWinStreak: myBestWinStreak,
    wins: myWins, losses: myLosses, draws: myDraws, weakTopics, newAchievementKeys, questions,
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
