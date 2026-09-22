import { getStudentProfile } from "@/actions/student";
import { getOrCreateStudentBattleStats, getRecentBattles, getBattleConfig } from "@/lib/battle/battle-data";
import BattleClient from "./BattleClient";

export default async function BattlePage() {
  const student = await getStudentProfile();
  const [stats, history, config] = await Promise.all([
    getOrCreateStudentBattleStats(student.id),
    getRecentBattles(student.id, 10),
    getBattleConfig(),
  ]);

  return (
    <BattleClient
      initialStats={stats}
      initialHistory={history}
      allowedQuestionCounts={config.timer.allowed_question_counts}
      defaultQuestionCount={config.timer.default_question_count}
    />
  );
}
