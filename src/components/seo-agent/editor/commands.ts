// Editor operations used by the SEO panels (apply a suggested link, switch CTAs).

import type { Editor } from "@tiptap/react";
import type { CtaType } from "@/lib/seo-agent/constants";

/**
 * Links the first occurrence of `anchor` (case-insensitive, within a single
 * text run, not already linked, not inside a heading). Returns false if the
 * text isn't found.
 */
export function applyLinkAtText(editor: Editor, anchor: string, href: string): boolean {
  const needle = anchor.toLowerCase();
  let range: { from: number; to: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (range || node.type.name === "heading") return false;
    if (!node.isText || !node.text) return true;
    if (node.marks.some((m) => m.type.name === "link")) return true;
    const i = node.text.toLowerCase().indexOf(needle);
    if (i >= 0) range = { from: pos + i, to: pos + i + anchor.length };
    return true;
  });
  if (!range) return false;
  editor.chain().focus().setTextSelection(range).setLink({ href }).run();
  return true;
}

/** Sets every CTA block to `type`; adds one at the end if there is none. Returns blocks changed. */
export function setAllCtas(editor: Editor, type: CtaType): number {
  let changed = 0;
  editor.chain().focus().command(({ tr }) => {
    tr.doc.descendants((node, pos) => {
      if (node.type.name === "ctaBlock") {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, ctaType: type });
        changed++;
      }
    });
    return true;
  }).run();
  if (changed === 0) {
    editor.chain().focus("end").insertContent({ type: "ctaBlock", attrs: { ctaType: type } }).run();
    changed = 1;
  }
  return changed;
}
