"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

export function ShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  const li = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  const iconBtn =
    "inline-flex items-center justify-center w-9 h-9 rounded-[var(--r-md)] border text-[13px] font-bold transition-colors hover:bg-[var(--fill-100)]";
  const style = { borderColor: "var(--line-300)", color: "var(--ink-700)" } as const;

  return (
    <div className="flex items-center gap-2">
      <a href={x} target="_blank" rel="noopener noreferrer" className={iconBtn} style={style} aria-label="Share on X" title="Share on X">
        𝕏
      </a>
      <a href={li} target="_blank" rel="noopener noreferrer" className={iconBtn} style={style} aria-label="Share on LinkedIn" title="Share on LinkedIn">
        in
      </a>
      <button
        onClick={copy}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--r-md)] border text-[12.5px] font-semibold transition-colors hover:bg-[var(--fill-100)]"
        style={style}
      >
        {copied ? <Check size={14} style={{ color: "var(--success-tx)" }} /> : <Link2 size={14} />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
