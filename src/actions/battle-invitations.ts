"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  asStudent, asBattle, asBattleQuestions, asBattleInvitation, asBattleInvitations,
} from "@/lib/supabase/types-helper";
import { generateQuestions } from "@/lib/questions/generate";
import {
  getBattleConfig, getOrCreateStudentBattleStats, getOrCreateStudentBattleStatsAsService,
  getActiveBattles, type ActiveBattleItem,
} from "@/lib/battle/battle-data";
import { BATTLE_CONFIG_DEFAULTS } from "@/lib/battle/battle";
import { generateSignInLink } from "@/lib/email/auth-link";
import { sendEmail } from "@/lib/email/send";
import { buildBattleInviteEmail } from "@/lib/email/battle-invite-template";
import type { StartAiBattleQuestion } from "@/actions/battle";
import type {
  Board, Subject, Difficulty, BattleQuestionOption, BattleInvitationStatus,
} from "@/types/database";

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

export interface SendInvitationResult {
  invitationId: string;
  battleId: string;
  timeLimitSeconds: number;
  questions: StartAiBattleQuestion[];
}

/**
 * Creates the battle (and the inviter's own participant row + the shared
 * question set) immediately, so the inviter can start playing their side
 * right away rather than waiting for the invitee to accept first — the
 * invitee's participant row is added later, in acceptBattleInvitation, to
 * this SAME battle/question set.
 */
export async function sendBattleInvitation(input: SendInvitationInput): Promise<{ error: string } | SendInvitationResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: rawStudent } = await supabase.from("students").select("id").eq("profile_id", user.id).single();
  const student = asStudent(rawStudent);
  if (!student) return { error: "Student profile not found" };

  const { data: rawProfile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  const inviterName = (rawProfile as { full_name?: string } | null)?.full_name ?? "A friend";

  const inviteeEmail = input.inviteeEmail.trim().toLowerCase();
  if (!inviteeEmail || !EMAIL_RE.test(inviteeEmail)) return { error: "Enter a valid email address." };
  if (inviteeEmail === (user.email ?? "").toLowerCase()) {
    return { error: "You can't challenge yourself — invite a friend instead." };
  }

  let questions;
  try {
    questions = await generateQuestions({
      subject: input.subject, topicName: input.subject, difficulty: input.difficulty,
      count: input.questionCount, classLevel: input.classLevel, board: input.board,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not generate battle questions." };
  }
  if (questions.length === 0) return { error: "Could not generate battle questions." };

  const config = await getBattleConfig();
  const timeLimitSeconds = config.timer.seconds_by_difficulty[input.difficulty] ?? config.timer.seconds_by_difficulty.Medium;
  const stats = await getOrCreateStudentBattleStats(student.id);

  const { data: rawBattle, error: battleErr } = await supabase
    .from("battles")
    .insert({
      mode: "pvp_private", status: "active", subject: input.subject, class_level: input.classLevel,
      board: input.board, difficulty: input.difficulty, question_count: questions.length,
      time_per_question_seconds: timeLimitSeconds, created_by: student.id, started_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  const battle = asBattle(rawBattle);
  if (battleErr || !battle) return { error: battleErr?.message ?? "Could not create battle" };

  const { error: participantErr } = await supabase.from("battle_participants").insert({
    battle_id: battle.id, student_id: student.id, is_ai: false, rating_before: stats.rating,
  });
  if (participantErr) return { error: participantErr.message };

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
  const { data: rawQuestions, error: questionsErr } = await supabase
    .from("battle_questions")
    .insert(questionRows)
    .select("*")
    .order("order_index", { ascending: true });
  const battleQuestions = asBattleQuestions(rawQuestions);
  if (questionsErr || battleQuestions.length === 0) {
    return { error: questionsErr?.message ?? "Could not create battle questions" };
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
      question_count: questions.length,
      battle_id: battle.id,
    })
    .select("id")
    .single();
  if (insertErr || !invitation) return { error: insertErr?.message ?? "Could not create invitation" };

  // Send a proper branded challenge email via Brevo (not Supabase's generic
  // magic-link template copy). generateSignInLink() gets a sign-in link
  // without triggering Supabase's own email — works whether the invitee
  // already has an OlympiadIQ account or not.
  const actionUrl = await generateSignInLink(inviteeEmail, "/battle");
  if (actionUrl) {
    const email = buildBattleInviteEmail({
      inviterName, subject: input.subject, difficulty: input.difficulty,
      questionCount: questions.length, actionUrl,
    });
    const { sent, error: emailErr } = await sendEmail({ to: inviteeEmail, subject: email.subject, html: email.html, text: email.text });
    if (!sent) console.error("[sendBattleInvitation] invite email not sent:", emailErr);
  } else {
    console.error("[sendBattleInvitation] could not generate a sign-in link for", inviteeEmail);
  }
  // Don't fail the action over an email hiccup — the invitation and battle
  // already exist, and the inviter can start playing their side regardless.

  revalidatePath("/battle");

  const startQuestions: StartAiBattleQuestion[] = battleQuestions.map((q) => ({
    battleQuestionId: q.id,
    questionText: q.question_text,
    options: [...q.options].sort((a, b) => a.index - b.index).map((o) => o.text),
    topicName: q.topic_name,
    timeLimitSeconds: q.time_limit_seconds,
  }));

  return { invitationId: invitation.id as string, battleId: battle.id, timeLimitSeconds, questions: startQuestions };
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

  const { data: rawInvitation } = await supabase
    .from("battle_invitations").select("*").eq("id", invitationId).eq("status", "pending").single();
  const invitation = asBattleInvitation(rawInvitation);
  if (!invitation) return { error: "Invitation not found or already responded to." };

  const { error } = await supabase
    .from("battle_invitations")
    .update({ status: "cancelled" })
    .eq("id", invitationId)
    .eq("status", "pending");
  if (error) return { error: error.message };

  // The battle already exists (created at send time) — cancel it too, since
  // it would otherwise sit active with only the inviter's participant row
  // forever. "update own battles" (created_by = own) already permits this —
  // the inviter is always created_by, no service client needed.
  if (invitation.battle_id) {
    await supabase.from("battles").update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", invitation.battle_id).eq("status", "active");
  }

  revalidatePath("/battle");
  return { ok: true };
}

/**
 * Adds the invitee's own participant row to the battle the inviter already
 * created (at send time) — this is a privileged write (I'm inserting into a
 * battle I didn't create), so it goes through the service client, the trust
 * boundary here, not RLS, same as admin writes elsewhere.
 */
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
  if (!invitation.battle_id) return { error: "This invitation's battle could not be found." };

  const service = createServiceClient();

  const { data: rawBattle } = await service.from("battles").select("*").eq("id", invitation.battle_id).single();
  const battle = asBattle(rawBattle);
  if (!battle || battle.status !== "active") return { error: "This battle is no longer available." };

  const inviteeStats = await getOrCreateStudentBattleStatsAsService(service, student.id);

  const { error: participantErr } = await service.from("battle_participants").insert({
    battle_id: battle.id, student_id: student.id, is_ai: false, rating_before: inviteeStats.rating,
  });
  if (participantErr) return { error: participantErr.message };

  await service.from("battle_invitations").update({
    status: "accepted", invitee_student_id: student.id, responded_at: new Date().toISOString(),
  }).eq("id", invitationId);

  revalidatePath("/battle");
  return { battleId: battle.id };
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
