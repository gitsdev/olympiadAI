// Sanitized article HTML → the blog's Markdown (blog_posts.content).
//
// The blog renders GFM with react-markdown (src/components/blog/Markdown.tsx)
// and turns a paragraph that is ONLY a link into a button. CTA blocks are
// therefore published as: bold headline, one line of text, and the button
// link alone in its own paragraph.

import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import type { Element, Root } from "hast";
import { CTA_TYPES, type CtaType } from "../constants";
import { CTA_COPY } from "../cta";
import { CTA_DESTINATIONS } from "../site-pages";
import { sanitizeArticleHtml } from "../article-html";

const text = (value: string) => ({ type: "text" as const, value });
const el = (tagName: string, properties: Element["properties"], children: Element["children"]): Element => ({ type: "element", tagName, properties, children });

/** Replaces each <div data-cta> with headline / body / button paragraphs. */
function expandCtas() {
  return (tree: Root) => {
    const visit = (parent: Root | Element) => {
      for (let i = parent.children.length - 1; i >= 0; i--) {
        const n = parent.children[i];
        if (n.type !== "element") continue;
        const type = n.tagName === "div" ? n.properties?.dataCta : undefined;
        if (typeof type === "string" && (CTA_TYPES as readonly string[]).includes(type)) {
          const copy = CTA_COPY[type as CtaType];
          const dest = CTA_DESTINATIONS[type as CtaType];
          parent.children.splice(i, 1,
            el("hr", {}, []),
            el("p", {}, [el("strong", {}, [text(copy.headline)])]),
            el("p", {}, [text(copy.body)]),
            el("p", {}, [el("a", { href: dest.path }, [text(copy.button)])]),
            el("hr", {}, []),
          );
        } else {
          visit(n);
        }
      }
    };
    visit(tree);
  };
}

export function articleHtmlToBlogMarkdown(html: string): string {
  // Re-sanitize: publishing must never trust stored HTML blindly.
  const safe = sanitizeArticleHtml(html);
  const md = String(
    unified()
      .use(rehypeParse, { fragment: true })
      .use(expandCtas)
      .use(rehypeRemark)
      .use(remarkGfm)
      .use(remarkStringify, { bullet: "-", emphasis: "*", strong: "*", rule: "-", fences: true, listItemIndent: "one" })
      .processSync(safe),
  );
  return md.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
