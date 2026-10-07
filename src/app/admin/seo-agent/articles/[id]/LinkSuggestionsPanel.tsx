"use client";

import { useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Suggestion {
  id: string;
  url: string;
  anchorText: string;
  reason: string | null;
  targetType: string;
}

interface Props {
  suggestions: Suggestion[];
  editable: boolean;
  finding: boolean;
  onFind: () => void;
  /** Applies the link in the editor; returns false if the anchor text wasn't found. */
  onApply: (s: Suggestion) => boolean;
  onDismiss: (s: Suggestion) => Promise<void>;
}

export function LinkSuggestionsPanel({ suggestions, editable, finding, onFind, onApply, onDismiss }: Props) {
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const open = suggestions.filter((s) => !applied.has(s.id));

  function apply(s: Suggestion) {
    setError(null);
    if (onApply(s)) setApplied((a) => new Set(a).add(s.id));
    else setError(`Couldn't find "${s.anchorText}" as plain text in the article (it may have been edited or already linked). Add the link by hand if you still want it.`);
  }

  return (
    <div className="flex flex-col gap-3">
      {open.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
          {applied.size > 0 ? "All suggestions applied. Save to keep them." : "No open suggestions. The Internal Linking Agent suggests links to existing OlympiadIQ pages, using text already in the article."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--line-200)]">
          {open.map((s) => (
            <li key={s.id} className="py-2 flex flex-col gap-1 text-[12.5px]">
              <span style={{ color: "var(--ink-900)" }}>
                &ldquo;<span className="font-semibold">{s.anchorText}</span>&rdquo; → <code className="font-mono text-[12px]">{s.url}</code>
              </span>
              {s.reason && <span style={{ color: "var(--fg-muted)" }}>{s.reason}</span>}
              {editable && (
                <span className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => apply(s)}><Link2 size={13} /> Apply</Button>
                  <Button size="sm" variant="ghost" onClick={() => onDismiss(s)}>Dismiss</Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-[12px]" style={{ color: "var(--danger-tx)" }}>{error}</p>}
      {editable && (
        <Button size="sm" variant="outline" onClick={onFind} disabled={finding}>
          {finding ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
          {finding ? "Finding links… (10–30s)" : "Find link suggestions"}
        </Button>
      )}
    </div>
  );
}
