import { getStudentProfile } from "@/actions/student";
import { getOrCreateStudentBattleStats, getRecentBattles, getBattleConfig, getActiveBattles } from "@/lib/battle/battle-data";
import { getMyBattleInvitations } from "@/actions/battle-invitations";
import BattleClient from "./BattleClient";

export default async function BattlePage() {
  const student = await getStudentProfile();
  const [stats, history, config, invitations, activeBattles] = await Promise.all([
    getOrCreateStudentBattleStats(student.id),
    getRecentBattles(student.id, 10),
    getBattleConfig(),
    getMyBattleInvitations(),
    getActiveBattles(student.id),
  ]);

  return (
    <BattleClient
      initialStats={stats}
      initialHistory={history}
      allowedQuestionCounts={config.timer.allowed_question_counts}
      defaultQuestionCount={config.timer.default_question_count}
      initialReceivedInvitations={invitations.received}
      initialSentInvitations={invitations.sent}
      initialActiveBattles={activeBattles}
    />
  );
}
