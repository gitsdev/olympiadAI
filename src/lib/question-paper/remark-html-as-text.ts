// remark plugin: turns raw HTML in Markdown into plain text. Without it, a
// line that starts with markup (e.g. "<b>x</b> Not enough data") becomes an
// HTML block that renderers drop entirely, taking the real text with it.
// Showing it as literal text is both safe (never rendered as HTML) and loses
// nothing. Client-safe.

import type { Root, Parent } from "mdast";

export default function remarkHtmlAsText() {
  return (tree: Root) => {
    const walk = (node: Parent) => {
      node.children.forEach((child, i) => {
        if (child.type === "html") {
          const value = child.value;
          // Block-level HTML must live in a paragraph; inline HTML is already in one.
          node.children[i] = node.type === "root" || node.type === "blockquote" || node.type === "listItem"
            ? { type: "paragraph", children: [{ type: "text", value }] }
            : { type: "text", value };
        } else if ("children" in child) {
          walk(child as Parent);
        }
      });
    };
    walk(tree);
  };
}
