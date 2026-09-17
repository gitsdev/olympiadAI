import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { ShoppingBag, ExternalLink } from "lucide-react";
import { isAmazonUrl, withAmazonTag } from "@/lib/blog";
import type { Element as HastElement, ElementContent } from "hast";

/**
 * Server-safe Markdown renderer for blog articles.
 *
 * Raw HTML in the source is intentionally NOT rendered (no rehype-raw), so
 * article content cannot inject markup even though it is authored in-app.
 *
 * Outbound links follow Amazon Associates + Google policy:
 * external links get rel="sponsored nofollow noopener noreferrer" and open in
 * a new tab; Amazon links additionally get the associate tag appended.
 */

function hastText(node: ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(hastText).join("");
  return "";
}

/** A paragraph that is *only* a link — used as a "highlight this CTA" pattern. */
function soleLink(node: HastElement | undefined): { href: string; text: string } | null {
  if (!node || node.children.length !== 1) return null;
  const only = node.children[0];
  if (only.type !== "element" || only.tagName !== "a") return null;
  const href = only.properties?.href;
  if (typeof href !== "string") return null;
  return { href, text: hastText(only) };
}

function CtaButton({ href, text }: { href: string; text: string }) {
  const amazon = isAmazonUrl(href);
  const url = amazon ? withAmazonTag(href) : href;
  return (
    <a
      href={url}
      target="_blank"
      rel="sponsored nofollow noopener noreferrer"
      className="not-prose group my-7 flex items-center justify-center gap-2.5 px-6 py-4 rounded-[var(--r-lg)] text-[15.5px] font-bold text-white text-center transition-all duration-150 hover:-translate-y-0.5"
      style={{ background: "linear-gradient(135deg, var(--gold-500), var(--gold-700))", boxShadow: "0 6px 18px oklch(0.56 0.11 70 / 0.35)" }}
    >
      {amazon ? <ShoppingBag size={19} /> : <ExternalLink size={19} />}
      {text || "View on Amazon"}
    </a>
  );
}

const components: Components = {
  h1: ({ children }) => (
    <h2 className="font-bold tracking-tight mt-12 mb-3.5 scroll-mt-24" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(21px, 3.4vw, 27px)", color: "var(--ink-900)" }}>
      {children}
    </h2>
  ),
  h2: ({ children, id }) => (
    <h2 id={id} className="font-bold tracking-tight mt-12 mb-3.5 pt-1 scroll-mt-24" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px, 3.2vw, 26px)", letterSpacing: "-0.01em", color: "var(--ink-900)" }}>
      {children}
    </h2>
  ),
  h3: ({ children, id }) => (
    <h3 id={id} className="font-bold mt-7 mb-2 scroll-mt-24" style={{ fontFamily: "var(--font-display)", fontSize: "17px", color: "var(--ink-900)" }}>
      {children}
    </h3>
  ),
  h4: ({ children, id }) => (
    <h4 id={id} className="font-semibold mt-6 mb-2 scroll-mt-24 text-[15px]" style={{ color: "var(--ink-900)" }}>
      {children}
    </h4>
  ),
  p: ({ children, node }) => {
    const cta = soleLink(node);
    if (cta) return <CtaButton href={cta.href} text={cta.text} />;
    return (
      <p className="text-[15px] leading-[1.75] mb-4" style={{ color: "var(--ink-700)" }}>{children}</p>
    );
  },
  a: ({ href, children }) => {
    const url = href ?? "#";
    const isInternal = url.startsWith("/") || url.startsWith("#");
    if (isInternal) {
      return <a href={url} className="font-medium underline" style={{ color: "var(--brand)" }}>{children}</a>;
    }
    const amazon = isAmazonUrl(url);
    return (
      <a
        href={amazon ? withAmazonTag(url) : url}
        target="_blank"
        rel="sponsored nofollow noopener noreferrer"
        className="font-medium underline underline-offset-2"
        style={{ color: "var(--brand)" }}
      >
        {children}
      </a>
    );
  },
  ul: ({ children }) => <ul className="mb-5 pl-5 flex flex-col gap-1.5" style={{ listStyleType: "disc" }}>{children}</ul>,
  ol: ({ children }) => <ol className="mb-5 pl-5 flex flex-col gap-1.5" style={{ listStyleType: "decimal" }}>{children}</ol>,
  li: ({ children }) => <li className="text-[15px] leading-[1.7]" style={{ color: "var(--ink-700)" }}>{children}</li>,
  blockquote: ({ children }) => (
    <blockquote
      className="my-6 pl-5 pr-4 py-3.5 border-l-4 rounded-r-[var(--r-md)] text-[16px] leading-[1.6] italic [&_p]:m-0 [&_p]:text-[16px] [&_p]:leading-[1.6] [&_p]:not-italic [&_cite]:block [&_cite]:mt-2 [&_cite]:text-[12.5px] [&_cite]:not-italic"
      style={{ borderColor: "var(--cobalt-400)", background: "var(--surface)", color: "var(--ink-900)", boxShadow: "var(--shadow-xs)" }}
    >
      {children}
    </blockquote>
  ),
  strong: ({ children }) => <strong style={{ color: "var(--ink-900)", fontWeight: 700 }}>{children}</strong>,
  hr: () => <hr className="my-9" style={{ borderColor: "var(--line-200)" }} />,
  code: ({ className, children }) => {
    const inline = !className && !String(children).includes("\n");
    if (inline) {
      return (
        <code className="px-1.5 py-0.5 rounded text-[13px]" style={{ background: "var(--fill-100)", fontFamily: "var(--font-mono)", color: "var(--cobalt-700)" }}>
          {children}
        </code>
      );
    }
    return <code className={className} style={{ fontFamily: "var(--font-mono)" }}>{children}</code>;
  },
  pre: ({ children }) => (
    <pre className="my-5 p-4 rounded-[var(--r-md)] overflow-x-auto text-[13px] leading-[1.6]" style={{ background: "var(--ink-900)", color: "oklch(0.92 0.01 264)" }}>
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-[var(--r-md)] border" style={{ borderColor: "var(--line-200)" }}>
      <table className="w-full text-[14px] border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="text-left font-semibold p-2.5 border" style={{ borderColor: "var(--line-200)", background: "var(--fill-100)", color: "var(--ink-900)" }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="p-2.5 border align-top" style={{ borderColor: "var(--line-200)", color: "var(--ink-700)" }}>{children}</td>
  ),
  img: ({ src, alt }) =>
    typeof src === "string" ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt ?? ""} loading="lazy" className="my-6 rounded-[var(--r-md)] border w-full" style={{ borderColor: "var(--line-200)" }} />
    ) : null,
};

export function Markdown({ content }: { content: string }) {
  return (
    <div>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
