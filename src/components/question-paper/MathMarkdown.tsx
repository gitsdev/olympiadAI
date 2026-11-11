"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkHtmlAsText from "@/lib/question-paper/remark-html-as-text";
import { cn } from "@/lib/utils";

// Renders AI/user Markdown with LaTeX maths. Raw HTML is shown as plain
// text (never rendered), so answer content can't inject markup or scripts.
export function MathMarkdown({ children, className, inline = false }: { children: string | null | undefined; className?: string; inline?: boolean }) {
  if (!children?.trim()) return null;
  return (
    <div className={cn("qps-md", inline && "qps-md-inline", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkHtmlAsText]} rehypePlugins={[[rehypeKatex, { strict: "ignore" }]]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
