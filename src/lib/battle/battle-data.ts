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
  BattleRow, BattleParticipantRow, BattleStatus, BattleOutcome,
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
  subject: Subject;
  difficulty: Difficulty;
  status: BattleStatus;
  result: BattleOutcome | null;
  studentScore: number;
  opponentScore: number | null;
  ratingDelta: number | null;
  completedAt: string | null;
  createdAt: string;
}

export async function getRecentBattles(studentId: string, limit = 10): Promise<BattleHistoryItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("battles")
    .select("id, subject, difficulty, status, created_at, completed_at, battle_participants(student_id, is_ai, score, result, rating_delta)")
    .eq("created_by", studentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as Array<BattleRow & { battle_participants: BattleParticipantRow[] }>;
  return rows.map((b) => {
    const self = b.battle_participants.find((p) => p.student_id === studentId);
    const opponent = b.battle_participants.find((p) => p.is_ai || p.student_id !== studentId);
    return {
      battleId: b.id,
      subject: b.subject,
      difficulty: b.difficulty,
      status: b.status,
      result: self?.result ?? null,
      studentScore: self?.score ?? 0,
      opponentScore: opponent?.score ?? null,
      ratingDelta: self?.rating_delta ?? null,
      completedAt: b.completed_at,
      createdAt: b.created_at,
    };
  });
}
