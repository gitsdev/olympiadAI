"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  asStudent, asBattle, asBattleQuestions, asBattleInvitation, asBattleInvitations,
} from "@/lib/supabase/types-helper";
import { generateQuestions } from "@/lib/questions/generate";
import {
  getBattleConfig, getOrCreateStudentBattleStatsAsService, getActiveBattles, type ActiveBattleItem,
} from "@/lib/battle/battle-data";
import { BATTLE_CONFIG_DEFAULTS } from "@/lib/battle/battle";
import type { StartAiBattleQuestion } from "@/actions/battle";
import type {
  Board, Subject, Difficulty, BattleQuestionOption, BattleInvitationStatus,
} from "@/types/database";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ── Send ─────────────────────────────────────────────────────────────── */

interface SendInvitationInput {
  inviteeEmail: string;
  subject: Subject;
  difficulty: Difficulty;
  classLevel: number;
  board: Board;
  questionCount: number;
}

export async function sendBattleInvitation(input: SendInvitationInput): Promise<{ error: string } | { invitationId: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: rawStudent } = await supabase.from("students").select("id").eq("profile_id", user.id).single();
  const student = asStudent(rawStudent);
  if (!student) return { error: "Student profile not found" };

  const inviteeEmail = input.inviteeEmail.trim().toLowerCase();
  if (!inviteeEmail || !EMAIL_RE.test(inviteeEmail)) return { error: "Enter a valid email address." };
  if (inviteeEmail === (user.email ?? "").toLowerCase()) {
    return { error: "You can't challenge yourself — invite a friend instead." };
  }

  const { data: invitation, error: insertErr } = await supabase
    .from("battle_invitations")
    .insert({
      inviter_student_id: student.id,
      invitee_email: inviteeEmail,
      subject: input.subject,
      difficulty: input.difficulty,
      class_level: input.classLevel,
      board: input.board,
      question_count: input.questionCount,
    })
    .select("id")
    .single();
  if (insertErr || !invitation) return { error: insertErr?.message ?? "Could not create invitation" };

  // Magic link works whether the invitee already has an OlympiadIQ account or
  // not (shouldCreateUser: true creates one on the fly) — same underlying
  // Supabase Auth email service as password reset (src/actions/auth.ts
  // requestPasswordReset), no new dependency. The email body is Supabase's
  // default "Magic Link" template copy (customizable only in the Supabase
  // dashboard, not here); the actual "so-and-so challenged you" context
  // appears once the invitee lands on /battle.
  const { error: emailErr } = await supabase.auth.signInWithOtp({
    email: inviteeEmail,
    options: { shouldCreateUser: true, emailRedirectTo: `${SITE_URL}/auth/confirm?next=/battle` },
  });
  // Don't fail the action over an email hiccup — the invitation row already
  // exists and will show up for the invitee once they're on OlympiadIQ
  // regardless of whether this particular email arrives.
  if (emailErr) console.error("[sendBattleInvitation] magic link email failed:", emailErr.message);

  revalidatePath("/battle");
  return { invitationId: invitation.id as string };
}

/* ── List ─────────────────────────────────────────────────────────────── */

export interface ReceivedInvitation {
  id: string;
  subject: Subject;
  difficulty: Difficulty;
  questionCount: number;
  createdAt: string;
  expiresAt: string;
  inviterName: string;
  inviterRating: number;
}

export interface SentInvitation {
  id: string;
  status: BattleInvitationStatus;
  subject: Subject;
  difficulty: Difficulty;
  inviteeEmail: string;
  createdAt: string;
}

export async function getMyBattleInvitations(): Promise<{ received: ReceivedInvitation[]; sent: SentInvitation[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { received: [], sent: [] };

  const { data: rawStudent } = await supabase.from("students").select("id").eq("profile_id", user.id).single();
  const student = asStudent(rawStudent);
  if (!student) return { received: [], sent: [] };

  const [receivedRes, sentRes] = await Promise.all([
    supabase
      .from("battle_invitations")
      .select("*")
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    supabase
      .from("battle_invitations")
      .select("*")
      .eq("inviter_student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const received = asBattleInvitations(receivedRes.data);
  const sent = asBattleInvitations(sentRes.data);

  // Cross-user lookup (inviter's name/rating) — not readable under the
  // invitee's own RLS session, so this narrow read goes via the service
  // client. Restricted to inviters of invitations RLS already confirmed are
  // addressed to me.
  const inviterIds = [...new Set(received.map((r) => r.inviter_student_id))];
  const inviterInfo = new Map<string, { name: string; rating: number }>();
  if (inviterIds.length > 0) {
    const service = createServiceClient();
    const { data: inviters } = await service
      .from("students")
      .select("id, profile:profiles(full_name), stats:student_battle_stats(rating)")
      .in("id", inviterIds);
    for (const row of (inviters ?? []) as unknown as Array<{ id: string; profile: { full_name: string } | null; stats: { rating: number } | null }>) {
      inviterInfo.set(row.id, {
        name: row.profile?.full_name ?? "A friend",
        rating: row.stats?.rating ?? BATTLE_CONFIG_DEFAULTS.rating.starting_rating,
      });
    }
  }

  return {
    received: received.map((r) => ({
      id: r.id, subject: r.subject, difficulty: r.difficulty, questionCount: r.question_count,
      createdAt: r.created_at, expiresAt: r.expires_at,
      inviterName: inviterInfo.get(r.inviter_student_id)?.name ?? "A friend",
      inviterRating: inviterInfo.get(r.inviter_student_id)?.rating ?? BATTLE_CONFIG_DEFAULTS.rating.starting_rating,
    })),
    sent: sent.map((s) => ({
      id: s.id, status: s.status, subject: s.subject, difficulty: s.difficulty,
      inviteeEmail: s.invitee_email, createdAt: s.created_at,
    })),
  };
}

/** Thin "use server" wrapper around the server-only getActiveBattles() data-access
 * function, for BattleClient to re-fetch after an accept/submit without a full page reload. */
export async function getMyActiveBattles(): Promise<ActiveBattleItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rawStudent } = await supabase.from("students").select("id").eq("profile_id", user.id).single();
  const student = asStudent(rawStudent);
  if (!student) return [];

  return getActiveBattles(student.id);
}

/* ── Respond ──────────────────────────────────────────────────────────── */

export async function declineBattleInvitation(invitationId: string): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("battle_invitations")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("status", "pending");
  if (error) return { error: error.message };

  revalidatePath("/battle");
  return { ok: true };
}

export async function cancelBattleInvitation(invitationId: string): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("battle_invitations")
    .update({ status: "cancelled" })
    .eq("id", invitationId)
    .eq("status", "pending");
  if (error) return { error: error.message };

  revalidatePath("/battle");
  return { ok: true };
}

/** Privileged multi-party write (creates the battle + both sides' participant
 * rows — one belongs to the inviter, not the caller) — the service client is
 * the trust boundary here, not RLS, same as admin writes elsewhere. */
export async function acceptBattleInvitation(invitationId: string): Promise<{ error: string } | { battleId: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: rawStudent } = await supabase.from("students").select("id").eq("profile_id", user.id).single();
  const student = asStudent(rawStudent);
  if (!student) return { error: "Student profile not found" };

  const { data: rawInvitation } = await supabase.from("battle_invitations").select("*").eq("id", invitationId).single();
  const invitation = asBattleInvitation(rawInvitation);
  if (!invitation) return { error: "Invitation not found" };
  if (invitation.status !== "pending") return { error: "This invitation is no longer pending." };
  if (new Date(invitation.expires_at) < new Date()) return { error: "This invitation has expired." };
  if (invitation.invitee_email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return { error: "This invitation isn't addressed to you." };
  }

  const service = createServiceClient();

  let questions;
  try {
    questions = await generateQuestions({
      subject: invitation.subject,
      topicName: invitation.subject,
      difficulty: invitation.difficulty,
      count: invitation.question_count,
      classLevel: invitation.class_level,
      board: invitation.board,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not generate battle questions." };
  }
  if (questions.length === 0) return { error: "Could not generate battle questions." };

  const config = await getBattleConfig();
  const timeLimitSeconds = config.timer.seconds_by_difficulty[invitation.difficulty] ?? config.timer.seconds_by_difficulty.Medium;

  const [inviterStats, inviteeStats] = await Promise.all([
    getOrCreateStudentBattleStatsAsService(service, invitation.inviter_student_id),
    getOrCreateStudentBattleStatsAsService(service, student.id),
  ]);

  const { data: rawBattle, error: battleErr } = await service
    .from("battles")
    .insert({
      mode: "pvp_private", status: "active", subject: invitation.subject, class_level: invitation.class_level,
      board: invitation.board, difficulty: invitation.difficulty, question_count: questions.length,
      time_per_question_seconds: timeLimitSeconds, created_by: invitation.inviter_student_id,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  const battle = asBattle(rawBattle);
  if (battleErr || !battle) return { error: battleErr?.message ?? "Could not create battle" };

  const { error: participantsErr } = await service.from("battle_participants").insert([
    { battle_id: battle.id, student_id: invitation.inviter_student_id, is_ai: false, rating_before: inviterStats.rating },
    { battle_id: battle.id, student_id: student.id, is_ai: false, rating_before: inviteeStats.rating },
  ]);
  if (participantsErr) return { error: participantsErr.message };

  const questionRows = questions.map((q, i) => ({
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
  const { error: questionsErr } = await service.from("battle_questions").insert(questionRows);
  if (questionsErr) return { error: questionsErr.message };

  await service.from("battle_invitations").update({
    status: "accepted", battle_id: battle.id, invitee_student_id: student.id, responded_at: new Date().toISOString(),
  }).eq("id", invitationId);

  revalidatePath("/battle");
  return { battleId: battle.id as string };
}

/* ── Play an already-accepted battle ─────────────────────────────────── */

export interface BattleForPlay {
  battleId: string;
  timeLimitSeconds: number;
  subject: Subject;
  questions: StartAiBattleQuestion[];
  opponentName: string;
}

export async function getBattleForPlay(battleId: string): Promise<{ error: string } | BattleForPlay> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: rawStudent } = await supabase.from("students").select("id").eq("profile_id", user.id).single();
  const student = asStudent(rawStudent);
  if (!student) return { error: "Student profile not found" };

  const { data: rawBattle } = await supabase.from("battles").select("*").eq("id", battleId).single();
  const battle = asBattle(rawBattle);
  if (!battle || battle.status !== "active" || battle.mode !== "pvp_private") {
    return { error: "Battle not found or already finished." };
  }

  const { data: rawParticipants } = await supabase
    .from("battle_participants")
    .select("*, student:students(profile:profiles(full_name))")
    .eq("battle_id", battleId);
  type ParticipantWithName = { student_id: string | null; finished_at: string | null; student: { profile: { full_name: string } | null } | null };
  const participants = (rawParticipants ?? []) as unknown as ParticipantWithName[];
  const me = participants.find((p) => p.student_id === student.id);
  const opponent = participants.find((p) => p.student_id !== student.id);
  if (!me) return { error: "You're not a participant in this battle." };
  if (me.finished_at) return { error: "You've already submitted your answers for this battle." };

  const { data: rawQuestions } = await supabase
    .from("battle_questions").select("*").eq("battle_id", battleId).order("order_index", { ascending: true });
  const battleQuestions = asBattleQuestions(rawQuestions);

  const questions: StartAiBattleQuestion[] = battleQuestions.map((q) => ({
    battleQuestionId: q.id,
    questionText: q.question_text,
    options: [...q.options].sort((a, b) => a.index - b.index).map((o) => o.text),
    topicName: q.topic_name,
    timeLimitSeconds: q.time_limit_seconds,
  }));

  return {
    battleId: battle.id,
    timeLimitSeconds: battle.time_per_question_seconds,
    subject: battle.subject,
    questions,
    opponentName: opponent?.student?.profile?.full_name ?? "your friend",
  };
}
