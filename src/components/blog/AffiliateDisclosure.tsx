import Link from "next/link";
import { Info, ExternalLink } from "lucide-react";
import { AFFILIATE_DISCLOSURE_SHORT, AFFILIATE_PRICE_DISCLAIMER } from "@/lib/blog";

/**
 * Amazon Associates Operating Agreement requires a clear and conspicuous
 * disclosure on every page that contains affiliate links. This renders it
 * near the top of the content, above the fold.
 */
export function AffiliateDisclosure({ withPriceNote = false }: { withPriceNote?: boolean }) {
  return (
    <aside
      className="rounded-[var(--r-lg)] border px-4 py-3.5 shadow-[var(--shadow-xs)]"
      style={{ background: "var(--surface)", borderColor: "var(--line-200)" }}
      aria-label="Affiliate disclosure"
    >
      <div className="flex items-start gap-3">
        <span
          className="w-7 h-7 rounded-[var(--r-sm)] flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "var(--cobalt-50)", color: "var(--brand)" }}
        >
          <Info size={15} />
        </span>
        <div className="text-[12.5px] leading-[1.65]" style={{ color: "var(--fg-muted)" }}>
          <p>
            <strong style={{ color: "var(--ink-900)" }}>Disclosure:</strong> {AFFILIATE_DISCLOSURE_SHORT}{" "}
            <Link href="/blog/affiliate-disclosure" className="font-semibold inline-flex items-center gap-0.5" style={{ color: "var(--brand)" }}>
              Learn more <ExternalLink size={12} />
            </Link>
          </p>
          {withPriceNote && <p className="mt-1.5">{AFFILIATE_PRICE_DISCLAIMER}</p>}
        </div>
      </div>
    </aside>
  );
}
