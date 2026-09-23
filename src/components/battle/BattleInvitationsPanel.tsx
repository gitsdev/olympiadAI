"use client";

import { Swords, Check, X, Clock, Hourglass, ChevronRight } from "lucide-react";
import { OACard, OABadge, OASubjectDot } from "@/components/ui";
import type { ReceivedInvitation, SentInvitation } from "@/actions/battle-invitations";
import type { ActiveBattleItem } from "@/lib/battle/battle-data";

interface BattleInvitationsPanelProps {
  received: ReceivedInvitation[];
  sent: SentInvitation[];
  activeBattles: ActiveBattleItem[];
  respondingId: string | null;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onCancelSent: (id: string) => void;
  onPlayBattle: (battleId: string) => void;
}

const SENT_STATUS_TONE = { pending: "amber", accepted: "green", declined: "neutral", cancelled: "neutral", expired: "neutral" } as const;

export function BattleInvitationsPanel({
  received, sent, activeBattles, respondingId, onAccept, onReject, onCancelSent, onPlayBattle,
}: BattleInvitationsPanelProps) {
  const yourTurn = activeBattles.filter((b) => b.myTurn);
  const waiting = activeBattles.filter((b) => !b.myTurn);

  if (received.length === 0 && sent.length === 0 && activeBattles.length === 0) return null;

  return (
    <div className="flex flex-col gap-3.5">
      {received.length > 0 && (
        <OACard style={{ padding: "16px 20px" }}>
          <div className="flex items-center gap-1.5 mb-3">
            <Swords size={16} style={{ color: "var(--brand)" }} />
            <h3 className="font-bold text-[15px]" style={{ fontFamily: "var(--font-display)" }}>
              Battle invitation{received.length > 1 ? "s" : ""}
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            {received.map((inv) => (
              <div key={inv.id} className="flex items-center gap-2.5 flex-wrap px-3.5 py-3 rounded-[var(--r-md)]" style={{ background: "var(--paper-2)" }}>
                <OASubjectDot subject={inv.subject} size={8} />
                <span className="flex-1 text-[13.5px] min-w-[160px]" style={{ color: "var(--ink-900)" }}>
                  <b>{inv.inviterName}</b> (rating {inv.inviterRating}) challenged you — {inv.subject} · {inv.difficulty} · {inv.questionCount}Q
                </span>
                <button
                  onClick={() => onAccept(inv.id)}
                  disabled={respondingId === inv.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-md)] text-[13px] font-semibold text-white border-none cursor-pointer disabled:opacity-50"
                  style={{ background: "var(--success)" }}
                >
                  <Check size={14} /> Accept
                </button>
                <button
                  onClick={() => onReject(inv.id)}
                  disabled={respondingId === inv.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-md)] text-[13px] font-semibold border cursor-pointer disabled:opacity-50"
                  style={{ borderColor: "var(--line-300)", color: "var(--ink-700)", background: "var(--surface)" }}
                >
                  <X size={14} /> Reject
                </button>
              </div>
            ))}
          </div>
        </OACard>
      )}

      {yourTurn.length > 0 && (
        <OACard style={{ padding: "16px 20px" }}>
          <div className="flex items-center gap-1.5 mb-3">
            <Clock size={16} style={{ color: "var(--gold-700)" }} />
            <h3 className="font-bold text-[15px]" style={{ fontFamily: "var(--font-display)" }}>Your turn</h3>
          </div>
          <div className="flex flex-col gap-2">
            {yourTurn.map((b) => (
              <button
                key={b.battleId}
                onClick={() => onPlayBattle(b.battleId)}
                className="flex items-center gap-2.5 px-3.5 py-3 rounded-[var(--r-md)] w-full text-left cursor-pointer transition-colors hover:opacity-90"
                style={{ background: "var(--gold-50)" }}
              >
                <OASubjectDot subject={b.subject} size={8} />
                <span className="flex-1 text-[13.5px] font-medium" style={{ color: "var(--ink-900)" }}>
                  vs <b>{b.opponentName}</b> — {b.subject} · {b.difficulty}
                </span>
                <span className="text-[12.5px] font-semibold" style={{ color: "var(--gold-700)" }}>Play now</span>
                <ChevronRight size={15} style={{ color: "var(--gold-700)" }} />
              </button>
            ))}
          </div>
        </OACard>
      )}

      {waiting.length > 0 && (
        <OACard style={{ padding: "16px 20px" }}>
          <div className="flex items-center gap-1.5 mb-3">
            <Hourglass size={16} style={{ color: "var(--fg-muted)" }} />
            <h3 className="font-bold text-[15px]" style={{ fontFamily: "var(--font-display)" }}>Waiting on your opponent</h3>
          </div>
          <div className="flex flex-col gap-2">
            {waiting.map((b) => (
              <div key={b.battleId} className="flex items-center gap-2.5 px-3.5 py-3 rounded-[var(--r-md)]" style={{ background: "var(--paper-2)" }}>
                <OASubjectDot subject={b.subject} size={8} />
                <span className="flex-1 text-[13.5px]" style={{ color: "var(--ink-700)" }}>
                  vs <b>{b.opponentName}</b> — {b.subject} · {b.difficulty}
                </span>
                <OABadge tone="neutral">Waiting</OABadge>
              </div>
            ))}
          </div>
        </OACard>
      )}

      {sent.length > 0 && (
        <details className="rounded-[var(--r-md)] border px-3.5 py-2.5" style={{ borderColor: "var(--line-200)" }}>
          <summary className="text-[12.5px] font-semibold cursor-pointer select-none" style={{ color: "var(--fg-muted)" }}>
            Sent invites ({sent.length})
          </summary>
          <div className="flex flex-col gap-1.5 mt-2.5">
            {sent.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5">
                <span className="flex-1 text-[12.5px] truncate" style={{ color: "var(--ink-700)" }}>{s.inviteeEmail}</span>
                <OABadge tone={SENT_STATUS_TONE[s.status]}>{s.status}</OABadge>
                {s.status === "pending" && (
                  <button
                    onClick={() => onCancelSent(s.id)}
                    className="text-[11.5px] underline cursor-pointer"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
