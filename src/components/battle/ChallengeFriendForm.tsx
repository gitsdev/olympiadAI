"use client";

import { useState } from "react";
import { Check, Mail, Send } from "lucide-react";
import { OACard, OASubjectDot, type Subject } from "@/components/ui";
import type { Difficulty } from "@/types/database";

const DIFFICULTIES = ["Easy", "Medium", "Hard", "Adaptive"] as const;

interface ChallengeFriendFormProps {
  subjects: Subject[];
  selSubject: Subject;
  onSubjectChange: (s: Subject) => void;
  selDifficulty: Difficulty;
  onDifficultyChange: (d: Difficulty) => void;
  selCount: number;
  onCountChange: (c: number) => void;
  allowedCounts: number[];
  error?: string;
  sending: boolean;
  onSend: (email: string) => void;
}

export function ChallengeFriendForm({
  subjects, selSubject, onSubjectChange, selDifficulty, onDifficultyChange,
  selCount, onCountChange, allowedCounts, error, sending, onSend,
}: ChallengeFriendFormProps) {
  const [email, setEmail] = useState("");

  return (
    <div className="flex flex-col gap-5">
      <OACard style={{ padding: "20px 24px" }}>
        <p className="text-[12px] font-semibold mb-2 uppercase tracking-[0.05em]" style={{ color: "var(--fg-muted)" }}>
          Friend&apos;s email
        </p>
        <p className="text-[12.5px] mb-3" style={{ color: "var(--fg-muted)" }}>
          We&apos;ll email them the challenge — you&apos;ll start playing your side right away, no need to wait for them to accept first.
        </p>
        <div className="flex items-center gap-2 border border-[var(--line-300)] rounded-[var(--r-md)] px-3 py-[9px] focus-within:border-[var(--cobalt-400)] focus-within:ring-2 focus-within:ring-[var(--cobalt-500)]/20 transition-colors" style={{ background: "var(--surface)" }}>
          <Mail size={16} style={{ color: "var(--fg-muted)" }} />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
            className="flex-1 outline-none text-[14px] bg-transparent"
            style={{ color: "var(--ink-900)" }}
          />
        </div>
      </OACard>

      <OACard style={{ padding: "20px 24px" }}>
        <p className="text-[12px] font-semibold mb-3 uppercase tracking-[0.05em]" style={{ color: "var(--fg-muted)" }}>Subject</p>
        <div className="flex flex-wrap gap-2.5">
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => onSubjectChange(s)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-md)] border-[1.5px] text-[14px] font-semibold cursor-pointer transition-all duration-[140ms]"
              style={{
                borderColor: selSubject === s ? "var(--cobalt-400)" : "var(--line-300)",
                background: selSubject === s ? "var(--cobalt-50)" : "var(--surface)",
                color: selSubject === s ? "var(--cobalt-700)" : "var(--ink-700)",
              }}
            >
              <OASubjectDot subject={s} size={9} />
              {s}
              {selSubject === s && <Check size={13} style={{ color: "var(--cobalt-600)" }} />}
            </button>
          ))}
        </div>
      </OACard>

      <OACard style={{ padding: "20px 24px" }}>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[12px] font-semibold mb-2.5 uppercase tracking-[0.05em]" style={{ color: "var(--fg-muted)" }}>Difficulty</p>
            <div className="flex gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => onDifficultyChange(d)}
                  className="flex-1 py-2 rounded-[var(--r-md)] border-[1.5px] text-[13px] font-semibold cursor-pointer transition-all duration-[140ms]"
                  style={{
                    borderColor: selDifficulty === d ? "var(--cobalt-400)" : "var(--line-300)",
                    background: selDifficulty === d ? "var(--cobalt-50)" : "var(--surface)",
                    color: selDifficulty === d ? "var(--cobalt-700)" : "var(--ink-700)",
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[12px] font-semibold mb-2.5 uppercase tracking-[0.05em]" style={{ color: "var(--fg-muted)" }}>Questions</p>
            <div className="flex gap-2">
              {allowedCounts.map((c) => (
                <button
                  key={c}
                  onClick={() => onCountChange(c)}
                  className="flex-1 py-2 rounded-[var(--r-md)] border-[1.5px] text-[13px] font-bold cursor-pointer transition-all duration-[140ms]"
                  style={{
                    fontFamily: "var(--font-mono)",
                    borderColor: selCount === c ? "var(--cobalt-400)" : "var(--line-300)",
                    background: selCount === c ? "var(--cobalt-50)" : "var(--surface)",
                    color: selCount === c ? "var(--cobalt-700)" : "var(--ink-700)",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </OACard>

      {error && (
        <p className="text-[13px] px-3 py-2 rounded-[var(--r-md)]" style={{ background: "var(--danger-bg)", color: "var(--danger-tx)" }}>
          {error}
        </p>
      )}

      <button
        onClick={() => onSend(email)}
        disabled={sending || !email.trim()}
        className="flex items-center justify-center gap-2 py-3 rounded-[var(--r-md)] text-[15px] font-semibold text-white border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: "var(--cobalt-500)", boxShadow: "var(--shadow-brand)" }}
      >
        <Send size={16} />
        {sending ? "Setting up your battle…" : "Send Challenge & Start Battle"}
      </button>
    </div>
  );
}
