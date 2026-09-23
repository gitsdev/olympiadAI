/**
 * Server-only Olympiad Battle data access. Mirrors the pure-vs-data-access
 * split in src/lib/blog.ts / blog-data.ts — pure scoring/rating/AI-sim
 * logic lives in ./battle.ts.
 */
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { asBattleConfigs, asBattleStats } from "@/lib/supabase/types-helper";
import { BATTLE_CONFIG_DEFAULTS, type BattleConfigBundle } from "./battle";
import type {
  BattleRow, BattleParticipantRow, BattleStatus, BattleOutcome, BattleMode,
  StudentBattleStatsRow, Subject, Difficulty,
} from "@/types/database";

/** Configurable battle rules — never hard-code these in gameplay/actions code. */
export async function getBattleConfig(): Promise<BattleConfigBundle> {
  // battle_config has no RLS policies (service-role only), same as admin_settings.
  const service = createServiceClient();
  const { data } = await service.from("battle_config").select("*");
  const rows = asBattleConfigs(data);
  if (rows.length === 0) return BATTLE_CONFIG_DEFAULTS;

  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    timer: (byKey.get("timer") as BattleConfigBundle["timer"] | undefined) ?? BATTLE_CONFIG_DEFAULTS.timer,
    scoring: (byKey.get("scoring") as BattleConfigBundle["scoring"] | undefined) ?? BATTLE_CONFIG_DEFAULTS.scoring,
    rating: (byKey.get("rating") as BattleConfigBundle["rating"] | undefined) ?? BATTLE_CONFIG_DEFAULTS.rating,
    ai_difficulty:
      (byKey.get("ai_difficulty") as BattleConfigBundle["ai_difficulty"] | undefined) ?? BATTLE_CONFIG_DEFAULTS.ai_difficulty,
    achievements:
      (byKey.get("achievements") as BattleConfigBundle["achievements"] | undefined) ?? BATTLE_CONFIG_DEFAULTS.achievements,
  };
}

export async function getOrCreateStudentBattleStats(studentId: string): Promise<StudentBattleStatsRow> {
  const supabase = await createClient();
  const { data } = await supabase.from("student_battle_stats").select("*").eq("student_id", studentId).maybeSingle();
  const existing = asBattleStats(data);
  if (existing) return existing;

  const { data: inserted, error } = await supabase
    .from("student_battle_stats")
    .upsert({ student_id: studentId, rating: BATTLE_CONFIG_DEFAULTS.rating.starting_rating }, { onConflict: "student_id" })
    .select("*")
    .single();

  if (error || !inserted) {
    // Lost a create race — the row now exists, fetch it.
    const { data: refetched } = await supabase.from("student_battle_stats").select("*").eq("student_id", studentId).single();
    return asBattleStats(refetched)!;
  }
  return asBattleStats(inserted)!;
}

export interface BattleHistoryItem {
  battleId: string;
  mode: BattleMode;
  subject: Subject;
  difficulty: Difficulty;
  questionCount: number;
  status: BattleStatus;
  result: BattleOutcome | null;
  studentScore: number;
  opponentScore: number | null;
  opponentName: string;
  ratingDelta: number | null;
  completedAt: string | null;
  createdAt: string;
}

type BattleHistoryRaw = BattleRow & {
  battle_participants: Array<BattleParticipantRow & { student: { profile: { full_name: string } | null } | null }>;
};

function toHistoryItem(b: BattleHistoryRaw, studentId: string): BattleHistoryItem {
  const self = b.battle_participants.find((p) => p.student_id === studentId);
  const opponent = b.battle_participants.find((p) => p.is_ai || p.student_id !== studentId);
  return {
    battleId: b.id,
    mode: b.mode,
    subject: b.subject,
    difficulty: b.difficulty,
    questionCount: b.question_count,
    status: b.status,
    result: self?.result ?? null,
    studentScore: self?.score ?? 0,
    opponentScore: opponent?.score ?? null,
    opponentName: opponent?.is_ai ? "AI Opponent" : opponent?.student?.profile?.full_name ?? "Opponent",
    ratingDelta: self?.rating_delta ?? null,
    completedAt: b.completed_at,
    createdAt: b.created_at,
  };
}

const HISTORY_SELECT =
  "id, mode, subject, difficulty, question_count, status, created_at, completed_at, battle_participants(student_id, is_ai, score, result, rating_delta, student:students(profile:profiles(full_name)))";

export async function getRecentBattles(studentId: string, limit = 10): Promise<BattleHistoryItem[]> {
  const supabase = await createClient();
  // No .eq("created_by", studentId) — RLS ("own or participant battles",
  // 009_battle_invitations.sql) already scopes this to battles the student is
  // in, whether they created it (AI Battle, or the inviter of a friend
  // battle) or joined it (accepted an invite). Only completed battles here —
  // in-progress ones ("your turn" / "waiting on opponent") surface via
  // getActiveBattles() instead, so the two panels don't show the same row.
  const { data } = await supabase
    .from("battles")
    .select(HISTORY_SELECT)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as unknown as BattleHistoryRaw[];
  return rows.map((b) => toHistoryItem(b, studentId));
}

export interface BattleHistoryPage {
  items: BattleHistoryItem[];
  totalCount: number;
}

/** All completed battles for a student, paginated — backs the /battle/history page. */
export async function getBattleHistoryPage(studentId: string, page: number, pageSize = 20): Promise<BattleHistoryPage> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count } = await supabase
    .from("battles")
    .select(HISTORY_SELECT, { count: "exact" })
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .range(from, to);

  const rows = (data ?? []) as unknown as BattleHistoryRaw[];
  return { items: rows.map((b) => toHistoryItem(b, studentId)), totalCount: count ?? 0 };
}

/**
 * Same as getOrCreateStudentBattleStats, but takes an already-created
 * service client so a trusted server action (e.g. acceptBattleInvitation)
 * can fetch/create BOTH sides' stats in one privileged operation — the
 * RLS-bound version above can only ever read the current session's own row.
 */
export async function getOrCreateStudentBattleStatsAsService(
  service: ReturnType<typeof createServiceClient>,
  studentId: string
): Promise<StudentBattleStatsRow> {
  const { data } = await service.from("student_battle_stats").select("*").eq("student_id", studentId).maybeSingle();
  const existing = asBattleStats(data);
  if (existing) return existing;

  const { data: inserted, error } = await service
    .from("student_battle_stats")
    .upsert({ student_id: studentId, rating: BATTLE_CONFIG_DEFAULTS.rating.starting_rating }, { onConflict: "student_id" })
    .select("*")
    .single();

  if (error || !inserted) {
    const { data: refetched } = await service.from("student_battle_stats").select("*").eq("student_id", studentId).single();
    return asBattleStats(refetched)!;
  }
  return asBattleStats(inserted)!;
}

export interface ActiveBattleItem {
  battleId: string;
  subject: Subject;
  difficulty: Difficulty;
  opponentName: string;
  myTurn: boolean;
  createdAt: string;
}

/** Active (not yet completed) friend battles the student is a participant in — "your turn" vs "waiting on opponent". */
export async function getActiveBattles(studentId: string): Promise<ActiveBattleItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("battles")
    .select("id, subject, difficulty, created_at, battle_participants(student_id, is_ai, finished_at, student:students(profile:profiles(full_name)))")
    .eq("mode", "pvp_private")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  type Raw = {
    id: string; subject: Subject; difficulty: Difficulty; created_at: string;
    battle_participants: Array<{
      student_id: string | null; is_ai: boolean; finished_at: string | null;
      student: { profile: { full_name: string } | null } | null;
    }>;
  };
  const rows = (data ?? []) as unknown as Raw[];

  return rows.map((b) => {
    const me = b.battle_participants.find((p) => p.student_id === studentId);
    const opponent = b.battle_participants.find((p) => p.student_id !== studentId);
    return {
      battleId: b.id,
      subject: b.subject,
      difficulty: b.difficulty,
      opponentName: opponent?.student?.profile?.full_name ?? "Opponent",
      myTurn: !me?.finished_at,
      createdAt: b.created_at,
    };
  });
}
