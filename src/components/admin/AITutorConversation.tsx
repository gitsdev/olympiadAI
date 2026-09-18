import { Sparkles, User } from "lucide-react";
import type { ConversationMessage } from "@/types/database";

export function AITutorConversation({ messages }: { messages: ConversationMessage[] }) {
  if (messages.length === 0) {
    return <p className="text-[13px] p-4" style={{ color: "var(--fg-muted)" }}>This session has no messages.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.map((m, i) => {
        const isStudent = m.role === "user";
        return (
          <div key={i} className={`flex gap-2.5 ${isStudent ? "" : "flex-row-reverse"}`}>
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: isStudent ? "var(--fill-100)" : "var(--cobalt-50)" }}
              aria-hidden
            >
              {isStudent ? <User size={13} style={{ color: "var(--ink-700)" }} /> : <Sparkles size={13} style={{ color: "var(--cobalt-600)" }} />}
            </span>
            <div className={`max-w-[75%] ${isStudent ? "" : "text-right"}`}>
              <div
                className="rounded-[var(--r-lg)] px-3.5 py-2.5 text-[13.5px] whitespace-pre-wrap text-left"
                style={{
                  background: isStudent ? "var(--fill-100)" : "var(--cobalt-50)",
                  color: "var(--ink-900)",
                }}
              >
                {m.content}
              </div>
              <p className="text-[11px] mt-1" style={{ color: "var(--fg-subtle)" }}>
                {isStudent ? "Student" : "AI Tutor"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
