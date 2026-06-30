"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, BookOpen, Play, FileText, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const CONCEPTS = [
  { label: "Fractions & Decimals", meta: "Concept · CBSE Cl 7 · Ch 2", Icon: BookOpen },
  { label: "Profit & Loss",        meta: "Concept · weak area · 44%",  Icon: BookOpen },
];

const RESOURCES = [
  { label: "Refraction of light — video", meta: "Resource · 6 min · linked source", Icon: Play },
  { label: "IMO geometry — practice set", meta: "Questions · Olympiad · Hard",       Icon: FileText },
];

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function SearchPalette({ open, onClose }: SearchPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [liveResults, setLiveResults] = useState<{ id: string; type: string; label: string; meta: string }[]>([]);
  const [searching, setSearching] = useState(false);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setLiveResults([]);
      setSearching(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounced live search
  useEffect(() => {
    if (!query.trim()) { setLiveResults([]); setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&class=7&board=CBSE`);
        if (res.ok) {
          const { results } = await res.json();
          setLiveResults(results ?? []);
        }
      } catch {}
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard dismiss
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  function goTutor() {
    onClose();
    router.push("/tutor");
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[110px]"
      style={{ background: "oklch(0.23 0.02 264 / 0.40)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="oa-fade w-[600px] rounded-[var(--r-xl)] border border-[var(--line-200)] shadow-[var(--shadow-lg)] overflow-hidden bg-[var(--surface)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-[18px] py-4 border-b border-[var(--line-200)]">
          <Search size={20} style={{ color: "var(--fg-muted)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && goTutor()}
            placeholder="Teach me fractions · Class 7 algebra · IMO geometry…"
            className="flex-1 border-none outline-none bg-transparent text-[16px]"
            style={{ fontFamily: "var(--font-sans)", color: "var(--ink-900)" }}
          />
          <span
            className="text-[11px] px-1.5 py-0.5 rounded"
            style={{
              fontFamily: "var(--font-mono)",
              background: "var(--fill-100)",
              color: "var(--fg-muted)",
            }}
          >
            esc
          </span>
        </div>

        {/* Ask tutor CTA */}
        <div className="p-2">
          <button
            onClick={goTutor}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-3 rounded-[var(--r-md)] text-left cursor-pointer",
              "border border-[var(--cobalt-100)] bg-[var(--cobalt-50)]",
              "transition-colors duration-[140ms] hover:bg-[var(--cobalt-100)]"
            )}
          >
            <div
              className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0"
              style={{ background: "var(--cobalt-500)" }}
            >
              <Sparkles size={17} style={{ color: "#fff" }} />
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>
                Ask the tutor{query ? `: "${query}"` : ""}
              </div>
              <div className="text-[12px]" style={{ color: "var(--cobalt-700)" }}>
                Get a grounded, step-by-step explanation
              </div>
            </div>
            <ArrowRight size={17} style={{ color: "var(--brand)" }} />
          </button>
        </div>

        {/* Live results or static suggestions */}
        {query.trim() ? (
          <div className="px-2 pb-2">
            <div className="t-overline px-2.5 pt-2 pb-1.5" style={{ fontSize: 10 }}>Results</div>
            {searching && (
              <p className="px-3 py-3 text-[13px]" style={{ color: "var(--fg-muted)" }}>Searching…</p>
            )}
            {!searching && liveResults.length === 0 && (
              <p className="px-3 py-3 text-[13px]" style={{ color: "var(--fg-muted)" }}>No results for &ldquo;{query}&rdquo;</p>
            )}
            {!searching && liveResults.map((r) => {
              const Icon = r.type === "concept" ? BookOpen : r.type === "video" ? Play : FileText;
              const href = r.type === "question" ? "/practice" : "/learn";
              return (
                <button
                  key={r.id}
                  onClick={() => { onClose(); router.push(href); }}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-[var(--r-md)] text-left cursor-pointer",
                    "border border-transparent bg-transparent",
                    "transition-colors duration-[140ms] hover:bg-[var(--fill-100)] hover:border-[var(--line-200)]"
                  )}
                >
                  <Icon size={17} style={{ color: "var(--ink-500)", flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold truncate" style={{ color: "var(--ink-900)" }}>{r.label}</div>
                    <div className="text-[12px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{r.meta}</div>
                  </div>
                  <ArrowRight size={15} style={{ color: "var(--fg-subtle)" }} />
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <ResultGroup title="Concepts" items={CONCEPTS} onPick={() => { onClose(); router.push("/learn"); }} />
            <ResultGroup title="Resources & questions" items={RESOURCES} onPick={() => { onClose(); router.push("/practice"); }} />
          </>
        )}

        {/* Footer hint */}
        <div
          className="flex items-center gap-4 px-[18px] py-2.5 border-t border-[var(--line-200)]"
          style={{ background: "var(--paper-2)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}
        >
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span className="flex-1" />
          <span>Hybrid search · keyword + vector</span>
        </div>
      </div>
    </div>
  );
}

function ResultGroup({
  title,
  items,
  onPick,
}: {
  title: string;
  items: { label: string; meta: string; Icon: React.ElementType }[];
  onPick: () => void;
}) {
  return (
    <div className="px-2 pb-2">
      <div className="t-overline px-2.5 pt-2 pb-1.5" style={{ fontSize: 10 }}>
        {title}
      </div>
      {items.map((it) => (
        <button
          key={it.label}
          onClick={onPick}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-[var(--r-md)] text-left cursor-pointer",
            "border border-transparent bg-transparent",
            "transition-colors duration-[140ms] hover:bg-[var(--fill-100)] hover:border-[var(--line-200)]"
          )}
        >
          <it.Icon size={17} style={{ color: "var(--ink-500)", flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold truncate" style={{ color: "var(--ink-900)" }}>
              {it.label}
            </div>
            <div
              className="text-[12px]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}
            >
              {it.meta}
            </div>
          </div>
          <ArrowRight size={15} style={{ color: "var(--fg-subtle)" }} />
        </button>
      ))}
    </div>
  );
}
