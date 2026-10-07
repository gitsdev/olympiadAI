"use client";

// TipTap node for a CTA block. Stored as <div data-cta="TYPE"></div>, the
// only <div> the article sanitizer keeps; shown in the editor as a card.

import { Node, NodeViewWrapper, ReactNodeViewRenderer, mergeAttributes, type NodeViewProps } from "@tiptap/react";
import { Megaphone, Trash2 } from "lucide-react";
import { CTA_LABELS, CTA_TYPES } from "@/lib/seo-agent/constants";
import { CTA_DESTINATIONS } from "@/lib/seo-agent/site-pages";

function CtaView({ node, updateAttributes, deleteNode, editor, selected }: NodeViewProps) {
  const type = node.attrs.ctaType as keyof typeof CTA_DESTINATIONS;
  const dest = CTA_DESTINATIONS[type] ?? CTA_DESTINATIONS.MOCK_TEST;
  return (
    <NodeViewWrapper
      contentEditable={false}
      data-drag-handle
      className="my-4 rounded-[var(--r-lg)] border p-4 flex items-center gap-3 flex-wrap"
      style={{
        background: "linear-gradient(135deg, var(--gold-100), var(--cobalt-50))",
        borderColor: selected ? "var(--cobalt-400)" : "var(--line-300)",
      }}
    >
      <Megaphone size={18} style={{ color: "var(--gold-700)" }} aria-hidden />
      <div className="flex flex-col flex-1 min-w-[180px]">
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-muted)" }}>CTA block</span>
        <span className="text-[14px] font-bold" style={{ color: "var(--ink-900)", fontFamily: "var(--font-display)" }}>{dest.label}</span>
        <span className="text-[12px]" style={{ color: "var(--fg-muted)" }}>{dest.description} → {dest.path}</span>
      </div>
      {editor.isEditable && (
        <>
          <select
            aria-label="CTA type"
            value={type}
            onChange={(e) => updateAttributes({ ctaType: e.target.value })}
            className="text-[13px] px-2 py-1.5 rounded-[var(--r-md)] border"
            style={{ borderColor: "var(--line-300)", background: "var(--surface)" }}
          >
            {CTA_TYPES.map((t) => <option key={t} value={t}>{CTA_LABELS[t]}</option>)}
          </select>
          <button type="button" onClick={deleteNode} aria-label="Remove CTA block"
            className="w-8 h-8 flex items-center justify-center rounded-[var(--r-md)] hover:bg-[var(--fill-100)]">
            <Trash2 size={15} style={{ color: "var(--ink-500)" }} />
          </button>
        </>
      )}
    </NodeViewWrapper>
  );
}

export const CtaBlock = Node.create({
  name: "ctaBlock",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      ctaType: {
        default: "MOCK_TEST",
        parseHTML: (el) => {
          const v = el.getAttribute("data-cta");
          return v && (CTA_TYPES as readonly string[]).includes(v) ? v : "MOCK_TEST";
        },
        renderHTML: (attrs) => ({ "data-cta": attrs.ctaType }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-cta]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CtaView);
  },
});
