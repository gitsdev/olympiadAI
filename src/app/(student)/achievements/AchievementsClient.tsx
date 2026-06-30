"use client";

import { Flame, Target, Zap, Trophy, Route, Crown, Star, Award, TrendingUp, Lock } from "lucide-react";
import { AppShell } from "@/components/layout";
import { OACard, OAAvatar } from "@/components/ui";
import { useStudent } from "@/contexts/StudentContext";

const BADGE_CATALOG = [
  { key: "streak_7",    Icon: Flame,  name: "Week warrior",      desc: "7 day streak",          tone: "gold"   },
  { key: "streak_14",   Icon: Flame,  name: "Two-week streak",   desc: "14 day streak",         tone: "gold"   },
  { key: "accuracy_90", Icon: Target, name: "Sharpshooter",      desc: "90%+ accuracy",         tone: "cobalt" },
  { key: "speed_20",    Icon: Zap,    name: "Speed demon",       desc: "20 quick solves",       tone: "cobalt" },
  { key: "first_test",  Icon: Trophy, name: "Olympiad finisher", desc: "Complete a test",       tone: "gold"   },
  { key: "path_master", Icon: Route,  name: "Path master",       desc: "Finish a learning path",tone: "cobalt" },
  { key: "top_class",   Icon: Crown,  name: "Top of the class",  desc: "Reach #1 in batch",    tone: "gold"   },
  { key: "perfect_100", Icon: Award,  name: "Perfect ten",       desc: "Score 100% on a test", tone: "cobalt" },
];

interface Props {
  earnedKeys: string[];
  totalPoints: number;
  streakDays: number;
}

export default function AchievementsClient({ earnedKeys, totalPoints, streakDays }: Props) {
  const user = useStudent();
  const earnedCount = earnedKeys.length;
  const level = Math.max(1, Math.floor(totalPoints / 500) + 1);

  const LEADERBOARD = [
    { rank: 1, name: "Ishaan M.",  pts: Math.max(totalPoints + 210, 4820), you: false },
    { rank: 2, name: user.name,    pts: totalPoints,                         you: true  },
    { rank: 3, name: "Diya K.",    pts: Math.max(totalPoints - 230, 0),     you: false },
    { rank: 4, name: "Rohan P.",   pts: Math.max(totalPoints - 660, 0),     you: false },
    { rank: 5, name: "Ananya R.",  pts: Math.max(totalPoints - 890, 0),     you: false },
  ].sort((a, b) => b.pts - a.pts).map((p, i) => ({ ...p, rank: i + 1 }));

  return (
    <AppShell title="Achievements" subtitle="Points, badges & your batch leaderboard">
      <div className="px-7 py-6 pb-10 flex flex-col gap-5">
        {/* Hero stats */}
        <div className="grid grid-cols-3 gap-3.5">
          <StatHero Icon={Zap}   bg="var(--cobalt-50)"  tone="var(--brand)"    value={totalPoints.toLocaleString()} label="Total points"  note={`Level ${level} · Scholar`} />
          <StatHero Icon={Flame} bg="var(--gold-50)"    tone="var(--gold-700)" value={String(streakDays)}           label="Day streak"    note={streakDays > 0 ? "Keep it going!" : "Start today"} />
          <StatHero Icon={Award} bg="var(--success-bg)" tone="var(--success)"  value={`${earnedCount} / ${BADGE_CATALOG.length}`} label="Badges earned" note={`${BADGE_CATALOG.length - earnedCount} more to unlock`} />
        </div>

        <div className="grid grid-cols-[1fr_300px] gap-5 items-start">
          {/* Badges */}
          <OACard style={{ padding: "18px 20px" }}>
            <h3 className="font-bold text-[18px] mb-1" style={{ fontFamily: "var(--font-display)" }}>Badges</h3>
            <p className="text-[12.5px] mb-5" style={{ color: "var(--fg-muted)" }}>
              Earned by consistency and improvement — not just answers.
            </p>
            <div className="grid grid-cols-4 gap-3.5">
              {BADGE_CATALOG.map((b) => {
                const earned = earnedKeys.includes(b.key);
                return (
                  <div key={b.key} className="text-center" style={{ opacity: earned ? 1 : 0.55 }}>
                    <div
                      className="w-[60px] h-[60px] mx-auto mb-2.5 rounded-full flex items-center justify-center"
                      style={{
                        background: earned
                          ? b.tone === "gold" ? "var(--gold-400)" : "var(--cobalt-500)"
                          : "var(--fill-200)",
                        boxShadow: earned ? "var(--shadow-md)" : "none",
                        border: earned ? "none" : "2px dashed var(--line-300)",
                      }}
                    >
                      {earned
                        ? <b.Icon size={26} style={{ color: b.tone === "gold" ? "var(--ink-900)" : "#fff" }} />
                        : <Lock size={22} style={{ color: "var(--fg-subtle)" }} />}
                    </div>
                    <p className="text-[12.5px] font-semibold leading-snug" style={{ color: "var(--ink-900)" }}>{b.name}</p>
                    {b.desc && <p className="text-[11px] mt-0.5" style={{ color: "var(--fg-muted)" }}>{b.desc}</p>}
                  </div>
                );
              })}
            </div>
          </OACard>

          {/* Leaderboard */}
          <OACard style={{ padding: "18px 20px" }}>
            <div className="flex items-center gap-2 mb-3.5">
              <Crown size={18} style={{ color: "var(--gold-500)" }} />
              <h3 className="font-bold text-[17px]" style={{ fontFamily: "var(--font-display)" }}>Class {user.cls} batch</h3>
            </div>
            <div className="flex flex-col gap-1">
              {LEADERBOARD.map((p) => (
                <div
                  key={p.rank}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--r-md)] border"
                  style={{
                    background: p.you ? "var(--cobalt-50)" : "transparent",
                    borderColor: p.you ? "var(--cobalt-200)" : "transparent",
                  }}
                >
                  <span
                    className="w-[22px] text-center font-bold text-[14px]"
                    style={{ fontFamily: "var(--font-mono)", color: p.rank <= 3 ? "var(--gold-700)" : "var(--fg-muted)" }}
                  >
                    {p.rank}
                  </span>
                  <OAAvatar name={p.name} size={30} tone={p.rank === 1 ? "gold" : "cobalt"} />
                  <span className="flex-1 text-[13.5px]" style={{ fontWeight: p.you ? 700 : 500, color: "var(--ink-900)" }}>
                    {p.you ? "You" : p.name}
                  </span>
                  <span className="font-semibold text-[12.5px]" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-700)" }}>
                    {p.pts.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {totalPoints > 0 && (
              <div className="mt-3.5 flex items-center gap-2 px-3 py-[11px] rounded-[var(--r-md)]" style={{ background: "var(--gold-50)" }}>
                <TrendingUp size={16} style={{ color: "var(--gold-700)" }} />
                <span className="text-[12.5px]" style={{ color: "var(--ink-700)" }}>
                  Just <b style={{ fontFamily: "var(--font-mono)" }}>{(LEADERBOARD[0].pts - totalPoints).toLocaleString()}</b> points from #1.
                </span>
              </div>
            )}
          </OACard>
        </div>
      </div>
    </AppShell>
  );
}

function StatHero({ Icon, bg, tone, value, label, note }: {
  Icon: React.ElementType; bg: string; tone: string; value: string; label: string; note: string;
}) {
  return (
    <OACard style={{ padding: "18px 20px" }}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-[var(--r-md)] shrink-0 flex items-center justify-center" style={{ background: bg }}>
          <Icon size={24} style={{ color: tone }} />
        </div>
        <div>
          <p className="font-bold text-[28px] leading-none tracking-tight" style={{ fontFamily: "var(--font-mono)", letterSpacing: "-0.03em", color: "var(--ink-900)" }}>{value}</p>
          <p className="t-overline mt-1.5">{label}</p>
        </div>
      </div>
      <p className="text-[12.5px] mt-3" style={{ color: "var(--fg-muted)" }}>{note}</p>
    </OACard>
  );
}
